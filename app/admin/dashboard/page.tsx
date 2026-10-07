// Save this as: app/admin/dashboard/page.tsx

"use client";

import { useEffect, useState, type FormEvent, type ChangeEvent, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  Trash2,
  UploadCloud,
  X,
  LayoutGrid,
  ClipboardList,
  Package,
  Wallet,
  Clock,
  Truck,
  CheckCircle2,
} from "lucide-react";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// This is the client-side gate that decides who even sees this page.
// The real security is the RLS policies in your SQL (auth.uid() = seller_id) —
// this just keeps the UI from showing up for anyone but you.
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

// Forces the text you type in every field to be dark and visible.
const fieldStyle: CSSProperties = {
  color: "#172236",
  WebkitTextFillColor: "#172236",
  caretColor: "#172236",
  backgroundColor: "#ffffff",
};

type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  original_price: number | null;
  stock: number;
  sizes: string[];
  colors: string[];
  images: string[];
  created_at: string;
};

type OrderItem = { name: string; price: string; qty: number };

type Order = {
  id: string;
  reference: string;
  user_id: string | null;
  email: string;
  full_name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  items: OrderItem[];
  total: number;
  status: "confirmed" | "shipped" | "delivered";
  created_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

type Tab = "overview" | "orders" | "products";

export default function AdminDashboard() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("overview");

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [stock, setStock] = useState("");
  const [sizes, setSizes] = useState("");
  const [colors, setColors] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Gate: only the admin email gets past this. Everyone else is bounced home.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email?.toLowerCase();
      if (email && ADMIN_EMAIL && email === ADMIN_EMAIL.toLowerCase()) {
        setAuthorized(true);
        setUserId(session!.user.id);
      } else {
        router.replace("/");
      }
      setChecking(false);
    });
  }, [router]);

  const loadProducts = async () => {
    setLoadingProducts(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setProducts(data as Product[]);
    setLoadingProducts(false);
  };

  const loadOrders = async () => {
    setLoadingOrders(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setOrders(data as Order[]);
    setLoadingOrders(false);
  };

  useEffect(() => {
    if (authorized) {
      loadProducts();
      loadOrders();
    }
  }, [authorized]);

  // ---------- Orders ----------

  const handleMarkShipped = async (order: Order) => {
    setUpdatingOrderId(order.id);
    const { error } = await supabase
      .from("orders")
      .update({ status: "shipped", shipped_at: new Date().toISOString() })
      .eq("id", order.id);
    setUpdatingOrderId(null);
    if (!error) loadOrders();
  };

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const pendingOrders = orders.filter((o) => o.status === "confirmed");
  const shippedOrders = orders.filter((o) => o.status === "shipped");
  const deliveredOrders = orders.filter((o) => o.status === "delivered");

  const statusBadge = (status: Order["status"]) => {
    const map = {
      confirmed: { label: "Awaiting Shipment", classes: "bg-amber-50 text-amber-700" },
      shipped: { label: "In Transit (Bolt)", classes: "bg-blue-50 text-blue-700" },
      delivered: { label: "Completed", classes: "bg-green-50 text-green-700" },
    } as const;
    const { label, classes } = map[status];
    return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>{label}</span>;
  };

  // ---------- Products ----------

  const handleFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    setFiles(chosen);
    setPreviews(chosen.map((f) => URL.createObjectURL(f)));
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetForm = () => {
    setName("");
    setCategory("");
    setDescription("");
    setPrice("");
    setOriginalPrice("");
    setStock("");
    setSizes("");
    setColors("");
    setFiles([]);
    setPreviews([]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!name.trim() || !category.trim() || !price.trim()) {
      setFormError("Name, category, and price are required.");
      return;
    }
    if (!userId) {
      setFormError("You must be logged in.");
      return;
    }

    setSubmitting(true);

    // 1. Upload each selected photo to the product-images bucket.
    const imageUrls: string[] = [];
    for (const file of files) {
      const path = `${userId}/${Date.now()}-${slugify(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, file);

      if (uploadError) {
        setFormError(`Image upload failed: ${uploadError.message}`);
        setSubmitting(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(path);
      imageUrls.push(publicUrlData.publicUrl);
    }

    // 2. Build a unique, URL-friendly slug (used for /product/[slug] pages).
    const slug = `${slugify(name)}-${Date.now().toString(36)}`;

    // 3. Insert the row. seller_id = the logged-in admin's own id, which
    // satisfies "auth.uid() = seller_id" in your insert policy.
    const { error } = await supabase.from("products").insert({
      seller_id: userId,
      slug,
      name: name.trim(),
      category: category.trim(),
      description: description.trim() || null,
      price: Number(price),
      original_price: originalPrice ? Number(originalPrice) : null,
      stock: stock ? Number(stock) : 0,
      sizes: sizes.split(",").map((s) => s.trim()).filter(Boolean),
      colors: colors.split(",").map((c) => c.trim()).filter(Boolean),
      images: imageUrls,
    });

    setSubmitting(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    setFormSuccess("Item added — it's live on the store now.");
    resetForm();
    loadProducts();
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Delete "${product.name}"?`)) return;

    // Best-effort cleanup of its photos from storage.
    if (product.images.length > 0) {
      const paths = product.images.map((url) => {
        const marker = "/product-images/";
        const idx = url.indexOf(marker);
        return idx > -1 ? url.slice(idx + marker.length) : url;
      });
      await supabase.storage.from("product-images").remove(paths);
    }

    await supabase.from("products").delete().eq("id", product.id);
    loadProducts();
  };

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Checking access…</p>
      </main>
    );
  }

  if (!authorized) return null; // redirect already in flight

  const TABS: { key: Tab; label: string; icon: typeof LayoutGrid }[] = [
    { key: "overview", label: "Overview", icon: LayoutGrid },
    { key: "orders", label: "Orders", icon: ClipboardList },
    { key: "products", label: "Products", icon: Package },
  ];

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-extrabold text-gray-950">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your sales, orders, and product listings.</p>

        {/* Tabs */}
        <div className="mt-6 flex gap-1 rounded-xl bg-gray-100 p-1 sm:w-fit">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                tab === key ? "bg-white text-gray-950 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* ---------------- Overview tab ---------------- */}
        {tab === "overview" && (
          <div className="mt-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="flex items-center gap-2 text-gray-400">
                  <Wallet size={16} />
                  <p className="text-xs font-semibold uppercase tracking-wide">Total Sold</p>
                </div>
                <p className="mt-2 text-2xl font-extrabold text-gray-950">₦{totalRevenue.toLocaleString()}</p>
                <p className="mt-1 text-xs text-gray-500">Across {orders.length} order{orders.length === 1 ? "" : "s"}</p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="flex items-center gap-2 text-amber-500">
                  <Clock size={16} />
                  <p className="text-xs font-semibold uppercase tracking-wide">Awaiting Shipment</p>
                </div>
                <p className="mt-2 text-2xl font-extrabold text-gray-950">{pendingOrders.length}</p>
                <p className="mt-1 text-xs text-gray-500">Orders paid, ready to send</p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="flex items-center gap-2 text-blue-500">
                  <Truck size={16} />
                  <p className="text-xs font-semibold uppercase tracking-wide">In Transit</p>
                </div>
                <p className="mt-2 text-2xl font-extrabold text-gray-950">{shippedOrders.length}</p>
                <p className="mt-1 text-xs text-gray-500">Sent via Bolt, not yet confirmed</p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle2 size={16} />
                  <p className="text-xs font-semibold uppercase tracking-wide">Completed</p>
                </div>
                <p className="mt-2 text-2xl font-extrabold text-gray-950">{deliveredOrders.length}</p>
                <p className="mt-1 text-xs text-gray-500">Delivered and confirmed by buyer</p>
              </div>
            </div>

            {pendingOrders.length > 0 && (
              <div className="mt-8 rounded-2xl border border-amber-100 bg-amber-50 p-5">
                <p className="text-sm font-semibold text-amber-800">
                  You have {pendingOrders.length} order{pendingOrders.length === 1 ? "" : "s"} waiting to be shipped.
                </p>
                <button
                  onClick={() => setTab("orders")}
                  className="mt-2 text-sm font-semibold text-amber-900 underline hover:no-underline"
                >
                  View them in the Orders tab →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---------------- Orders tab ---------------- */}
        {tab === "orders" && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-gray-950">Orders ({orders.length})</h2>

            {loadingOrders ? (
              <p className="mt-3 text-sm text-gray-500">Loading…</p>
            ) : orders.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No orders yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {orders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-gray-100 bg-white p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-950">{order.full_name}</p>
                        <p className="text-xs text-gray-500">{order.email} · {order.phone}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {order.address}, {order.city}, {order.state}
                        </p>
                      </div>
                      <div className="text-right">
                        {statusBadge(order.status)}
                        <p className="mt-1 font-mono text-xs text-gray-400">{order.reference}</p>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <p className="text-xs text-gray-500">
                        {order.items?.map((item) => `${item.name} × ${item.qty}`).join(", ")}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-950">₦{Number(order.total).toLocaleString()}</p>

                        {order.status === "confirmed" && (
                          <button
                            onClick={() => handleMarkShipped(order)}
                            disabled={updatingOrderId === order.id}
                            className="rounded-lg bg-gray-950 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-60"
                          >
                            {updatingOrderId === order.id ? "Updating…" : "Mark as Shipped via Bolt"}
                          </button>
                        )}

                        {order.status === "shipped" && (
                          <p className="text-xs text-gray-400">Waiting for buyer to confirm delivery</p>
                        )}

                        {order.status === "delivered" && (
                          <p className="text-xs text-green-600">Transaction complete</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------------- Products tab ---------------- */}
        {tab === "products" && (
          <div className="mt-8">
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 gap-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:grid-cols-2"
            >
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Item name *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                  style={fieldStyle}
                  placeholder="Linen Shirt"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Category *</label>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                  style={fieldStyle}
                  placeholder="Shirts"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Stock</label>
                <input
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  type="number"
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                  style={fieldStyle}
                  placeholder="25"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Price (₦) *</label>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  type="number"
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                  style={fieldStyle}
                  placeholder="28000"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Original price</label>
                <input
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  type="number"
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                  style={fieldStyle}
                  placeholder="35000"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Sizes (comma-separated)</label>
                <input
                  value={sizes}
                  onChange={(e) => setSizes(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                  style={fieldStyle}
                  placeholder="S, M, L, XL"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Colors (comma-separated)</label>
                <input
                  value={colors}
                  onChange={(e) => setColors(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                  style={fieldStyle}
                  placeholder="Black, Navy, White"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                  style={fieldStyle}
                  placeholder="Short product description..."
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Photos</label>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 px-4 py-8 text-sm text-gray-500 hover:border-gray-300">
                  <UploadCloud size={22} />
                  Click to select images
                  <input type="file" accept="image/*" multiple onChange={handleFilesChange} className="hidden" />
                </label>

                {previews.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {previews.map((src, i) => (
                      <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-gray-100">
                        <img src={src} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-950/70 text-white"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {formError && <p className="text-sm text-red-600 sm:col-span-2">{formError}</p>}
              {formSuccess && <p className="text-sm text-green-600 sm:col-span-2">{formSuccess}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-amber-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60 sm:col-span-2 sm:w-fit"
              >
                {submitting ? "Uploading…" : "Add Item"}
              </button>
            </form>

            <div className="mt-10">
              <h2 className="text-lg font-bold text-gray-950">Current items ({products.length})</h2>
              {loadingProducts ? (
                <p className="mt-3 text-sm text-gray-500">Loading…</p>
              ) : products.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">No items yet.</p>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {products.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                        {p.images[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-950">{p.name}</p>
                        <p className="text-xs text-gray-500">
                          ₦{p.price.toLocaleString()} · {p.stock} in stock
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(p)}
                        className="text-gray-400 hover:text-red-500"
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}