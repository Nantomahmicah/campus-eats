"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "./Lib/supabase";
import type { User } from "@supabase/supabase-js";

type Food = {
  id: number;
  name: string;
  price: number;
  seller_id: number;
  image_url: string | null;
  is_available: boolean;
  pickup_minutes: number | null;
  delivery_minutes: number | null;
  rating: number | null;
  rating_count: number | null;
  sellers: {
    business_name: string;
    user_id: string;
    location: string | null;
    phone_number: string | null;
    open_at: string | null;
    close_at: string | null;
  } | null;
};

type PaystackConfig = {
  key: string;
  email: string;
  amount: number;
  currency: string;
  channels?: string[];
  callback: (response: { reference: string }) => void;
  onClose: () => void;
};
type PaystackPopType = {
  setup: (config: PaystackConfig) => { openIframe: () => void };
};

function ensurePaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const win = window as unknown as { PaystackPop?: unknown };
    if (win.PaystackPop) {
      resolve();
      return;
    }
    const existing = document.getElementById("paystack-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.id = "paystack-script";
    script.src = "https://js.paystack.co/v1/inline.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load payment service"));
    document.head.appendChild(script);
  });
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Food[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [payment, setPayment] = useState<"cash" | "momo" | "visa" | null>(null);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<"pickup" | "delivery">("pickup");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [justAddedId, setJustAddedId] = useState<number | null>(null);
  const [cartBounce, setCartBounce] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageFood, setMessageFood] = useState<Food | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const cartIconRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    async function init() {
      const { data: userData } = await supabase.auth.getUser();
      setUser(userData.user);

      if (userData.user?.user_metadata?.buyer_name) {
        setBuyerName(userData.user.user_metadata.buyer_name);
      }
      if (userData.user?.user_metadata?.buyer_phone) {
        setBuyerPhone(userData.user.user_metadata.buyer_phone);
      }

      const { data, error } = await supabase
        .from("Foods")
        .select("id, name, price, seller_id, image_url, is_available, pickup_minutes, delivery_minutes, rating, rating_count, sellers(business_name, user_id, location, phone_number, open_at, close_at)");

      if (error) {
        console.error("Error loading foods:", error);
      } else {
        setFoods(data as unknown as Food[]);
      }
      setLoading(false);
    }
    init();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  function openMessageBox(food: Food) {
    if (!user) {
      window.location.href = "/login?redirect=/";
      return;
    }
    if (!food.sellers?.user_id) {
      setMessageError("This seller's account is not connected yet, so messages are unavailable.");
    } else if (food.sellers.user_id === user.id) {
      setMessageError("This is your own listing. Log in with a buyer account to test messaging.");
    } else {
      setMessageError("");
    }
    setMessageText("");
    setMessageFood(food);
  }

  async function sendMessage() {
    if (!user || !messageFood?.sellers?.user_id || !messageText.trim()) return;
    if (messageFood.sellers.user_id === user.id) {
      setMessageError("You cannot message your own listing. Log in with a buyer account to test messaging.");
      return;
    }
    setSendingMessage(true);
    setMessageError("");

    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      recipient_id: messageFood.sellers.user_id,
      food_id: messageFood.id,
      body: messageText.trim(),
    });

    if (error) {
      setMessageError(error.message);
    } else {
      setMessageFood(null);
      setMessageText("");
    }
    setSendingMessage(false);
  }

  function flyToCart(imageEl: HTMLImageElement | null) {
    if (!imageEl || !cartIconRef.current) return;

    const startRect = imageEl.getBoundingClientRect();
    const endRect = cartIconRef.current.getBoundingClientRect();

    const flyer = document.createElement("img");
    flyer.src = imageEl.src;
    flyer.style.position = "fixed";
    flyer.style.left = `${startRect.left}px`;
    flyer.style.top = `${startRect.top}px`;
    flyer.style.width = `${startRect.width}px`;
    flyer.style.height = `${startRect.height}px`;
    flyer.style.borderRadius = "9999px";
    flyer.style.objectFit = "cover";
    flyer.style.zIndex = "9999";
    flyer.style.pointerEvents = "none";
    flyer.style.transition = "all 0.7s cubic-bezier(0.6,-0.28,0.74,0.05)";
    flyer.style.boxShadow = "0 4px 14px rgba(0,0,0,0.3)";
    document.body.appendChild(flyer);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flyer.style.left = `${endRect.left + endRect.width / 2 - 12}px`;
        flyer.style.top = `${endRect.top + endRect.height / 2 - 12}px`;
        flyer.style.width = "24px";
        flyer.style.height = "24px";
        flyer.style.opacity = "0.4";
      });
    });

    setTimeout(() => {
      document.body.removeChild(flyer);
      setCartBounce(true);
      setTimeout(() => setCartBounce(false), 350);
    }, 700);
  }

  function addToCart(food: Food, cardEl: HTMLElement | null) {
    setCart([...cart, food]);
    setJustAddedId(food.id);
    setTimeout(() => setJustAddedId(null), 700);

    const imageEl = cardEl?.querySelector("img") as HTMLImageElement | null;
    flyToCart(imageEl);
  }

  function removeFromCart(index: number) {
    setCart(cart.filter((_, i) => i !== index));
  }

  async function subscribeNewsletter(e: React.FormEvent) {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterStatus("sending");
    const { error } = await supabase
      .from("newsletter_subscribers")
      .insert({ email: newsletterEmail.trim() });
    setNewsletterStatus(error ? "error" : "done");
    if (!error) setNewsletterEmail("");
  }

  function finishOrder() {
    setOrderConfirmed(true);
    setCart([]);
    setShowCheckout(false);
    setPayment(null);
    setFulfillmentMethod("pickup");
    setDeliveryLocation("");
    setOrderNote("");
    setPlacingOrder(false);
  }

  async function confirmOrder() {
    if (!payment || !buyerName || !buyerPhone || (fulfillmentMethod === "delivery" && !deliveryLocation.trim())) return;
    setPlacingOrder(true);
    setErrorMsg("");

    const rows = cart.map((item) => ({
      food_id: item.id,
      food_name: item.name,
      price: item.price,
      seller_id: item.seller_id,
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
      payment_method: payment,
      fulfillment_method: fulfillmentMethod,
      delivery_location: fulfillmentMethod === "delivery" ? deliveryLocation.trim() : null,
      order_note: orderNote.trim() || null,
      order_user_id: user?.id ?? null,
    }));

    if (payment === "cash") {
      try {
        const { error } = await supabase
          .from("order_items")
          .insert(rows.map((row) => ({ ...row, payment_status: "pending" })));
        if (error) throw error;

        if (user) {
          await supabase.auth.updateUser({
            data: { buyer_name: buyerName, buyer_phone: buyerPhone },
          });
        }
        finishOrder();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Something went wrong";
        setErrorMsg(message);
        setPlacingOrder(false);
      }
      return;
    }

    try {
      await ensurePaystackScript();
      const PaystackPop = (window as unknown as { PaystackPop: PaystackPopType }).PaystackPop;
      const emailForPaystack = user?.email ?? `${buyerPhone.replace(/\D/g, "")}@campuseats.local`;

      const handler = PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
        email: emailForPaystack,
        amount: Math.round(total * 100),
        currency: "GHS",
        channels: payment === "momo" ? ["mobile_money"] : ["card"],
        callback: (response) => {
          (async () => {
            try {
              const res = await fetch("/api/verify-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reference: response.reference, rows }),
              });
              const data = await res.json();
              if (!res.ok || data.error) {
                throw new Error(data.error || "Payment could not be confirmed");
              }
              if (user) {
                await supabase.auth.updateUser({
                  data: { buyer_name: buyerName, buyer_phone: buyerPhone },
                });
              }
              finishOrder();
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : "Payment could not be confirmed";
              setErrorMsg(message);
              setPlacingOrder(false);
            }
          })();
        },
        onClose: () => {
          setPlacingOrder(false);
        },
      });
      handler.openIframe();
    } catch {
      setErrorMsg("Could not start payment. Please try again.");
      setPlacingOrder(false);
    }
  }

  const total = cart.reduce((sum, item) => sum + item.price, 0);
  const checkoutReady = payment && buyerName && buyerPhone && (fulfillmentMethod === "pickup" || deliveryLocation.trim());
  const filteredFoods = foods.filter((food) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    return (
      food.name.toLowerCase().includes(query) ||
      food.sellers?.business_name?.toLowerCase().includes(query)
    );
  });

  return (
    <main className="min-h-screen pb-32 relative">
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center bg-fixed blur-sm scale-105"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url('https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80')",
        }}
      />

      <header className="sticky top-0 z-40 bg-green-700 text-white shadow-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-4 px-4 py-4 sm:px-6">
          <Link href="/" className="shrink-0">
            <h1 className="text-2xl font-bold leading-none">Campus Eats</h1>
            <p className="mt-1 text-xs text-green-100">Made by students, for students</p>
          </Link>

          <label className="order-3 flex w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-gray-700 shadow-sm md:order-none md:max-w-sm md:flex-1">
            <span aria-hidden="true">⌕</span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
              placeholder="Search food or sellers"
              aria-label="Search food or sellers"
            />
          </label>

          <nav aria-label="Main navigation" className="flex flex-1 items-center justify-end gap-3 text-sm font-medium sm:gap-4">
            <Link href="/" className="liquid-glass-hover">Home</Link>
            <a href="#available-now" className="liquid-glass-hover">Browse</a>
            <Link href="/sell" className="liquid-glass-hover">Sell</Link>
            <Link href="/my-orders" className="liquid-glass-hover">Orders</Link>
            {user && (
              <Link href="/messages" aria-label="Messages" className="flex items-center gap-1 rounded-full bg-green-600 px-2.5 py-1.5 text-white shadow-sm transition hover:bg-green-500">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                  <path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.7 9.7 0 0 1-4.1-.9L3 20l1-3.3A8.1 8.1 0 0 1 3 12a8.5 8.5 0 0 1 9-8.5 8.5 8.5 0 0 1 9 8Z" />
                  <path d="M8 12h.01M12 12h.01M16 12h.01" strokeLinecap="round" />
                </svg>
                <span className="hidden sm:inline">Messages</span>
              </Link>
            )}
            <Link href={user ? "/dashboard" : "/login"} className="liquid-glass-hover">Profile</Link>
            <button
              ref={cartIconRef}
              onClick={() => cart.length > 0 && setShowCheckout(true)}
              className={`relative flex items-center gap-1 rounded-full bg-white px-3 py-2 text-green-800 transition-transform duration-300 hover:bg-green-50 ${
                cartBounce ? "scale-110" : "scale-100"
              }`}
              aria-label={`Cart with ${cart.length} items`}
            >
              <span aria-hidden="true">🛍️</span>
              <span className="hidden sm:inline">Cart</span>
              {cart.length > 0 && (
                <span className="-mt-4 -mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                  {cart.length}
                </span>
              )}
            </button>
            {user ? (
              <button onClick={handleLogout} className="hidden text-green-100 underline sm:inline">Log out</button>
            ) : (
              <Link href="/login" className="hidden rounded bg-white px-3 py-2 text-green-800 hover:bg-green-50 sm:inline">Log in</Link>
            )}
          </nav>
        </div>
      </header>

      <section id="available-now" className="p-6 scroll-mt-36">
        <div className="mb-5 max-w-2xl text-white drop-shadow">
          <p className="text-sm font-semibold uppercase tracking-wider text-green-100">Eat local. Support campus.</p>
          <h2 className="mt-1 text-2xl font-bold sm:text-3xl">Fresh food from students near you</h2>
          <p className="mt-1 text-green-50">Find a quick pickup, or arrange delivery straight from campus sellers.</p>
        </div>

        {loading && <p className="text-gray-100">Loading food...</p>}
        {!loading && foods.length === 0 && (
          <p className="text-gray-100">No food items found yet.</p>
        )}
        {!loading && foods.length > 0 && filteredFoods.length === 0 && (
          <p className="text-gray-100">No food or sellers match &ldquo;{searchQuery}&rdquo;.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredFoods.map((food) => (
            <div
              key={food.id}
              className={`food-card-hover bg-white rounded-lg shadow overflow-hidden border border-gray-200 ${
                food.is_available ? "" : "opacity-80"
              }`}
            >
              {food.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={food.image_url}
                  alt={food.name}
                  className="w-full h-40 object-cover"
                />
              ) : (
                <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-500 text-sm">
                  No photo
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{food.name}</h3>
                    <p className="text-gray-700 text-sm">
                      {food.sellers?.business_name ?? "Unknown seller"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    food.is_available
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-200 text-gray-700"
                  }`}>
                    {food.is_available ? "Available now" : "Sold out"}
                  </span>
                </div>
                <div className="mt-3 space-y-1.5 text-xs text-gray-600">
                  <p>📍 {food.sellers?.location ?? "On campus"} <span className="text-gray-400">· nearby</span></p>
                  {food.sellers?.phone_number && (
                    <p>📞 <a href={`tel:${food.sellers.phone_number}`} className="font-medium text-green-700 hover:underline">{food.sellers.phone_number}</a></p>
                  )}
                  <p>🟢 {food.sellers?.open_at && food.sellers?.close_at
                    ? `Open ${food.sellers.open_at} – ${food.sellers.close_at}`
                    : "Opening hours to be confirmed"}
                  </p>
                  <p>
                    🕒 {food.pickup_minutes ? `Pickup in ${food.pickup_minutes} min` : "Pickup time to be confirmed"}
                    <span className="text-gray-400"> · </span>
                    {food.delivery_minutes ? `Delivery in ${food.delivery_minutes} min` : "Delivery time to be confirmed"}
                  </p>
                  <p>
                    ★ {food.rating != null
                      ? <><span className="font-medium text-gray-700">{food.rating.toFixed(1)}</span> <span className="text-gray-400">({food.rating_count ?? 0} ratings)</span></>
                      : <><span className="font-medium text-gray-700">Not rated yet</span></>}
                  </p>
                </div>
                <p className="text-green-700 font-semibold mt-2">GH₵{food.price}</p>
                <button
                  onClick={(e) => addToCart(food, e.currentTarget.closest(".rounded-lg"))}
                  disabled={!food.is_available}
                  className={`mt-3 w-full py-2 rounded font-medium transition-all duration-200 disabled:cursor-not-allowed ${
                    justAddedId === food.id
                      ? "bg-green-900 text-white scale-105"
                      : food.is_available
                        ? "bg-green-700 text-white hover:bg-green-800"
                        : "bg-gray-300 text-gray-600"
                  }`}
                >
                  {food.is_available ? (justAddedId === food.id ? "Added ✓" : "Add to Cart") : "Unavailable"}
                </button>
                <button
                  type="button"
                  onClick={() => openMessageBox(food)}
                  className="mt-2 w-full rounded border border-green-700 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
                >
                  Message seller
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {orderConfirmed && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded shadow-lg z-50">
          Order placed! The seller has been notified. 🎉
          <button onClick={() => setOrderConfirmed(false)} className="ml-4 underline text-sm">
            dismiss
          </button>
        </div>
      )}

      {cart.length > 0 && !showCheckout && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 shadow-lg p-4">
          <h3 className="font-semibold mb-2 text-gray-900">Your Cart ({cart.length})</h3>
          <div className="max-h-32 overflow-y-auto mb-2">
            {cart.map((item, i) => (
              <div key={i} className="flex justify-between text-sm py-1 text-gray-800">
                <span>{item.name}</span>
                <div className="flex items-center gap-3">
                  <span>GH₵{item.price}</span>
                  <button onClick={() => removeFromCart(i)} className="text-red-500 text-xs">
                    remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center font-bold border-t pt-2 text-gray-900">
            <span>Total: GH₵{total}</span>
            <button
              onClick={() => setShowCheckout(true)}
              className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800"
            >
              Checkout
            </button>
          </div>
        </div>
      )}

      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Checkout</h2>

            {!user && (
              <div className="bg-blue-50 text-blue-800 p-3 rounded mb-4 text-sm">
                <a href="/login" className="underline font-medium">Log in</a> to save your order history, or continue as a guest below.
              </div>
            )}

            {errorMsg && (
              <div className="bg-red-100 text-red-800 p-3 rounded mb-4 text-sm">{errorMsg}</div>
            )}

            <div className="mb-4">
              {cart.map((item, i) => (
                <div key={i} className="flex justify-between text-sm py-1 text-gray-800">
                  <span>{item.name}</span>
                  <span>GH₵{item.price}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t mt-2 pt-2 text-gray-900">
                <span>Total</span>
                <span>GH₵{total}</span>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Your name</label>
                <input
                  required
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-gray-900"
                  placeholder="e.g. Kwame Mensah"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Phone number</label>
                <input
                  required
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-gray-900"
                  placeholder="024xxxxxxx"
                />
              </div>
            </div>

            <div className="mb-5">
              <p className="font-semibold mb-2 text-gray-900">How would you like your food?</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFulfillmentMethod("pickup")}
                  className={`rounded-lg border p-3 text-left transition ${
                    fulfillmentMethod === "pickup"
                      ? "border-green-700 bg-green-50 text-green-800 ring-1 ring-green-700"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="block text-lg">🛍️</span>
                  <span className="font-semibold">Pickup</span>
                  <span className="mt-1 block text-xs opacity-75">
                    {cart[0]?.pickup_minutes ? `Ready in about ${cart[0].pickup_minutes} min` : "Collect from the seller"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillmentMethod("delivery")}
                  className={`rounded-lg border p-3 text-left transition ${
                    fulfillmentMethod === "delivery"
                      ? "border-green-700 bg-green-50 text-green-800 ring-1 ring-green-700"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="block text-lg">🛵</span>
                  <span className="font-semibold">Delivery</span>
                  <span className="mt-1 block text-xs opacity-75">
                    {cart[0]?.delivery_minutes ? `About ${cart[0].delivery_minutes} min` : "To your campus location"}
                  </span>
                </button>
              </div>

              {fulfillmentMethod === "delivery" && (
                <div className="mt-3">
                  <label className="block text-sm font-medium mb-1 text-gray-700">Delivery location</label>
                  <input
                    required
                    value={deliveryLocation}
                    onChange={(e) => setDeliveryLocation(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-gray-900"
                    placeholder="e.g. Unity Hall, Block B, Room 12"
                  />
                </div>
              )}

              <div className="mt-3">
                <label className="block text-sm font-medium mb-1 text-gray-700">Order note <span className="font-normal text-gray-400">(optional)</span></label>
                <textarea
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  maxLength={250}
                  className="w-full border rounded px-3 py-2 text-gray-900"
                  placeholder="e.g. Please make it mild, no pepper"
                  rows={2}
                />
              </div>
            </div>

            <p className="font-semibold mb-2 text-gray-900">Pay with</p>
            <div className="grid grid-cols-3 gap-2 mb-6">
              {(["cash", "momo", "visa"] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setPayment(method)}
                  className={`py-2 rounded border font-medium capitalize ${
                    payment === method
                      ? "bg-green-700 text-white border-green-700"
                      : "border-gray-300 text-gray-700"
                  }`}
                >
                  {method === "momo" ? "MoMo" : method === "visa" ? "Visa" : "Cash"}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCheckout(false)}
                className="flex-1 py-2 rounded border border-gray-300 text-gray-700"
              >
                Back
              </button>
              <button
                onClick={confirmOrder}
                disabled={!checkoutReady || placingOrder}
                className="flex-1 py-2 rounded bg-green-700 text-white disabled:opacity-40"
              >
                {placingOrder
                  ? payment === "cash" ? "Placing..." : "Waiting for payment..."
                  : payment === "cash" || !payment ? "Confirm Order" : `Pay GH₵${total} now`}
              </button>
            </div>
          </div>
        </div>
      )}

      {messageFood && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Message seller</h2>
                <p className="mt-1 text-sm text-gray-600">Ask {messageFood.sellers?.business_name ?? "the seller"} about {messageFood.name}.</p>
              </div>
              <button onClick={() => setMessageFood(null)} className="text-gray-500 hover:text-gray-800" aria-label="Close message box">✕</button>
            </div>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              maxLength={1000}
              className="mt-4 min-h-28 w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600"
              placeholder="Hi, is this still available?"
            />
            {messageError && <p className="mt-2 text-sm text-red-600">{messageError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setMessageFood(null)} className="rounded px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Cancel</button>
              <button
                onClick={sendMessage}
                disabled={!messageText.trim() || sendingMessage || !messageFood.sellers?.user_id || messageFood.sellers.user_id === user?.id}
                className="rounded bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendingMessage ? "Sending..." : "Send message"}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-16 bg-gray-900 text-gray-300">
        <div className="border-b border-gray-800 bg-green-800/40">
          <div className="mx-auto max-w-4xl px-6 py-10 text-center">
            <h3 className="text-2xl font-bold text-white">Get Exclusive Deals 🍔</h3>
            <p className="mt-2 text-green-100">
              Subscribe to our newsletter for special offers, new menu items, and campus food updates.
            </p>
            <form onSubmit={subscribeNewsletter} className="mt-5 flex flex-col sm:flex-row gap-2 justify-center max-w-md mx-auto">
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 rounded-lg px-4 py-2 text-gray-900 focus:outline-none"
              />
              <button
                type="submit"
                disabled={newsletterStatus === "sending"}
                className="bg-white text-green-800 font-semibold px-5 py-2 rounded-lg hover:bg-green-50 disabled:opacity-60"
              >
                {newsletterStatus === "sending" ? "Subscribing..." : "Subscribe"}
              </button>
            </form>
            {newsletterStatus === "done" && (
              <p className="mt-2 text-sm text-green-100">Thanks for subscribing! 🎉</p>
            )}
            {newsletterStatus === "error" && (
              <p className="mt-2 text-sm text-red-300">Something went wrong — try again.</p>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-6 py-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center font-bold text-white text-sm">
                CE
              </div>
              <span className="text-lg font-bold text-white">CampusEats</span>
            </div>
            <p className="text-sm text-gray-400">
              Delicious food delivered right to your doorstep. Fast, fresh, and affordable for students.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="/" className="hover:text-white">Home</a></li>
              <li><a href="#available-now" className="hover:text-white">Menu</a></li>
              <li><a href="/sell" className="hover:text-white">Sell food</a></li>
              <li><a href="/my-orders" className="hover:text-white">My orders</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-3">Categories</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="#available-now" className="hover:text-white">Popular items</a></li>
              <li><a href="#available-now" className="hover:text-white">Snacks</a></li>
              <li><a href="#available-now" className="hover:text-white">Drinks</a></li>
              <li><a href="#available-now" className="hover:text-white">Main dishes</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-3">Contact Us</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>📍 Campus Student Center</li>
              <li>📞 0249943613</li>
              <li>✉️ nantomahmicah@gmail.com</li>
              <li>🕐 Mon–Sat: 8AM – 9PM</li>
              <li>🕐 Sunday: 12PM – 9PM</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 py-4 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} Campus Eats. Built for students.
        </div>
      </footer>
    </main>
  );
}