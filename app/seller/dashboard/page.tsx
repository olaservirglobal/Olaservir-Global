"use client";

import { useState } from "react";
import {
  ChevronLeft,
  Wallet,
  ShoppingBag,
  Package,
  AlertTriangle,
  Pencil,
  Trash2,
  Check,
  X,
  Plus,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Demo data — once Supabase is wired in:
//  - SELLER_PRODUCTS  → supabase.from("products").select("*").eq("seller_id", user.id)
//  - RECENT_ORDERS    → supabase.from("order_items").select("*, orders(*)").eq("seller_id", user.id)
//  - REVENUE_LAST_7   → an aggregate query (or a Postgres view) grouped by day
// ---------------------------------------------------------------------------
type SellerProduct = {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: "Active" | "Out of Stock";
};

const INITIAL_PRODUCTS: SellerProduct[] = [
  { id: 1, name: "Linen Shirt", category: "Shirts", price: 28000, stock: 24, status: "Active" },
  { id: 2, name: "Tailored Trousers", category: "Trousers", price: 42500, stock: 12, status: "Active" },
  { id: 3, name: "Modern Hat", category: "Hats", price: 12500, stock: 0, status: "Out of Stock" },
  { id: 4, name: "Aviator Sunglasses", category: "Glasses", price: 18000, stock: 31, status: "Active" },
];

type Order = {
  id: string;
  buyer: string;
  item: string;
  amount: number;
  status: "Pending" | "Shipped" | "Delivered";
  date: string;
};

const RECENT_ORDERS: Order[] = [
  { id: "#OLA-1042", buyer: "Chidera A.", item: "Linen Shirt", amount: 28000, status: "Pending", date: "Sep 18" },
  { id: "#OLA-1041", buyer: "Tunde O.", item: "Tailored Trousers", amount: 42500, status: "Shipped", date: "Sep 17" },
  { id: "#OLA-1039", buyer: "Amaka N.", item: "Aviator Sunglasses", amount: 18000, status: "Delivered", date: "Sep 15" },
  { id: "#OLA-1035", buyer: "Femi K.", item: "Linen Shirt", amount: 28000, status: "Delivered", date: "Sep 12" },
];

const REVENUE_LAST_7 = [
  { day: "Mon", amount: 42000 },
  { day: "Tue", amount: 18000 },
  { day: "Wed", amount: 65000 },
  { day: "Thu", amount: 31000 },
  { day: "Fri", amount: 88500 },
  { day: "Sat", amount: 102000 },
  { day: "Sun", amount: 56000 },
];

const STATUS_STYLES: Record<Order["status"], string> = {
  Pending: "bg-amber-50 text-amber-700",
  Shipped: "bg-blue-50 text-blue-700",
  Delivered: "bg-green-50 text-green-700",
};

const naira = (n: number) => `₦${n.toLocaleString()}`;

export default function SellerDashboardPage() {
  const [products, setProducts] = useState<SellerProduct[]>(INITIAL_PRODUCTS);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftPrice, setDraftPrice] = useState("");
  const [draftStock, setDraftStock] = useState("");

  const totalRevenue = RECENT_ORDERS.filter((o) => o.status !== "Pending").reduce(
    (sum, o) => sum + o.amount,
    0
  );
  const totalOrders = RECENT_ORDERS.length;
  const activeListings = products.filter((p) => p.status === "Active").length;
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const maxRevenue = Math.max(...REVENUE_LAST_7.map((d) => d.amount));

  const startEdit = (product: SellerProduct) => {
    setEditingId(product.id);
    setDraftPrice(String(product.price));
    setDraftStock(String(product.stock));
  };

  const saveEdit = (id: number) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              price: Number(draftPrice) || p.price,
              stock: Number(draftStock) || 0,
              status: Number(draftStock) > 0 ? "Active" : "Out of Stock",
            }
          : p
      )
    );
    setEditingId(null);
  };

  const removeProduct = (id: number) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <main className="min-h-screen w-full bg-gray-100">
      <div className="mx-auto max-w-[1280px] bg-white shadow-sm">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4 sm:px-10">
          <a href="/" className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-950">
            <ChevronLeft size={16} />
            Back to store
          </a>
          <a
            href="/seller/new-listing"
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            <Plus size={15} />
            Add New Item
          </a>
        </div>

        <div className="px-6 py-8 sm:px-10">
          <h1 className="text-2xl font-extrabold text-gray-950">Seller Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Here's how your store is doing.</p>

          {/* ---------- Stat cards ---------- */}
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-100 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <Wallet size={18} />
              </div>
              <p className="mt-3 text-xl font-extrabold text-gray-950">{naira(totalRevenue)}</p>
              <p className="text-xs text-gray-500">Total Revenue</p>
            </div>

            <div className="rounded-xl border border-gray-100 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <ShoppingBag size={18} />
              </div>
              <p className="mt-3 text-xl font-extrabold text-gray-950">{totalOrders}</p>
              <p className="text-xs text-gray-500">Total Orders</p>
            </div>

            <div className="rounded-xl border border-gray-100 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600">
                <Package size={18} />
              </div>
              <p className="mt-3 text-xl font-extrabold text-gray-950">{activeListings}</p>
              <p className="text-xs text-gray-500">Active Listings</p>
            </div>

            <div className="rounded-xl border border-gray-100 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle size={18} />
              </div>
              <p className="mt-3 text-xl font-extrabold text-gray-950">{lowStock}</p>
              <p className="text-xs text-gray-500">Low Stock Items</p>
            </div>
          </div>

          {/* ---------- Revenue chart (plain CSS bars, no chart library needed) ---------- */}
          <div className="mt-8 rounded-xl border border-gray-100 p-6">
            <p className="text-sm font-semibold text-gray-950">Revenue — last 7 days</p>
            <div className="mt-6 flex h-40 items-end gap-4">
              {REVENUE_LAST_7.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t-md bg-amber-500/80 transition-all"
                    style={{ height: `${(d.amount / maxRevenue) * 100}%` }}
                    title={naira(d.amount)}
                  />
                  <span className="text-xs text-gray-500">{d.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ---------- Products table ---------- */}
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-gray-950">Your Products</h2>
              <span className="text-sm text-gray-500">{products.length} listed</span>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Stock</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((p) => {
                    const isEditing = editingId === p.id;
                    return (
                      <tr key={p.id}>
                        <td className="flex items-center gap-3 px-4 py-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[10px] text-gray-400">
                            Img
                          </div>
                          <span className="font-medium text-gray-950">{p.name}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{p.category}</td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input
                              value={draftPrice}
                              onChange={(e) => setDraftPrice(e.target.value)}
                              className="w-24 rounded-md border border-gray-200 px-2 py-1 text-sm"
                            />
                          ) : (
                            <span className="text-gray-950">{naira(p.price)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input
                              value={draftStock}
                              onChange={(e) => setDraftStock(e.target.value)}
                              className="w-16 rounded-md border border-gray-200 px-2 py-1 text-sm"
                            />
                          ) : (
                            <span className={p.stock <= 5 ? "font-semibold text-red-500" : "text-gray-950"}>
                              {p.stock}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              p.status === "Active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => saveEdit(p.id)}
                                  aria-label="Save"
                                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-950 text-white hover:bg-gray-800"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  aria-label="Cancel"
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(p)}
                                  aria-label="Edit"
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => removeProduct(p.id)}
                                  aria-label="Delete"
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-500"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                        No products yet.{" "}
                        <a href="/seller/new-listing" className="font-medium text-amber-600 hover:underline">
                          Add your first item
                        </a>
                        .
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---------- Recent orders ---------- */}
          <div className="mt-8">
            <h2 className="mb-3 text-lg font-extrabold text-gray-950">Recent Orders</h2>
            <div className="overflow-hidden rounded-xl border border-gray-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Buyer</th>
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {RECENT_ORDERS.map((o) => (
                    <tr key={o.id}>
                      <td className="px-4 py-3 font-medium text-gray-950">{o.id}</td>
                      <td className="px-4 py-3 text-gray-600">{o.buyer}</td>
                      <td className="px-4 py-3 text-gray-600">{o.item}</td>
                      <td className="px-4 py-3 text-gray-950">{naira(o.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[o.status]}`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{o.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}