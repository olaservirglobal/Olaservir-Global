"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  ShoppingCart,
  Star,
  ShieldCheck,
  Truck,
  RotateCcw,
  BadgeCheck,
} from "lucide-react";
import OutfitRecommendations from "@/components/OutfitRecommendations";
import ProductReviews from "@/components/ProductReviews";
import { addItemToCart } from "@/lib/cart";
// ^ adjust these paths if your project doesn't use the "@/" alias

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ---------------------------------------------------------------------------
// Adjust these field names if your "products" table uses different column
// names — this reads whatever Olamide filled in on the listing form.
// ---------------------------------------------------------------------------
type ProductRow = {
  id: string;
  slug: string;
  name: string;
  price: number;
  original_price?: number | null;
  category?: string | null;
  description?: string | null;
  sizes?: string[] | null;
  colors?: { name: string; hex?: string }[] | null;
  stock?: number | null;
  images?: string[] | null;
  rating?: number | null;
  reviews_count?: number | null;
  created_at?: string;
};

const naira = (n: number) => `₦${n.toLocaleString()}`;

export default function ProductPage() {
  const params = useParams();
  const slug = (params?.slug as string) ?? "";

  const [product, setProduct] = useState<ProductRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [activeImage, setActiveImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [liked, setLiked] = useState(false);
  // Now holds the confirmation text itself (or null when hidden), so both the
  // main "Add to Cart" button and the AI recommendation cards below can show
  // the same banner instead of each needing their own copy of this state.
  const [addedMessage, setAddedMessage] = useState<string | null>(null);

  // Who (if anyone) is logged in, so Add to Cart knows whether to save to
  // their account cart in Supabase or this browser's guest cart.
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!slug) return;

    const load = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error || !data) {
        console.error("Product fetch failed:", error?.message, error?.code, error?.details);
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProduct(data as ProductRow);
      setSelectedSize(data.sizes?.[0] ?? "");
      setSelectedColor(data.colors?.[0]?.name ?? "");
      setLoading(false);
    };

    load();
  }, [slug]);

  const showAddedMessage = (text: string) => {
    setAddedMessage(text);
    setTimeout(() => setAddedMessage(null), 2000);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-[#E7E5E1]">
        <p className="text-sm text-[#172236]/50">Loading product...</p>
      </main>
    );
  }

  if (notFound || !product) {
    return (
      <main className="flex min-h-screen w-full flex-col items-center justify-center gap-3 bg-[#E7E5E1] px-4 text-center">
        <p className="text-lg font-semibold text-[#172236]">Product not found</p>
        <a href="/" className="text-sm font-medium text-[#172236]/70 hover:text-[#172236]">
          ← Back to store
        </a>
      </main>
    );
  }

  const images = product.images?.length ? product.images : [];
  const hasDiscount =
    product.original_price && product.original_price > product.price;

  const specs: { label: string; value: string }[] = [
    product.category ? { label: "Category", value: product.category } : null,
    product.sizes?.length ? { label: "Sizes Available", value: product.sizes.join(", ") } : null,
    product.colors?.length ? { label: "Colors", value: product.colors.map((c) => c.name).join(", ") } : null,
    { label: "Stock", value: product.stock && product.stock > 0 ? `${product.stock} available` : "Out of stock" },
    { label: "Sold By", value: "Olaservir" },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <main className="min-h-screen w-full bg-[#E7E5E1]">
      <div className="mx-auto max-w-[1280px] bg-[#FAFBFD] shadow-sm">
        {/* Top bar */}
        <div className="flex items-center gap-2 border-b border-[#E7E5E1] px-6 py-4 sm:px-10">
          <a href="/" className="flex items-center gap-1 text-sm font-medium text-[#172236]/70 hover:text-[#172236]">
            <ChevronLeft size={16} />
            Back to store
          </a>
        </div>

        <div className="grid grid-cols-1 gap-8 px-6 py-8 sm:px-10 lg:grid-cols-[1fr_360px] lg:px-12">
          {/* ---------- Left: image gallery + details ---------- */}
          <div>
            {/* Main image */}
            <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl bg-[#E7E5E1]">
              {images.length > 0 ? (
                <img
                  src={images[activeImage]}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm text-[#172236]/40">No image available</span>
              )}

              {images.length > 1 && (
                <>
                  <button
                    aria-label="Previous image"
                    onClick={() => setActiveImage((i) => (i === 0 ? images.length - 1 : i - 1))}
                    className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#172236] shadow-sm hover:bg-white"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    aria-label="Next image"
                    onClick={() => setActiveImage((i) => (i === images.length - 1 ? 0 : i + 1))}
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#172236] shadow-sm hover:bg-white"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <span className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
                    {activeImage + 1}/{images.length}
                  </span>
                </>
              )}
            </div>

            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-3 sm:grid-cols-6">
                {images.map((img, i) => (
                  <button
                    key={img + i}
                    onClick={() => setActiveImage(i)}
                    className={`aspect-square overflow-hidden rounded-lg border-2 ${
                      activeImage === i ? "border-[#172236]" : "border-transparent"
                    }`}
                  >
                    <img src={img} alt={`${product.name} ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Title + rating */}
            <div className="mt-6">
              <h1 className="text-2xl font-extrabold text-[#172236] sm:text-3xl">{product.name}</h1>

              <div className="mt-2 flex items-center gap-2">
                <div className="flex text-[#172236]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={15}
                      fill={i + 1 <= Math.round(product.rating ?? 0) ? "currentColor" : "none"}
                      strokeWidth={1.5}
                    />
                  ))}
                </div>
                <span className="text-sm text-[#172236]/60">
                  {product.rating ?? 0} ({product.reviews_count ?? 0} reviews)
                </span>
              </div>
            </div>

            {/* Specs grid — mirrors Jiji's Make / Model / Year / Color layout */}
            <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-[#E7E5E1] pt-6 sm:grid-cols-3">
              {specs.map((spec) => (
                <div key={spec.label}>
                  <p className="text-sm font-medium text-[#172236]">{spec.value}</p>
                  <p className="text-xs uppercase tracking-wide text-[#172236]/50">{spec.label}</p>
                </div>
              ))}
            </div>

            {/* Description */}
            {product.description && (
              <div className="mt-6 border-t border-[#E7E5E1] pt-6">
                <p className="text-sm leading-relaxed text-[#172236]/80">{product.description}</p>
              </div>
            )}

            {/* ---------- AI outfit recommendations ---------- */}
            <OutfitRecommendations
              slug={product.slug}
              onAddToCart={(item) => showAddedMessage(`Added ${item.name} to your cart.`)}
            />

            {/* ---------- Reviews ---------- */}
            <ProductReviews productId={product.id} />
          </div>

          {/* ---------- Right: sticky price / action panel ---------- */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-[#E7E5E1] bg-white p-5">
              <p className="text-2xl font-extrabold text-[#172236]">{naira(product.price)}</p>
              {hasDiscount && (
                <p className="mt-1 text-sm text-[#172236]/40 line-through">
                  {naira(product.original_price!)}
                </p>
              )}

              {/* Size selector */}
              {product.sizes && product.sizes.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-sm font-semibold text-[#172236]">Size</p>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`h-9 min-w-9 rounded-lg border px-3 text-sm font-medium ${
                          selectedSize === size
                            ? "border-[#172236] bg-[#172236] text-white"
                            : "border-[#E7E5E1] text-[#172236]/70 hover:border-[#172236]/40"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Color selector */}
              {product.colors && product.colors.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-semibold text-[#172236]">
                    Color {selectedColor && <span className="font-normal text-[#172236]/50">— {selectedColor}</span>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {product.colors.map((color) =>
                      color.hex ? (
                        <button
                          key={color.name}
                          onClick={() => setSelectedColor(color.name)}
                          aria-label={color.name}
                          style={{ backgroundColor: color.hex }}
                          className={`h-8 w-8 rounded-full border-2 ${
                            selectedColor === color.name ? "border-[#172236]" : "border-white shadow-sm"
                          }`}
                        />
                      ) : (
                        <button
                          key={color.name}
                          onClick={() => setSelectedColor(color.name)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                            selectedColor === color.name
                              ? "border-[#172236] bg-[#172236] text-white"
                              : "border-[#E7E5E1] text-[#172236]/70"
                          }`}
                        >
                          {color.name}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div className="mt-5 flex items-center gap-3">
                <div className="flex items-center rounded-lg border border-[#E7E5E1]">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex h-10 w-10 items-center justify-center text-lg text-[#172236]/70 hover:text-[#172236]"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-semibold text-[#172236]">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(product.stock ?? 99, q + 1))}
                    className="flex h-10 w-10 items-center justify-center text-lg text-[#172236]/70 hover:text-[#172236]"
                  >
                    +
                  </button>
                </div>

                <button
                  aria-label="Add to wishlist"
                  onClick={() => setLiked((l) => !l)}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                    liked ? "border-red-200 text-red-500" : "border-[#E7E5E1] text-[#172236]"
                  }`}
                >
                  <Heart size={18} fill={liked ? "currentColor" : "none"} />
                </button>
              </div>

              {/* Primary actions — the equivalent slot to Jiji's "Show contact" / "Make an offer" */}
              <button
                onClick={async () => {
                  await addItemToCart(supabase, userId, { id: product.id, name: product.name, price: naira(product.price) }, quantity);
                  showAddedMessage(`Added ${quantity} × ${product.name} to your cart.`);
                }}
                disabled={!product.stock || product.stock <= 0}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#172236] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#000109] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShoppingCart size={16} />
                {product.stock && product.stock > 0 ? "Add to Cart" : "Out of Stock"}
              </button>

              {addedMessage && (
                <p className="mt-2 text-center text-sm font-medium text-green-600">
                  {addedMessage}
                </p>
              )}

              {/* Sold-by trust card — the equivalent slot to Jiji's seller profile card */}
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#E7E5E1] p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E2F4FF] text-[#172236]">
                  <BadgeCheck size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#172236]">Olaservir</p>
                  <p className="text-xs text-[#172236]/50">Official Store</p>
                </div>
              </div>
            </div>

            {/* Safety / trust tips box — the equivalent slot to Jiji's "Safety tips" */}
            <div className="mt-4 rounded-2xl border border-[#E7E5E1] bg-white p-5">
              <p className="mb-3 text-sm font-semibold text-[#172236]">Why shop with us</p>
              <ul className="space-y-2.5 text-sm text-[#172236]/70">
                <li className="flex items-center gap-2">
                  <Truck size={15} />
                  Fast, reliable delivery
                </li>
                <li className="flex items-center gap-2">
                  <RotateCcw size={15} />
                  7-day return policy
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck size={15} />
                  100% secure checkout
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}