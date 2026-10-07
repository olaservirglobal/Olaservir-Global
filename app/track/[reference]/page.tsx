"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { CheckCircle2, Circle, Truck, PackageCheck } from "lucide-react";

const FONT_STACK = "'Aeonik', ui-sans-serif, system-ui, -apple-system, sans-serif";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Order = {
  id: string;
  reference: string;
  user_id: string | null;
  email: string;
  full_name: string;
  total: number;
  items: { name: string; price: string; qty: number }[];
  status: "confirmed" | "shipped" | "delivered";
  created_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
};

const STEPS = [
  { key: "confirmed", label: "Order Confirmed", icon: CheckCircle2 },
  { key: "shipped", label: "Package Sent via Bolt", icon: Truck },
  { key: "delivered", label: "Package Delivered", icon: PackageCheck },
] as const;

const STATUS_ORDER = ["confirmed", "shipped", "delivered"];

// How often to check for a status change while the page is open, in milliseconds.
const POLL_INTERVAL_MS = 4000;

export default function TrackOrderPage() {
  const params = useParams<{ reference: string }>();
  const reference = params.reference;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Tracks the order's own id so the poller can stop itself once delivered.
  const statusRef = useRef<Order["status"] | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!reference) return;

    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchOrder = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("reference", reference)
        .maybeSingle();

      if (!isMounted) return;

      if (error || !data) {
        setNotFound(true);
      } else {
        setOrder(data as Order);
        setNotFound(false);
        statusRef.current = (data as Order).status;

        // Nothing more will change once delivered — stop polling.
        if ((data as Order).status === "delivered" && intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
      setLoading(false);
    };

    fetchOrder();
    intervalId = setInterval(fetchOrder, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [reference]);

  const handleConfirmDelivery = async () => {
    if (!order) return;
    setConfirming(true);

    const { data, error } = await supabase
      .from("orders")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("reference", order.reference)
      .select()
      .maybeSingle();

    setConfirming(false);

    if (!error && data) {
      setOrder(data as Order);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-[#E7E5E1]" style={{ fontFamily: FONT_STACK }}>
        <p className="text-sm text-[#172236]/60">Loading your order…</p>
      </main>
    );
  }

  if (notFound || !order) {
    return (
      <main className="flex min-h-screen w-full flex-col items-center justify-center bg-[#E7E5E1] px-4 text-center" style={{ fontFamily: FONT_STACK }}>
        <h1 className="text-2xl font-extrabold text-[#172236]">We couldn&apos;t find that order</h1>
        <p className="mt-2 max-w-sm text-sm text-[#172236]/60">
          Double check the link, or log in with the account you used to pay.
        </p>
        <a href="/" className="mt-6 rounded-lg bg-[#172236] px-6 py-3 text-sm font-semibold text-white hover:bg-[#000109]">
          Back to Olaservir
        </a>
      </main>
    );
  }

  const currentIndex = STATUS_ORDER.indexOf(order.status);
  const isOwner = currentUserId && order.user_id === currentUserId;

  return (
    <main className="min-h-screen w-full bg-[#E7E5E1] px-4 py-10 sm:px-8" style={{ fontFamily: FONT_STACK }}>
      <div className="mx-auto max-w-2xl">
        <a href="/" className="mb-6 flex items-center gap-2">
          <img src="/images/LOGO.png" alt="Olaservir" className="h-8 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <span className="text-xl font-extrabold tracking-tight text-[#172236]">Olaservir</span>
        </a>

        <div className="rounded-2xl border border-[#E7E5E1] bg-white p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#172236]/50">
            Reference: <span className="font-mono">{order.reference}</span>
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#172236]">Track Your Order</h1>

          <div className="mt-8 space-y-6">
            {STEPS.map((step, i) => {
              const done = i <= currentIndex;
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        done ? "bg-[#172236] text-white" : "bg-[#E7E5E1] text-[#172236]/40"
                      }`}
                    >
                      {done ? <Icon size={18} /> : <Circle size={18} />}
                    </span>
                    {i < STEPS.length - 1 && (
                      <span className={`mt-1 h-10 w-0.5 ${i < currentIndex ? "bg-[#172236]" : "bg-[#E7E5E1]"}`} />
                    )}
                  </div>
                  <div className="pt-1.5">
                    <p className={`text-sm font-semibold ${done ? "text-[#172236]" : "text-[#172236]/40"}`}>
                      {step.label}
                    </p>
                    {step.key === "confirmed" && (
                      <p className="text-xs text-[#172236]/50">
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                    )}
                    {step.key === "shipped" && order.shipped_at && (
                      <p className="text-xs text-[#172236]/50">{new Date(order.shipped_at).toLocaleString()}</p>
                    )}
                    {step.key === "delivered" && order.delivered_at && (
                      <p className="text-xs text-[#172236]/50">{new Date(order.delivered_at).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {order.status === "shipped" && isOwner && (
            <button
              onClick={handleConfirmDelivery}
              disabled={confirming}
              className="mt-8 w-full rounded-lg bg-[#172236] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#000109] disabled:opacity-60"
            >
              {confirming ? "Confirming…" : "I've received my package — Confirm Delivery"}
            </button>
          )}

          {order.status === "delivered" && (
            <p className="mt-8 rounded-lg bg-[#E2F4FF] px-4 py-3 text-center text-sm font-medium text-[#172236]">
              Delivered — thanks for shopping with Olaservir!
            </p>
          )}

          <div className="mt-8 border-t border-[#E7E5E1] pt-6">
            <p className="text-sm font-semibold text-[#172236]">Order Summary</p>
            <div className="mt-3 divide-y divide-[#E7E5E1]/70">
              {order.items?.map((item) => (
                <div key={item.name} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-[#172236]/80">
                    {item.name} × {item.qty}
                  </span>
                  <span className="font-medium text-[#172236]">{item.price}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-sm font-bold text-[#172236]">
              <span>Total</span>
              <span>₦{order.total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}