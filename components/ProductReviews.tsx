// Save this as: components/ProductReviews.tsx
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Star, MessageSquare } from "lucide-react";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Review = {
  id: string;
  user_id: string;
  reviewer_name: string;
  rating: number;
  comment: string;
  created_at: string;
};

type Props = {
  /** the product's real id (uuid), not its slug */
  productId: string;
};

const timeAgo = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
};

export default function ProductReviews({ productId }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const myReview = reviews.find((r) => r.user_id === userId) ?? null;

  const loadReviews = async () => {
    const { data } = await supabase
      .from("reviews")
      .select("id, user_id, reviewer_name, rating, comment, created_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    setReviews((data as Review[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
      setUserName(
        session?.user?.user_metadata?.full_name ?? session?.user?.email?.split("@")[0] ?? ""
      );
    });
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!userId) {
      setError("Please log in to leave a review.");
      return;
    }
    if (rating === 0) {
      setError("Pick a star rating.");
      return;
    }
    if (!comment.trim()) {
      setError("Write a short comment.");
      return;
    }

    setSubmitting(true);
    const { error: insertError } = await supabase.from("reviews").upsert(
      {
        product_id: productId,
        user_id: userId,
        reviewer_name: userName || "Anonymous",
        rating,
        comment: comment.trim(),
      },
      { onConflict: "product_id,user_id" }
    );
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setRating(0);
    setComment("");
    await loadReviews();
  };

  const average =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  return (
    <section className="mt-12 border-t border-[#E7E5E1] pt-10">
      <div className="mb-6 flex items-center gap-2">
        <MessageSquare size={20} className="text-[#172236]" />
        <h2 className="text-xl font-extrabold text-[#172236] sm:text-2xl">
          Reviews {reviews.length > 0 && `(${reviews.length})`}
        </h2>
      </div>

      {reviews.length > 0 && (
        <div className="mb-6 flex items-center gap-2">
          <div className="flex text-[#172236]">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={16}
                fill={i + 1 <= Math.round(average) ? "currentColor" : "none"}
                strokeWidth={1.5}
              />
            ))}
          </div>
          <span className="text-sm font-semibold text-[#172236]">{average.toFixed(1)}</span>
          <span className="text-sm text-[#172236]/60">
            based on {reviews.length} review{reviews.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {/* ---------- Write a review ---------- */}
      <div className="mb-8 rounded-2xl border border-[#E7E5E1] bg-white p-5">
        {!userId ? (
          <p className="text-sm text-[#172236]/70">
            <a href="/" className="font-semibold text-[#172236] hover:underline">
              Log in
            </a>{" "}
            to leave a review.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="mb-2 text-sm font-semibold text-[#172236]">
              {myReview ? "Update your review" : "Leave a review"}
            </p>

            <div className="mb-3 flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => {
                const value = i + 1;
                const active = (hoverRating || rating) >= value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                    onClick={() => setRating(value)}
                    onMouseEnter={() => setHoverRating(value)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="text-[#172236]"
                  >
                    <Star size={22} fill={active ? "currentColor" : "none"} strokeWidth={1.5} />
                  </button>
                );
              })}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="What did you think of this item?"
              className="w-full rounded-lg border border-[#E7E5E1] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#172236]/10"
            />

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-3 rounded-lg bg-[#172236] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#000109] disabled:opacity-60"
            >
              {submitting ? "Submitting..." : myReview ? "Update Review" : "Submit Review"}
            </button>
          </form>
        )}
      </div>

      {/* ---------- Review list ---------- */}
      {loading ? (
        <p className="text-sm text-[#172236]/50">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-[#172236]/50">No reviews yet — be the first to leave one.</p>
      ) : (
        <div className="space-y-5">
          {reviews.map((r) => (
            <div key={r.id} className="border-b border-[#E7E5E1] pb-5 last:border-b-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#172236]">{r.reviewer_name}</p>
                <span className="text-xs text-[#172236]/40">{timeAgo(r.created_at)}</span>
              </div>
              <div className="mt-1 flex text-[#172236]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={13}
                    fill={i + 1 <= r.rating ? "currentColor" : "none"}
                    strokeWidth={1.5}
                  />
                ))}
              </div>
              <p className="mt-2 text-sm text-[#172236]/80">{r.comment}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}