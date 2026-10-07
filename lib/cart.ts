// Shared cart logic used by the homepage, product pages, and checkout.
//
// How it works:
// - Logged OUT: the cart lives only in this browser's localStorage (a
//   "guest cart"). It's gone if they switch devices or clear their browser.
// - Logged IN: the cart lives in Supabase under the shopper's account (a
//   "account cart"), so it follows them to any device they log into.
// - The moment someone logs in, syncCartOnLogin() merges whatever was in
//   their guest cart into their saved account cart, then clears the guest
//   cart so it doesn't leak to the next person who uses this browser.

import type { SupabaseClient } from "@supabase/supabase-js";

// `id` is the product's row id in the "products" table — this is what the
// server trusts to look up the real, current price. `name` and `price` are
// kept only so the UI can show something without an extra round trip; they
// are never trusted for totals or payment amounts.
export type CartItem = { id: string; name: string; price: string; qty: number };

export const GUEST_CART_KEY = "olaservir_cart";

/** Combine two cart lists, summing quantities for items that appear in both (matched by product id). */
export function mergeCartItems(a: CartItem[], b: CartItem[]): CartItem[] {
  const merged = [...a];
  for (const item of b) {
    const idx = merged.findIndex((m) => m.id === item.id);
    if (idx > -1) {
      merged[idx] = { ...merged[idx], qty: merged[idx].qty + item.qty };
    } else {
      merged.push(item);
    }
  }
  return merged;
}

export function readGuestCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeGuestCart(items: CartItem[]) {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  } catch {
    // ignore storage errors (private browsing, storage full, etc.)
  }
}

export function clearGuestCart() {
  try {
    localStorage.removeItem(GUEST_CART_KEY);
  } catch {
    // ignore storage errors
  }
}

/** Fetches the signed-in user's saved cart from Supabase. Returns [] if they don't have one yet. */
export async function fetchAccountCart(
  supabase: SupabaseClient,
  userId: string
): Promise<CartItem[]> {
  const { data, error } = await supabase
    .from("carts")
    .select("items")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return [];
  return (data.items as CartItem[]) ?? [];
}

/** Saves the signed-in user's cart to Supabase, creating their cart row the first time. */
export async function saveAccountCart(
  supabase: SupabaseClient,
  userId: string,
  items: CartItem[]
) {
  await supabase
    .from("carts")
    .upsert(
      { user_id: userId, items, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
}

/**
 * Call this right after you know someone is logged in. It merges whatever
 * was sitting in their guest cart into their saved account cart, clears the
 * guest cart, and returns the combined list ready to show on screen.
 * Safe to call even if the guest cart is empty.
 */
export async function syncCartOnLogin(
  supabase: SupabaseClient,
  userId: string
): Promise<CartItem[]> {
  const guestItems = readGuestCart();
  const accountItems = await fetchAccountCart(supabase, userId);
  const merged = mergeCartItems(accountItems, guestItems);

  if (guestItems.length > 0) {
    await saveAccountCart(supabase, userId, merged);
    clearGuestCart();
  }

  return merged;
}

/** Adds (or bumps the quantity of) one item into whichever cart belongs to this shopper. */
export async function addItemToCart(
  supabase: SupabaseClient,
  userId: string | null,
  item: { id: string; name: string; price: string },
  qty: number
) {
  const current = userId ? await fetchAccountCart(supabase, userId) : readGuestCart();

  const idx = current.findIndex((c) => c.id === item.id);
  let next: CartItem[];
  if (idx > -1) {
    next = [...current];
    next[idx] = { ...next[idx], qty: next[idx].qty + qty };
  } else {
    next = [...current, { id: item.id, name: item.name, price: item.price, qty }];
  }

  if (userId) {
    await saveAccountCart(supabase, userId, next);
  } else {
    writeGuestCart(next);
  }

  return next;
}