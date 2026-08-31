"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../Lib/supabase";
import type { User } from "@supabase/supabase-js";

type Seller = {
  id: number;
  business_name: string;
  phone_number: string;
  location: string;
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
};

type Food = {
  id: number;
  name: string;
  price: number;
  image_url: string | null;
  is_available: boolean;
};

type Order = {
  id: number;
  food_name: string;
  price: number;
  buyer_name: string;
  buyer_phone: string;
  payment_method: string;
  status: string;
};

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login?redirect=/dashboard");
        return;
      }
      setUser(data.user);

      const { data: sellerData } = await supabase
        .from("sellers")
        .select("*")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (sellerData) {
        setSeller(sellerData as Seller);

        const { data: foodData } = await supabase
          .from("Foods")
          .select("id, name, price, image_url, is_available")
          .eq("seller_id", sellerData.id);
        setFoods((foodData as Food[]) ?? []);

        const { data: orderData } = await supabase
          .from("order_items")
          .select("*")
          .eq("seller_id", sellerData.id)
          .order("created_at", { ascending: false });
        setOrders((orderData as Order[]) ?? []);
      }
      setLoading(false);
    }
    init();
  }, [router]);

  async function toggleShopOpen() {
    if (!seller) return;
    const newValue = !seller.is_open;
    const { error } = await supabase
      .from("sellers")
      .update({ is_open: newValue })
      .eq("id", seller.id);
    if (!error) setSeller({ ...seller, is_open: newValue });
  }

  async function saveHours(opens: string, closes: string) {
    if (!seller) return;
    setSavingHours(true);
    const { error } = await supabase
      .from("sellers")
      .update({ opens_at: opens, closes_at: closes })
      .eq("id", seller.id);
    if (!error) setSeller({ ...seller, opens_at: opens, closes_at: closes });
    setSavingHours(false);
  }

  async function toggleFoodAvailable(foodId: number, current: boolean) {
    const { error } = await supabase
      .from("Foods")
      .update({ is_available: !current })
      .eq("id", foodId);
    if (!error) {
      setFoods((prev) =>
        prev.map((f) => (f.id === foodId ? { ...f, is_available: !current } : f))
      );
    }
  }

  async function updateOrderStatus(orderId: number, newStatus: string) {
    const { error } = await supabase
      .from("order_items")
      .update({ status: newStatus })
      .eq("id", orderId);
    if (!error) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
    }
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    "on the way": "bg-blue-100 text-blue-800",
    delivered: "bg-green-100 text-green-800",
  };

  if (loading) {
    return (
     <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-700">Loading dashboard...</p>
      </main>
    );
  }

  if (!seller) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow p-6 max-w-sm text-center">
          <p className="text-gray-600 mb-4">
            You don&apos;t have a seller profile yet. Add your first food item to get started.
          </p>
          <a href="/sell" className="bg-green-700 text-white px-4 py-2 rounded font-semibold">
            Add food item
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-gray-100 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{seller.business_name}</h1>
            <p className="text-gray-700 text-sm">{user?.email}</p>
          </div>
          <a href="/sell" className="text-green-700 underline text-sm">
            + Add food item
          </a>
        </div>
        </div>

        {/* Shop status */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold">Shop status</h2>
            <button
              onClick={toggleShopOpen}
              className={`px-4 py-1 rounded-full text-sm font-semibold ${
                seller.is_open ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}
            >
              {seller.is_open ? "Open" : "Closed"} — tap to change
            </button>
          </div>

          <div className="flex gap-2 items-end">
            <div>
              <label className="block text-xs text-gray-700 mb-1">Opens at</label>
              <input
                defaultValue={seller.opens_at ?? ""}
                onBlur={(e) => saveHours(e.target.value, seller.closes_at ?? "")}
                placeholder="e.g. 8:00 AM"
                className="border rounded px-2 py-1 text-sm w-32"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1">Closes at</label>
              <input
                defaultValue={seller.closes_at ?? ""}
                onBlur={(e) => saveHours(seller.opens_at ?? "", e.target.value)}
                placeholder="e.g. 6:00 PM"
                className="border rounded px-2 py-1 text-sm w-32"
              />
            </div>
            {savingHours && <span className="text-xs text-gray-400">Saving...</span>}
          </div>
        </div>

        {/* Food items */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-bold text-gray-900">Your food items</h2>
          {foods.length === 0 && (
            <p className="text-gray-700 text-sm">No food items yet.</p>
          )}
          <div className="space-y-2">
            {foods.map((food) => (
              <div
                key={food.id}
                className="flex justify-between items-center border rounded p-2"
              >
                <div className="flex items-center gap-3">
                  {food.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={food.image_url}
                      alt={food.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded" />
                  )}
                  <div>
                    <p className="font-medium  text-gray-900">{food.name}</p>
                    <p className="text-sm text-gray-700">GH₵{food.price}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleFoodAvailable(food.id, food.is_available)}
                  className={`text-xs px-3 py-1 rounded-full font-medium ${
                    food.is_available
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {food.is_available ? "Available" : "Sold out"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Orders */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-bold text-gray-900">Orders</h2>
          {orders.length === 0 && (
            <p className="text-gray-700 text-sm">No orders yet.</p>
          )}
          <div className="space-y-2">
            {orders.map((order) => (
              <div key={order.id} className="border rounded p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{order.food_name}</p>
                    <p className="text-xs text-gray-700">
                      {order.buyer_name} · {order.buyer_phone}
                    </p>
                  </div>
                  <span className="font-semibold text-green-700">GH₵{order.price}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      statusColors[order.status] ?? "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {order.status}
                  </span>
                  <select
                    value={order.status}
                    onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="pending">Pending</option>
                    <option value="on the way">On the way</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
    </main>
  )
};
