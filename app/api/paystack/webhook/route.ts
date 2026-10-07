import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { finalizeOrderFromPaystack } from "@/lib/orders";

// Paste this URL into Paystack: Dashboard → Settings → API Keys & Webhooks
// → Webhook URL → https://yourdomain.com/api/paystack/webhook
//
// This exists so an order still gets confirmed even if the customer's
// browser closes, loses signal, or crashes right after paying — Paystack
// calls this directly from their own servers, independent of the customer's
// device.
export async function POST(req: NextRequest) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    console.error("Webhook: missing PAYSTACK_SECRET_KEY");
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  // Must hash the RAW request body — parsing it to JSON and re-stringifying
  // changes whitespace/key order and makes the signature never match.
  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";

  const expected = crypto.createHmac("sha512", secretKey).update(raw).digest("hex");
  if (signature !== expected) {
    console.warn("Webhook: invalid signature — ignoring");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return new NextResponse("Invalid payload", { status: 400 });
  }

  if (event?.event === "charge.success" && event?.data?.reference) {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      // Same finalize path the checkout page's own callback uses — safe to
      // run twice (idempotent), so it doesn't matter which one gets there first.
      await finalizeOrderFromPaystack(supabaseAdmin, event.data.reference);
    } catch (err) {
      console.error("Webhook finalize error:", err);
      // Still acknowledge receipt below — we've logged it, and returning an
      // error here would just make Paystack retry forever.
    }
  }

  return NextResponse.json({ received: true });
}