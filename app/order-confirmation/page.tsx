"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

const FONT_STACK = "'Aeonik', ui-sans-serif, system-ui, -apple-system, sans-serif";

// Reads ?ref=... from the URL. It lives in its own component so the page can
// wrap it in <Suspense>, which Next.js requires for useSearchParams() during build.
function OrderReference() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("ref");

  if (!reference) return null;

  return (
    <p className="mt-4 rounded-lg bg-[#E7E5E1] px-4 py-2 text-sm text-[#172236]/80">
      Reference: <span className="font-mono">{reference}</span>
    </p>
  );
}

export default function OrderConfirmationPage() {
  return (
    <main
      className="flex min-h-screen w-full flex-col items-center justify-center bg-[#E7E5E1] px-4 py-24 text-center"
      style={{ fontFamily: FONT_STACK }}
    >
      <div className="w-full max-w-md rounded-2xl border border-[#E7E5E1] bg-white p-10">
        <CheckCircle2 size={52} className="mx-auto text-[#172236]" />
        <h1 className="mt-6 text-2xl font-extrabold text-[#172236]">Order Confirmed</h1>
        <p className="mt-2 text-sm text-[#172236]/60">
          Thanks for shopping with Olaservir! We&apos;ve received your payment and will start
          processing your order right away.
        </p>

        <Suspense fallback={null}>
          <OrderReference />
        </Suspense>

        <a
          href="/"
          className="mt-8 inline-block rounded-lg bg-[#172236] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#000109]"
        >
          Continue Shopping
        </a>
      </div>
    </main>
  );
}