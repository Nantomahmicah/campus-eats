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
  const [editingFoodId, setEditingFoodId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [savingFoodId, setSavingFoodId] = useState<number | null>(null);
  const [foodError, setFoodError] = useState("");

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

  function startEditingFood(food: Food) {
    setEditingFoodId(food.id);
    setEditName(food.name);
    setEditPrice(String(food.price));
    setFoodError("");
  }

  function cancelEditingFood() {
    setEditingFoodId(null);
    setEditName("");
    setEditPrice("");
    setFoodError("");
  }

  async function saveFoodEdit(foodId: number) {
    const trimmedName = editName.trim();
    const parsedPrice = parseFloat(editPrice);

    if (!trimmedName) {
      setFoodError("Name can't be empty.");
      return;
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setFoodError("Enter a valid price.");
      return;
    }

    setSavingFoodId(foodId);
    setFoodError("");

    const { error } = await supabase
      .from("Foods")
      .update({ name: trimmedName, price: parsedPrice })
      .eq("id", foodId);

    if (error) {
      setFoodError(error.message);
    } else {
      setFoods((prev) =>
        prev.map((f) => (f.id === foodId ? { ...f, name: trimmedName, price: parsedPrice } : f))
      );
      setEditingFoodId(null);
    }
    setSavingFoodId(null);
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
        <div className="bg-white rounded-lg shadow p-6 max-w-sm text-center space-y-4">
          <p className="text-gray-600">
            This page is for sellers. Looking for your own orders instead?
          </p>
          <a
            href="/my-orders"
            className="block bg-green-700 text-white px-4 py-2 rounded font-semibold"
          >
            View my orders
          </a>
          <p className="text-gray-400 text-xs">— or —</p>
          <a
            href="/sell"
            className="block text-green-700 underline text-sm font-medium"
          >
            Become a seller and add your first food item
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
          <div className="flex items-center gap-4">
            <a href="/messages" className="text-green-700 underline text-sm">
              Messages
            </a>
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
            {foods.map((food) => {
              const isEditing = editingFoodId === food.id;
              return (
                <div key={food.id} className="border rounded p-2">
                  {isEditing ? (
                    <div className="space-y-2">
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
                        <div className="flex-1 flex gap-2">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Food name"
                            className="border rounded px-2 py-1 text-sm flex-1"
                          />
                          <input
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            type="number"
                            step="0.01"
                            placeholder="Price"
                            className="border rounded px-2 py-1 text-sm w-24"
                          />
                        </div>
                      </div>
                      {foodError && <p className="text-xs text-red-600">{foodError}</p>}
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={cancelEditingFood}
                          className="text-xs px-3 py-1 rounded-full font-medium bg-gray-100 text-gray-700"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveFoodEdit(food.id)}
                          disabled={savingFoodId === food.id}
                          className="text-xs px-3 py-1 rounded-full font-medium bg-green-600 text-white disabled:opacity-50"
                        >
                          {savingFoodId === food.id ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
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
                          <p className="font-medium text-gray-900">{food.name}</p>
                          <p className="text-sm text-gray-700">GH₵{food.price}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEditingFood(food)}
                          className="text-xs px-3 py-1 rounded-full font-medium bg-blue-100 text-blue-800"
                        >
                          Edit
                        </button>
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
                    </div>
                  )}
                </div>
              );
            })}
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
      </div>
    </main>
  )
};