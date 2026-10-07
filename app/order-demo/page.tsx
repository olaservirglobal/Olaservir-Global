// Save this as: app/order-demo/page.tsx
// One self-contained page: no other files, no database, no login. Open /order-demo
//
// Palette:  ice #E2F4FF · navy #172236 · snow #FAFBFD · ink #000109 · sand #E7E5E1

"use client";

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { Check, ChevronLeft, Package, Send } from "lucide-react";

const ORDER_NO = 4913;

const STEPS = [
  { title: "Order placed", desc: `Your order #${ORDER_NO} was placed for delivery.` },
  { title: "Pending", desc: "We've received your payment and are reviewing your order." },
  { title: "Confirmed", desc: "Your order is confirmed. We'll start preparing it soon." },
  { title: "Processing", desc: "Your order is being packed and prepared for delivery." },
  { title: "Delivered", desc: "Your order has been delivered." },
];

const ADMIN_ACTIONS: Record<number, string> = {
  1: "Confirm order",
  2: "Start processing",
  3: "Mark as delivered",
};

const ITEMS = [
  { name: "Linen Shirt", qty: 1, price: 28000 },
  { name: "Chino Trousers", qty: 2, price: 22000 },
];
const TOTAL = ITEMS.reduce((sum, i) => sum + i.qty * i.price, 0);

type Msg = { id: number; from: "user" | "admin"; body: string; time: string };

const now = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const naira = (n: number) => `₦${n.toLocaleString()}`;

const inputCls =
  "min-w-0 flex-1 rounded-lg border border-[#E7E5E1] bg-[#FAFBFD] px-4 py-2.5 text-sm text-[#000109] placeholder:text-[#172236]/40 focus:outline-none focus:ring-2 focus:ring-[#172236]/20";

function Thread({
  messages,
  me,
  endRef,
}: {
  messages: Msg[];
  me: "user" | "admin";
  endRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="max-h-60 space-y-2 overflow-y-auto">
      {messages.length === 0 && <p className="py-4 text-center text-xs text-[#172236]/50">No messages yet.</p>}
      {messages.map((m) => {
        const mine = m.from === me;
        return (
          <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                mine
                  ? "rounded-br-sm bg-[#172236] text-[#FAFBFD]"
                  : "rounded-bl-sm bg-[#E2F4FF] text-[#000109]"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={`mt-0.5 text-[10px] ${mine ? "text-[#E2F4FF]/70" : "text-[#172236]/50"}`}>
                {mine ? "You" : me === "user" ? "Store" : "Customer"} · {m.time}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

export default function OrderDemo() {
  const [splash, setSplash] = useState<"show" | "fade" | "gone">("show");
  const [barGo, setBarGo] = useState(false);

  const [step, setStep] = useState(1); // index of the current step
  const [cancelled, setCancelled] = useState(false);
  const [times, setTimes] = useState<string[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [customerDraft, setCustomerDraft] = useState("");
  const [adminDraft, setAdminDraft] = useState("");
  const customerEnd = useRef<HTMLDivElement>(null);
  const adminEnd = useRef<HTMLDivElement>(null);

  // Intro overlay: shows for ~1.8s, fades out, then unmounts. Tap it to skip.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setBarGo(true));
    const a = setTimeout(() => setSplash("fade"), 1800);
    const b = setTimeout(() => setSplash("gone"), 2400);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  // Times are set after mount to avoid a server/client mismatch.
  useEffect(() => {
    setTimes([now(), now()]);
  }, []);

  useEffect(() => {
    customerEnd.current?.scrollIntoView({ behavior: "smooth" });
    adminEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const advance = () => {
    const next = step + 1;
    setStep(next);
    setTimes((t) => {
      const copy = [...t];
      copy[next] = now();
      return copy;
    });
  };

  const reset = () => {
    setStep(1);
    setCancelled(false);
    setTimes([now(), now()]);
    setMessages([]);
  };

  const send = (from: "user" | "admin", body: string) =>
    setMessages((m) => [...m, { id: Date.now() + m.length, from, body, time: now() }]);

  const submitCustomer = (e: FormEvent) => {
    e.preventDefault();
    if (!customerDraft.trim()) return;
    send("user", customerDraft.trim());
    setCustomerDraft("");
  };
  const submitAdmin = (e: FormEvent) => {
    e.preventDefault();
    if (!adminDraft.trim()) return;
    send("admin", adminDraft.trim());
    setAdminDraft("");
  };

  const statusBadge = cancelled
    ? "bg-[#E7E5E1] text-[#000109]"
    : step === 4
    ? "bg-[#172236] text-[#FAFBFD]"
    : step === 1
    ? "bg-[#E7E5E1] text-[#172236]"
    : "bg-[#E2F4FF] text-[#172236]";

  return (
    <main className="min-h-screen bg-[#E7E5E1] px-4 py-10 sm:px-8">
      {/* ============ INTRO OVERLAY ============ */}
      {splash !== "gone" && (
        <div
          onClick={() => setSplash("fade")}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#172236]/95 backdrop-blur-md transition-opacity duration-500 ${
            splash === "fade" ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <p className="flex items-baseline gap-3 text-3xl text-[#FAFBFD] sm:text-4xl">
            <span className="font-semibold tracking-tight">olasievr</span>
            <span className="text-xl font-light text-[#E2F4FF]/70">×</span>
            <span className="font-extrabold tracking-wide">BOLT</span>
          </p>
          <div className="mt-6 h-0.5 w-40 overflow-hidden rounded-full bg-[#FAFBFD]/15">
            <div
              className={`h-full bg-[#E2F4FF] transition-[width] duration-[1800ms] ease-out ${
                barGo ? "w-full" : "w-0"
              }`}
            />
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 lg:grid-cols-[minmax(0,26rem)_1fr]">
        {/* ============ CUSTOMER VIEW ============ */}
        <div>
          <p className="mb-2 text-sm font-medium text-[#172236]/60">What the customer sees</p>
          <div className="overflow-hidden rounded-3xl bg-[#172236]">
            <header className="relative flex items-center justify-center px-5 pb-10 pt-6 text-[#FAFBFD]">
              <ChevronLeft size={24} className="absolute left-4 top-1/2 -translate-y-1/2 pb-2" />
              <h1 className="text-base font-bold">Order details</h1>
            </header>

            <div className="-mt-5 rounded-t-[2rem] bg-[#FAFBFD] px-5 pb-8 pt-8">
              {cancelled && (
                <p className="mb-6 rounded-lg bg-[#E7E5E1] px-4 py-3 text-sm text-[#000109]">
                  This order was cancelled. Send a message below if you have questions.
                </p>
              )}

              <ol>
                {STEPS.map((s, i) => {
                  const reached = !cancelled && i <= step;
                  const lineReached = !cancelled && i < step;
                  const current = !cancelled && i === step;
                  const last = i === STEPS.length - 1;
                  return (
                    <li key={s.title} className="flex gap-3">
                      <div className="w-[4.25rem] shrink-0 pt-3 text-xs font-bold text-[#000109]">
                        {reached ? times[i] : ""}
                      </div>
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${
                            reached ? "bg-[#172236] text-[#E2F4FF]" : "bg-[#E7E5E1]"
                          } ${current ? "ring-4 ring-[#E2F4FF]" : ""}`}
                        >
                          {reached && <Check size={18} strokeWidth={3} />}
                        </div>
                        {!last && (
                          <span
                            className={`w-0.5 flex-1 transition-colors duration-300 ${
                              lineReached ? "bg-[#172236]" : "bg-[#E7E5E1]"
                            }`}
                          />
                        )}
                      </div>
                      <div className={`min-w-0 flex-1 ${last ? "" : "pb-8"}`}>
                        <p className="pt-2.5 text-sm font-bold text-[#000109]">{s.title}</p>
                        <p className="mt-1.5 text-xs leading-relaxed text-[#172236]/60">{s.desc}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <section className="mt-10 rounded-2xl bg-[#172236] p-4 text-[#FAFBFD]">
                <h2 className="text-lg font-bold">Description</h2>
                <ul className="mt-3 space-y-3">
                  {ITEMS.map((item) => (
                    <li key={item.name} className="flex items-center gap-3 rounded-xl bg-[#FAFBFD] p-2.5">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#E2F4FF] text-[#172236]">
                        <Package size={22} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#000109]">
                          {item.name}
                          {item.qty > 1 && <span className="font-medium text-[#172236]/60"> × {item.qty}</span>}
                        </p>
                        <p className="mt-0.5 flex items-center gap-2 text-sm font-bold text-[#000109]">
                          {naira(item.price * item.qty)}
                          <span className="rounded-full bg-[#E2F4FF] px-2 py-0.5 text-[11px] font-medium text-[#172236]">
                            Paid
                          </span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex justify-between text-sm font-semibold">
                  <span>Total</span>
                  <span>{naira(TOTAL)}</span>
                </p>
              </section>

              <section className="mt-6 rounded-2xl border border-[#E7E5E1] p-4">
                <h2 className="text-sm font-bold text-[#000109]">Message the store</h2>
                <p className="mt-0.5 text-xs text-[#172236]/60">
                  Questions about delivery, sizes or changes? Send them here.
                </p>
                <div className="mt-3">
                  <Thread messages={messages} me="user" endRef={customerEnd} />
                </div>
                <form onSubmit={submitCustomer} className="mt-3 flex gap-2">
                  <input
                    value={customerDraft}
                    onChange={(e) => setCustomerDraft(e.target.value)}
                    placeholder="Type a message…"
                    className={inputCls}
                  />
                  <button
                    type="submit"
                    disabled={!customerDraft.trim()}
                    aria-label="Send message"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#172236] text-[#FAFBFD] transition-colors hover:bg-[#000109] disabled:opacity-40"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </section>

              <p className="mt-6 text-center text-xs text-[#172236]/50">
                <span className="font-semibold">olasievr</span> × <span className="font-bold">BOLT</span>
              </p>
            </div>
          </div>
        </div>

        {/* ============ ADMIN VIEW ============ */}
        <div className="lg:pt-7">
          <p className="mb-2 text-sm font-medium text-[#172236]/60">What you see as admin</p>
          <div className="rounded-2xl bg-[#FAFBFD] p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-[#000109]">Order #{ORDER_NO}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge}`}>
                {cancelled ? "Cancelled" : STEPS[step].title}
              </span>
            </div>

            <ul className="mt-4 space-y-1.5 text-sm text-[#172236]">
              {ITEMS.map((i) => (
                <li key={i.name} className="flex justify-between gap-3">
                  <span>
                    {i.name} × {i.qty}
                  </span>
                  <span>{naira(i.price * i.qty)}</span>
                </li>
              ))}
              <li className="flex justify-between border-t border-[#E7E5E1] pt-2 font-semibold text-[#000109]">
                <span>Total (paid)</span>
                <span>{naira(TOTAL)}</span>
              </li>
            </ul>
            <p className="mt-3 text-xs text-[#172236]/60">
              Demo Customer · 0801 234 5678 · 12 Admiralty Way, Lekki, Lagos
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {!cancelled && ADMIN_ACTIONS[step] && (
                <button
                  onClick={advance}
                  className="rounded-lg bg-[#172236] px-4 py-2 text-sm font-semibold text-[#FAFBFD] transition-colors hover:bg-[#000109]"
                >
                  {ADMIN_ACTIONS[step]}
                </button>
              )}
              {!cancelled && step < 4 && (
                <button
                  onClick={() => confirm(`Cancel order #${ORDER_NO}?`) && setCancelled(true)}
                  className="rounded-lg border border-[#E7E5E1] px-4 py-2 text-sm font-medium text-[#172236] transition-colors hover:border-[#172236]"
                >
                  Cancel order
                </button>
              )}
              <button onClick={reset} className="ml-auto text-xs text-[#172236]/50 hover:text-[#000109]">
                Reset demo
              </button>
            </div>

            <div className="mt-5 rounded-xl bg-[#E7E5E1]/40 p-3">
              <Thread messages={messages} me="admin" endRef={adminEnd} />
              <form onSubmit={submitAdmin} className="mt-3 flex gap-2">
                <input
                  value={adminDraft}
                  onChange={(e) => setAdminDraft(e.target.value)}
                  placeholder="Reply to customer…"
                  className={inputCls}
                />
                <button
                  type="submit"
                  disabled={!adminDraft.trim()}
                  aria-label="Send reply"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#172236] text-[#FAFBFD] transition-colors hover:bg-[#000109] disabled:opacity-40"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}