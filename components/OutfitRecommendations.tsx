// Save this as: components/OutfitRecommendations.tsx
"use client";

import { useEffect, useState } from "react";
import { Sparkles, ShoppingCart } from "lucide-react";

type Recommendation = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  images: string[] | null;
  reason: string;
};

type Props = {
  /** slug of the product currently being viewed */
  slug: string;
  /** optional: wire this to your cart if the product page has one */
  onAddToCart?: (product: { name: string; price: string }) => void;
};

export default function OutfitRecommendations({ slug, onAddToCart }: Props) {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        if (!cancelled) setItems(d.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Nothing to show (no other products yet) — render nothing instead of an empty box.
  if (!loading && items.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="mb-5 flex items-center gap-2">
        <Sparkles size={20} className="text-[#172236]" />
        <h2 className="text-xl font-extrabold text-[#172236] sm:text-2xl">Complete the look</h2>
        <span className="rounded-full bg-[#E2F4FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#172236]">
          AI styled
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-[#E7E5E1] bg-white">
              <div className="aspect-square w-full bg-[#E7E5E1]" />
              <div className="space-y-2 p-4">
                <div className="h-3 w-3/4 rounded bg-[#E7E5E1]" />
                <div className="h-3 w-1/2 rounded bg-[#E7E5E1]" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {items.map((p) => {
            const priceLabel = `₦${p.price.toLocaleString()}`;
            return (
              <div key={p.id} className="overflow-hidden rounded-xl border border-[#E7E5E1] bg-white">
                <a href={`/product/${p.slug}`} className="block">
                  <div className="flex aspect-square w-full items-center justify-center overflow-hidden bg-[#E7E5E1] text-xs text-[#172236]/40">
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      "Image"
                    )}
                  </div>
                  <div className="px-4 pt-4">
                    <p className="text-sm font-semibold text-[#172236]">{p.name}</p>
                    <p className="mt-1 text-sm font-bold text-[#172236]">{priceLabel}</p>
                    {p.reason && <p className="mt-1.5 text-xs italic text-[#172236]/60">{p.reason}</p>}
                  </div>
                </a>

                {onAddToCart && (
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => onAddToCart({ name: p.name, price: priceLabel })}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#172236] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#000109]"
                    >
                      <ShoppingCart size={15} />
                      Add to Cart
                    </button>
                  </div>
                )}
                {!onAddToCart && <div className="pb-4" />}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}