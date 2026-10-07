// Save this as: app/seller/new-listing/page.tsx

"use client";

import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { ChevronLeft, UploadCloud, X, CheckCircle2 } from "lucide-react";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CATEGORY_OPTIONS = ["Shirts", "Trousers", "Glasses", "Watches", "Hats", "Socks"];
const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL"];

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function NewListingPage() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [stock, setStock] = useState("");
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [colorInput, setColorInput] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Set once a listing successfully publishes — swaps the form out for a
  // confirmation screen instead of silently redirecting the person away.
  const [justPublished, setJustPublished] = useState<{ slug: string; name: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
      setCheckingAuth(false);
    });
  }, []);

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const addColor = () => {
    const value = colorInput.trim();
    if (!value) return;
    if (!colors.includes(value)) setColors((prev) => [...prev, value]);
    setColorInput("");
  };

  const removeColor = (c: string) => setColors((prev) => prev.filter((x) => x !== c));

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const combined = [...imageFiles, ...files].slice(0, 6);
    setImageFiles(combined);
    setImagePreviews(combined.map((f) => URL.createObjectURL(f)));
  };

  const removeImage = (idx: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetForm = () => {
    setName("");
    setCategory(CATEGORY_OPTIONS[0]);
    setDescription("");
    setPrice("");
    setOriginalPrice("");
    setStock("");
    setSelectedSizes([]);
    setColors([]);
    setImageFiles([]);
    setImagePreviews([]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!userId) {
      setError("You need to be logged in to list an item.");
      return;
    }
    if (!name.trim() || !price.trim() || !stock.trim()) {
      setError("Name, price, and stock are required.");
      return;
    }
    if (selectedSizes.length === 0) {
      setError("Select at least one size.");
      return;
    }
    if (imageFiles.length === 0) {
      setError("Add at least one product photo.");
      return;
    }

    setError("");
    setSubmitting(true);

    const imageUrls: string[] = [];
    for (const file of imageFiles) {
      const path = `${userId}/${Date.now()}-${slugify(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, file);

      if (uploadError) {
        setError(`Image upload failed: ${uploadError.message}`);
        setSubmitting(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(path);
      imageUrls.push(publicUrlData.publicUrl);
    }

    const slug = `${slugify(name)}-${Date.now().toString(36)}`;
    const publishedName = name.trim();

    const { error: insertError } = await supabase.from("products").insert({
      seller_id: userId,
      slug,
      name: publishedName,
      category,
      description: description.trim() || null,
      price: Number(price.replace(/,/g, "")),
      original_price: originalPrice.trim()
        ? Number(originalPrice.replace(/,/g, ""))
        : null,
      stock: Number(stock) || 0,
      sizes: selectedSizes,
      colors,
      images: imageUrls,
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    resetForm();
    setJustPublished({ slug, name: publishedName });
  };

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-500">Loading…</p>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-100 px-4 text-center">
        <p className="text-lg font-semibold text-gray-950">
          You need to be logged in to list an item.
        </p>
        <a
          href="/"
          className="rounded-lg bg-amber-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
        >
          Back to store
        </a>
      </main>
    );
  }

  // ---- Success screen, shown right after a listing publishes ----
  if (justPublished) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-100 px-4 text-center">
        <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600">
            <CheckCircle2 size={28} />
          </div>
          <h1 className="mt-4 text-xl font-extrabold text-gray-950">
            &quot;{justPublished.name}&quot; is live
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Your listing has been published and now shows up on the store.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href="/"
              className="flex-1 rounded-lg bg-gray-950 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
            >
              Back to Home
            </a>
            <a
              href={`/product/${justPublished.slug}`}
              className="flex-1 rounded-lg border border-gray-200 py-3 text-sm font-semibold text-gray-950 transition-colors hover:bg-gray-50"
            >
              View Listing
            </a>
          </div>

          <button
            onClick={() => setJustPublished(null)}
            className="mt-4 text-sm font-medium text-gray-500 hover:text-gray-950"
          >
            List another item
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-gray-100">
      <div className="mx-auto max-w-[1000px] bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-4 sm:px-10">
          <a href="/" className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-950">
            <ChevronLeft size={16} />
            Back to store
          </a>
        </div>

        <div className="px-6 py-10 sm:px-10">
          <h1 className="text-2xl font-extrabold text-gray-950">List a new item</h1>
          <p className="mt-1 text-sm text-gray-500">
            Fill in the details below — this saves straight to your live product catalog.
          </p>

          {error && (
            <p className="mt-6 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Product Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Linen Shirt"
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="What makes this item worth buying?"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-950/10"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Price (₦)</label>
                <input
                  type="text"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="28000"
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Original Price <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  placeholder="35000"
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Stock Quantity</label>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="24"
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Sizes Available</label>
              <div className="flex flex-wrap gap-2">
                {SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => toggleSize(size)}
                    className={`h-9 min-w-9 rounded-lg border px-3 text-sm font-medium transition-colors ${
                      selectedSizes.includes(size)
                        ? "border-gray-950 bg-gray-950 text-white"
                        : "border-gray-200 text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Colors <span className="text-gray-400">(optional)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={colorInput}
                  onChange={(e) => setColorInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addColor();
                    }
                  }}
                  placeholder="e.g. Olive — press Enter to add"
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                />
                <button
                  type="button"
                  onClick={addColor}
                  className="rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Add
                </button>
              </div>
              {colors.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <span
                      key={c}
                      className="flex items-center gap-1.5 rounded-full bg-gray-100 py-1.5 pl-3 pr-2 text-xs font-medium text-gray-700"
                    >
                      {c}
                      <button type="button" onClick={() => removeColor(c)} aria-label={`Remove ${c}`}>
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Product Photos</label>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-8 text-gray-500 hover:border-gray-400">
                <UploadCloud size={22} />
                <span className="text-sm">Click to upload photos (up to 6)</span>
                <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
              </label>

              {imagePreviews.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {imagePreviews.map((url, i) => (
                    <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-100">
                      <img src={url} alt="Preview" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-amber-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60 sm:w-auto sm:px-8"
            >
              {submitting ? "Publishing…" : "Publish Listing"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}