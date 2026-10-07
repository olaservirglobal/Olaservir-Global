// Server-only order logic. This is the part that actually decides how much
// money is owed — never trust a total, price, or user id that came from the
// browser. Two entry points:
//
// - createPendingOrder(): called BEFORE payment starts. Recomputes the total
//   from the real prices in the "products" table (the client only sends
//   product ids + quantities) and writes a "pending" order row. The amount
//   charged in the Paystack popup comes from what THIS returns — never from
//   anything the browser calculated.
// - finalizeOrderFromPaystack(): called AFTER payment, either by the
//   checkout page's own callback or by Paystack's webhook (whichever gets
//   there first — it's written to be safe either way, or both). It re-checks
//   the payment with Paystack directly using the secret key, confirms the
//   amount matches the pending order's stored total, and flips the order to
//   "confirmed" exactly once.

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

type Customer = {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
};

type IncomingItem = { id: string; qty: number };

export type PendingOrder = {
  reference: string;
  totalNaira: number;
  totalKobo: number;
};

/**
 * Looks up real prices from the "products" table for the given item ids,
 * computes the true total, and inserts a "pending" order row. Throws with a
 * user-facing message if anything doesn't check out (empty cart, unknown
 * product, bad quantity, insufficient stock).
 */
export async function createPendingOrder(
  supabaseAdmin: SupabaseClient,
  params: { userId: string; email: string; customer: Customer; items: IncomingItem[] }
): Promise<PendingOrder> {
  const { userId, email, customer, items } = params;

  if (!items.length) {
    throw new Error("Your cart is empty.");
  }
  if (!customer.fullName?.trim() || !customer.phone?.trim() || !customer.address?.trim() || !customer.city?.trim() || !customer.state?.trim()) {
    throw new Error("Please fill in every delivery field.");
  }

  const ids = items.map((i) => i.id);
  const { data: products, error: productsError } = await supabaseAdmin
    .from("products")
    .select("id, name, price, stock")
    .in("id", ids);

  if (productsError || !products) {
    // Log the REAL Supabase error so it's visible in the server terminal —
    // the message thrown below is deliberately generic for the customer.
    console.error("createPendingOrder: products lookup failed", { ids, productsError });
    throw new Error("Could not look up product prices.");
  }

  let totalNaira = 0;
  const orderItems = items.map((reqItem) => {
    const product = products.find((p) => p.id === reqItem.id);
    if (!product) throw new Error("One of the items in your cart is no longer available.");

    const qty = Number(reqItem.qty);
    if (!Number.isInteger(qty) || qty < 1) {
      throw new Error("Invalid quantity.");
    }
    if (product.stock != null && product.stock < qty) {
      throw new Error(`"${product.name}" only has ${product.stock} left in stock.`);
    }

    totalNaira += product.price * qty;

    // Price is captured here, from the database, at order time — this is
    // what the order will always say was owed, regardless of later price
    // changes.
    return {
      id: product.id,
      name: product.name,
      price: `₦${product.price.toLocaleString()}`,
      qty,
    };
  });

  if (totalNaira <= 0) {
    throw new Error("Order total must be greater than zero.");
  }

  const reference = `olaservir_${randomUUID()}`;

  const { error: insertError } = await supabaseAdmin.from("orders").insert({
    reference,
    user_id: userId,
    email,
    full_name: customer.fullName,
    phone: customer.phone,
    address: customer.address,
    city: customer.city,
    state: customer.state,
    items: orderItems,
    total: totalNaira,
    status: "pending",
  });

  if (insertError) {
    console.error("createPendingOrder insert failed:", insertError);
    throw new Error("Could not create your order. Please try again.");
  }

  return { reference, totalNaira, totalKobo: Math.round(totalNaira * 100) };
}

export type FinalizeResult = { verified: boolean; error?: string };

/**
 * Re-verifies a payment directly with Paystack (never trusting the client's
 * "it worked" callback alone), checks it against the pending order's
 * server-computed total, and flips the order to "confirmed" — exactly once,
 * even if this runs twice (browser callback + webhook both firing).
 */
export async function finalizeOrderFromPaystack(
  supabaseAdmin: SupabaseClient,
  reference: string
): Promise<FinalizeResult> {
  if (!reference) return { verified: false, error: "Missing reference" };

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return { verified: false, error: "Server is missing PAYSTACK_SECRET_KEY" };

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();

  if (orderError || !order) {
    return { verified: false, error: "Unknown order reference" };
  }

  // Already finalized by the other caller (webhook vs. browser callback,
  // whichever got here first) — this is success, just nothing left to do.
  if (order.status !== "pending") {
    return { verified: true };
  }

  const paystackRes = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store" }
  );
  const data = await paystackRes.json();

  if (!paystackRes.ok || data?.data?.status !== "success") {
    return { verified: false, error: "Payment not successful" };
  }

  if (data.data.currency !== "NGN") {
    return { verified: false, error: "Unexpected currency" };
  }

  // The ONLY number that matters: what Paystack says was actually paid,
  // compared against the total we computed server-side when the order was
  // created — never anything the browser sends at this step.
  const expectedKobo = Math.round(Number(order.total) * 100);
  if (data.data.amount !== expectedKobo) {
    return { verified: false, error: "Amount mismatch — possible tampering" };
  }

  // Flip pending -> confirmed, but ONLY if it's still pending. If two
  // callers race (webhook + browser), only one of them gets a row back from
  // this update — that's how we guarantee stock only gets decremented once.
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("orders")
    .update({ status: "confirmed", paid_at: new Date().toISOString() })
    .eq("reference", reference)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (updateError) {
    console.error("finalizeOrderFromPaystack update failed:", updateError);
    return { verified: false, error: "Could not finalize order" };
  }

  if (!updated) {
    // Someone else finalized it in the moment between our read and update.
    return { verified: true };
  }

  const items = (updated.items as { id: string; qty: number }[]) ?? [];
  for (const item of items) {
    const { error: stockError } = await supabaseAdmin.rpc("decrement_product_stock", {
      p_id: item.id,
      p_qty: item.qty,
    });
    if (stockError) {
      // The order is already paid and confirmed at this point — log it for
      // manual stock reconciliation rather than failing the order over it.
      console.error(`Stock decrement failed for product ${item.id}:`, stockError);
    }
  }

  return { verified: true };
}