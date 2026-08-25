"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../Lib/supabase";
import type { User } from "@supabase/supabase-js";

type Seller = {
  id: number;
  business_name: string;
  phone_number: string;
  location: string;
  is_open: boolean;
  open_at: string | null;
  close_at: string | null;
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
  payment_status: string | null;
  status: string;
  fulfillment_method: string | null;
  delivery_location: string | null;
  order_note: string | null;
};

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingHours, setSavingHours] = useState(false);
  const [sharingOrderId, setSharingOrderId] = useState<number | null>(null);
  const [locationError, setLocationError] = useState("");
  const watchIdRef = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

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
      .update({ open_at: opens, close_at: closes })
      .eq("id", seller.id);
    if (!error) setSeller({ ...seller, open_at: opens, close_at: closes });
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

  function startSharingLocation(orderId: number) {
    if (!navigator.geolocation) {
      setLocationError("Your browser doesn't support location sharing.");
      return;
    }
    setLocationError("");

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        await supabase
          .from("order_items")
          .update({
            rider_lat: pos.coords.latitude,
            rider_lng: pos.coords.longitude,
          })
          .eq("id", orderId);
      },
      () => {
        setLocationError("Location access was denied, so live tracking can't start.");
        setSharingOrderId(null);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    watchIdRef.current = id;
    setSharingOrderId(orderId);
  }

  function stopSharingLocation() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharingOrderId(null);
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    "on the way": "bg-blue-100 text-blue-800",
    delivered: "bg-green-100 text-green-800",
  };

  if (loading) {
    return (
     <main className="market-shell flex items-center justify-center">
        <p className="text-gray-700">Loading dashboard...</p>
      </main>
    );
  }

  if (!seller) {
    return (
      <main className="market-shell flex items-center justify-center p-6">
        <div className="market-panel max-w-sm rounded-3xl p-7 text-center">
          <p className="text-gray-600 mb-4">
            You don&apos;t have a seller profile yet. Add your first food item to get started.
          </p>
          <a href="/sell" className="market-button inline-block px-4 py-2">
            Add food item
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="market-shell p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="market-panel flex items-center justify-between rounded-3xl p-5">
          <div>
            <h1 className="text-2xl font-bold">{seller.business_name}</h1>
            <p className="text-gray-700 text-sm">{user?.email}</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/messages" aria-label="Messages" className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1.5 font-semibold text-green-800 transition hover:bg-green-200">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                <path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.7 9.7 0 0 1-4.1-.9L3 20l1-3.3A8.1 8.1 0 0 1 3 12a8.5 8.5 0 0 1 9-8.5 8.5 8.5 0 0 1 9 8Z" />
                <path d="M8 12h.01M12 12h.01M16 12h.01" strokeLinecap="round" />
              </svg>
              Messages
            </Link>
            <Link href="/sell" className="text-green-700 underline">+ Add food item</Link>
          </div>
        </div>

        {/* Shop status */}
        <div className="market-panel rounded-3xl p-5">
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
                defaultValue={seller.open_at ?? ""}
                onBlur={(e) => saveHours(e.target.value, seller.close_at ?? "")}
                placeholder="e.g. 8:00 AM"
                className="market-input w-32 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1">Closes at</label>
              <input
                defaultValue={seller.close_at ?? ""}
                onBlur={(e) => saveHours(seller.open_at ?? "", e.target.value)}
                placeholder="e.g. 6:00 PM"
                className="market-input w-32 text-sm"
              />
            </div>
            {savingHours && <span className="text-xs text-gray-400">Saving...</span>}
          </div>
        </div>

        {/* Food items */}
        <div className="market-panel rounded-3xl p-5">
          <h2 className="font-bold text-gray-900">Your food items</h2>
          {foods.length === 0 && (
            <p className="text-gray-700 text-sm">No food items yet.</p>
          )}
          <div className="space-y-2">
            {foods.map((food) => (
              <div
                key={food.id}
                className="flex items-center justify-between rounded-2xl border border-green-100 bg-white/60 p-3 transition hover:bg-white"
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
        <div className="market-panel rounded-3xl p-5">
          <h2 className="font-bold text-gray-900">Orders</h2>
          {orders.length === 0 && (
            <p className="text-gray-700 text-sm">No orders yet.</p>
          )}
          <div className="space-y-2">
            {orders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-green-100 bg-white/60 p-4 transition hover:bg-white">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{order.food_name}</p>
                    <p className="text-xs text-gray-700">
                      {order.buyer_name} · {order.buyer_phone}
                    </p>
                  </div>
                  <span className="font-semibold text-green-700">GH₵{order.price}</span>
                </div>

                <div className="mt-2 text-xs text-gray-700 space-y-0.5">
                  <p>
                    {order.fulfillment_method === "delivery" ? "🛵 Delivery" : "🛍️ Pickup"}
                    {order.fulfillment_method === "delivery" && order.delivery_location && (
                      <> — to <span className="font-medium">{order.delivery_location}</span></>
                    )}
                  </p>
                  <p>
                    {order.payment_method === "cash" ? "💵 Cash" : order.payment_method === "momo" ? "📱 MoMo" : "💳 Visa"}
                    {" · "}
                    <span
                      className={`font-semibold ${
                        order.payment_status === "paid" ? "text-green-700" : "text-amber-700"
                      }`}
                    >
                      {order.payment_status === "paid" ? "Paid" : "Pay on delivery"}
                    </span>
                  </p>
                  {order.order_note && (
                    <p className="italic">Note: {order.order_note}</p>
                  )}
                </div>

                {order.fulfillment_method === "delivery" && order.status === "on the way" && (
                  <div className="mt-3">
                    {sharingOrderId === order.id ? (
                      <button
                        onClick={stopSharingLocation}
                        className="rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700"
                      >
                        ⏹ Stop sharing location
                      </button>
                    ) : (
                      <button
                        onClick={() => startSharingLocation(order.id)}
                        className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700"
                      >
                        📍 Share live location
                      </button>
                    )}
                    {locationError && (
                      <p className="mt-1 text-xs text-red-600">{locationError}</p>
                    )}
                  </div>
                )}

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
                    onChange={(e) => {
                      if (order.status === "on the way" && e.target.value !== "on the way" && sharingOrderId === order.id) {
                        stopSharingLocation();
                      }
                      updateOrderStatus(order.id, e.target.value);
                    }}
                    className="market-input text-sm"
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
      </div>
    </main>
  );
}