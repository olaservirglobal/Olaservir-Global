"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Script from "next/script";
import { createBrowserClient } from "@supabase/ssr";
import { ShoppingBag, ShieldCheck } from "lucide-react";
import { saveAccountCart, type CartItem } from "@/lib/cart";

const FONT_STACK = "'Aeonik', ui-sans-serif, system-ui, -apple-system, sans-serif";

// Separate from the guest cart key ("olaservir_cart") used in @/lib/cart.
// The home page writes the cart here when heading to checkout, so it never
// gets mistaken for a guest cart and merged (doubled) on the next home visit.
const CHECKOUT_CART_KEY = "olaservir_checkout_cart";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

declare global {
  interface Window {
    PaystackPop?: {
      setup: (config: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

export default function CheckoutPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    address: "",
    city: "",
    state: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setEmail(session?.user?.email ?? null);
      setUserId(session?.user?.id ?? null);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHECKOUT_CART_KEY);
      setCart(raw ? JSON.parse(raw) : []);
    } catch {
      setCart([]);
    }
    setCartLoaded(true);
  }, []);

  // What the cart LOOKS like it costs, for display only — purely cosmetic.
  // The amount actually charged always comes back from the server in
  // handlePay below, computed fresh from the database.
  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty * Number(item.price.replace(/[^\d]/g, "")), 0),
    [cart]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const allFieldsFilled = Object.values(form).every((v) => v.trim().length > 0);

  const handlePay = async (e: FormEvent) => {
    e.preventDefault();

    if (!email) return;
    if (!allFieldsFilled) {
      setError("Please fill in every field before paying.");
      return;
    }
    if (cart.length === 0) {
      setError("Your cart is empty.");
      return;
    }
    if (!scriptReady || !window.PaystackPop) {
      setError("Payment is still loading, please try again in a moment.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      // Ask the server to create the order and tell us the real amount to
      // charge — it recomputes the total from the database, so nothing the
      // browser calculated is ever trusted for the actual payment.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        setError("Your session expired — please log in again.");
        setSubmitting(false);
        return;
      }

      const createRes = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          items: cart.map((item) => ({ id: item.id, qty: item.qty })),
          customer: form,
        }),
      });
      const createData = await createRes.json();

      if (!createRes.ok || !createData.reference) {
        setError(createData.error ?? "Could not start checkout. Please try again.");
        setSubmitting(false);
        return;
      }

      const { reference, amount } = createData as { reference: string; amount: number };

      const handler = window.PaystackPop!.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
        email,
        amount, // kobo — exactly what the server computed, not a client total
        currency: "NGN",
        ref: reference,
        metadata: {
          custom_fields: [
            { display_name: "Full Name", variable_name: "full_name", value: form.fullName },
            { display_name: "Phone", variable_name: "phone", value: form.phone },
            { display_name: "Address", variable_name: "address", value: `${form.address}, ${form.city}, ${form.state}` },
          ],
        },
        callback: (response: { reference: string }) => {
          (async () => {
            try {
              const res = await fetch("/api/paystack/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reference: response.reference }),
              });
              const data = await res.json();

              if (res.ok && data.verified) {
                localStorage.removeItem(CHECKOUT_CART_KEY);
                if (userId) {
                  // Empty their saved account cart too — the order's placed,
                  // so these items shouldn't still be sitting in the cart
                  // next time they log in on any device.
                  saveAccountCart(supabase, userId, []);
                }
                window.location.href = `/track/${response.reference}`;
              } else {
                setError(
                  "We couldn't confirm your payment. Please contact support with reference: " + response.reference
                );
                setSubmitting(false);
              }
            } catch {
              setError(
                "Payment went through but confirmation failed. Save this reference and contact support: " +
                  response.reference
              );
              setSubmitting(false);
            }
          })();
        },
        onClose: () => {
          setSubmitting(false);
        },
      });

      handler.openIframe();
    } catch {
      setError("Something went wrong starting checkout. Please try again.");
      setSubmitting(false);
    }
  };

  if (!authChecked || !cartLoaded) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-[#E7E5E1]" style={{ fontFamily: FONT_STACK }}>
        <p className="text-sm text-[#172236]/60">Loading checkout…</p>
      </main>
    );
  }

  if (!email) {
    return (
      <main className="flex min-h-screen w-full flex-col items-center justify-center bg-[#E7E5E1] px-4 text-center" style={{ fontFamily: FONT_STACK }}>
        <h1 className="text-2xl font-extrabold text-[#172236]">Please log in to continue</h1>
        <p className="mt-2 max-w-sm text-sm text-[#172236]/60">
          You need an account to check out. Head back to the store to sign in or create one.
        </p>
        <a href="/" className="mt-6 rounded-lg bg-[#172236] px-6 py-3 text-sm font-semibold text-white hover:bg-[#000109]">
          Back to Olaservir
        </a>
      </main>
    );
  }

  if (cart.length === 0) {
    return (
      <main className="flex min-h-screen w-full flex-col items-center justify-center bg-[#E7E5E1] px-4 text-center" style={{ fontFamily: FONT_STACK }}>
        <ShoppingBag size={40} className="text-[#172236]/40" />
        <h1 className="mt-4 text-2xl font-extrabold text-[#172236]">Your cart is empty</h1>
        <p className="mt-2 max-w-sm text-sm text-[#172236]/60">Add something to your cart before checking out.</p>
        <a href="/" className="mt-6 rounded-lg bg-[#172236] px-6 py-3 text-sm font-semibold text-white hover:bg-[#000109]">
          Continue Shopping
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-[#E7E5E1] px-4 py-10 sm:px-8" style={{ fontFamily: FONT_STACK }}>
      <Script
        src="https://js.paystack.co/v1/inline.js"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />

      <div className="mx-auto max-w-5xl">
        <a href="/" className="mb-6 flex items-center gap-2">
          <img src="/IMAGES/LOGO.png" alt="Olaservir" className="h-8 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <span className="text-xl font-extrabold tracking-tight text-[#172236]">Olaservir</span>
        </a>

        <h1 className="text-2xl font-extrabold text-[#172236] sm:text-3xl">Checkout</h1>

        <form onSubmit={handlePay} className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Delivery details */}
          <div className="rounded-2xl border border-[#E7E5E1] bg-white p-6 lg:col-span-2">
            <h2 className="text-lg font-bold text-[#172236]">Delivery Details</h2>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <input
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                placeholder="Full name"
                className="rounded-lg border border-[#E7E5E1] px-4 py-3 text-sm text-[#172236] outline-none focus:ring-2 focus:ring-[#172236]/10 sm:col-span-2"
              />
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="Phone number"
                className="rounded-lg border border-[#E7E5E1] px-4 py-3 text-sm text-[#172236] outline-none focus:ring-2 focus:ring-[#172236]/10 sm:col-span-2"
              />
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Delivery address"
                className="rounded-lg border border-[#E7E5E1] px-4 py-3 text-sm text-[#172236] outline-none focus:ring-2 focus:ring-[#172236]/10 sm:col-span-2"
              />
              <input
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="City"
                className="rounded-lg border border-[#E7E5E1] px-4 py-3 text-sm text-[#172236] outline-none focus:ring-2 focus:ring-[#172236]/10"
              />
              <input
                name="state"
                value={form.state}
                onChange={handleChange}
                placeholder="State"
                className="rounded-lg border border-[#E7E5E1] px-4 py-3 text-sm text-[#172236] outline-none focus:ring-2 focus:ring-[#172236]/10"
              />
            </div>

            <p className="mt-4 text-xs text-[#172236]/50">
              Paying as <span className="font-semibold text-[#172236]/70">{email}</span>
            </p>

            {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          </div>

          {/* Order summary */}
          <div className="h-fit rounded-2xl border border-[#E7E5E1] bg-white p-6">
            <h2 className="text-lg font-bold text-[#172236]">Order Summary</h2>

            <div className="mt-4 divide-y divide-[#E7E5E1]/70">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E7E5E1] text-[9px] text-[#172236]/40">
                      Img
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#172236]">{item.name}</p>
                      <p className="text-xs text-[#172236]/60">Qty {item.qty}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-[#172236]">{item.price}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[#E7E5E1] pt-4 text-base font-bold text-[#172236]">
              <span>Total</span>
              <span>₦{total.toLocaleString()}</span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-lg bg-[#172236] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#000109] disabled:opacity-60"
            >
              {submitting ? "Processing…" : `Pay ₦${total.toLocaleString()}`}
            </button>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#172236]/50">
              <ShieldCheck size={13} />
              Secured by Paystack
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}