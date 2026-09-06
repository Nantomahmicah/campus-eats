"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../Lib/supabase";
import type { User } from "@supabase/supabase-js";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

type Order = {
  id: number;
  created_at: string;
  food_id: number;
  food_name: string;
  price: number;
  seller_id: number;
  payment_method: string;
  status: string;
  fulfillment_method: string | null;
  delivery_location: string | null;
  order_note: string | null;
  rider_lat: number | null;
  rider_lng: number | null;
};

type Rating = {
  order_item_id: number;
  rating: number;
};

function ensureLeafletCss() {
  if (document.getElementById("leaflet-css")) return;
  const link = document.createElement("link");
  link.id = "leaflet-css";
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}

function LiveMap({ order }: { order: Order }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const riderMarkerRef = useRef<LeafletMarker | null>(null);
  const buyerMarkerRef = useRef<LeafletMarker | null>(null);

  const [riderPos, setRiderPos] = useState<{ lat: number; lng: number } | null>(
    order.rider_lat != null && order.rider_lng != null
      ? { lat: order.rider_lat, lng: order.rider_lng }
      : null
  );
  const [buyerPos, setBuyerPos] = useState<{ lat: number; lng: number } | null>(null);

  const distanceKm = useMemo<number | null>(() => {
    if (!riderPos || !buyerPos) return null;

    const R = 6371;
    const dLat = ((buyerPos.lat - riderPos.lat) * Math.PI) / 180;
    const dLng = ((buyerPos.lng - riderPos.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((riderPos.lat * Math.PI) / 180) *
        Math.cos((buyerPos.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, [riderPos, buyerPos]);

  const etaMinutes = useMemo<number | null>(() => {
    if (distanceKm == null) return null;
    return Math.max(1, Math.round((distanceKm / 15) * 60));
  }, [distanceKm]);

  // Ask for the buyer's own location once
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setBuyerPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        /* silently ignore if denied — map still works without ETA */
      }
    );
  }, []);

  // Listen for live rider location updates on this specific order
  useEffect(() => {
    const channel = supabase
      .channel(`order-location-${order.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "order_items", filter: `id=eq.${order.id}` },
        (payload) => {
          const row = payload.new as { rider_lat: number | null; rider_lng: number | null };
          if (row.rider_lat != null && row.rider_lng != null) {
            setRiderPos({ lat: row.rider_lat, lng: row.rider_lng });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order.id]);

  // Draw / update the map
  useEffect(() => {
    async function setupMap() {
      if (!mapRef.current || !riderPos) return;
      ensureLeafletCss();
      const L = (await import("leaflet")).default;

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapRef.current).setView([riderPos.lat, riderPos.lng], 15);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
        }).addTo(mapInstanceRef.current);
      }
      const map = mapInstanceRef.current;

      const riderIcon = L.divIcon({ html: "🛵", className: "", iconSize: [28, 28] });
      if (!riderMarkerRef.current) {
        riderMarkerRef.current = L.marker([riderPos.lat, riderPos.lng], { icon: riderIcon }).addTo(map);
      } else {
        riderMarkerRef.current.setLatLng([riderPos.lat, riderPos.lng]);
      }

      if (buyerPos) {
        const buyerIcon = L.divIcon({ html: "📍", className: "", iconSize: [24, 24] });
        if (!buyerMarkerRef.current) {
          buyerMarkerRef.current = L.marker([buyerPos.lat, buyerPos.lng], { icon: buyerIcon }).addTo(map);
        } else {
          buyerMarkerRef.current.setLatLng([buyerPos.lat, buyerPos.lng]);
        }
        map.fitBounds(
          [
            [riderPos.lat, riderPos.lng],
            [buyerPos.lat, buyerPos.lng],
          ],
          { padding: [30, 30] }
        );
      } else {
        map.setView([riderPos.lat, riderPos.lng], 15);
      }
    }
    setupMap();
  }, [riderPos, buyerPos]);

  useEffect(() => {
    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  if (!riderPos) {
    return (
      <p className="mt-3 text-xs text-gray-500">
        Waiting for the seller to start sharing their live location...
      </p>
    );
  }

  return (
    <div className="mt-3">
      <div ref={mapRef} className="h-48 w-full rounded-xl overflow-hidden border border-gray-200" />
      {distanceKm != null && etaMinutes != null ? (
        <p className="mt-2 text-xs text-gray-600">
          ~{distanceKm.toFixed(1)} km away · about {etaMinutes} min (estimate)
        </p>
      ) : (
        <p className="mt-2 text-xs text-gray-400">Allow location access to see distance and ETA</p>
      )}
    </div>
  );
}

export default function MyOrders() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [selectedRatings, setSelectedRatings] = useState<Record<number, number>>({});
  const [submittingRatingId, setSubmittingRatingId] = useState<number | null>(null);
  const [ratingError, setRatingError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login?redirect=/my-orders");
        return;
      }
      setUser(data.user);

      const { data: orderData, error } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_user_id", data.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading orders:", error);
      } else {
        setOrders(orderData as Order[]);
      }

      const { data: ratingData, error: ratingLoadError } = await supabase
        .from("ratings")
        .select("order_item_id, rating")
        .eq("buyer_user_id", data.user.id);

      if (!ratingLoadError) {
        setRatings(
          ((ratingData as Rating[]) ?? []).reduce<Record<number, number>>((result, rating) => {
            result[rating.order_item_id] = rating.rating;
            return result;
          }, {})
        );
      }
      setLoading(false);
    }
    init();
  }, [router]);

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    "on the way": "bg-blue-100 text-blue-800",
    delivered: "bg-green-100 text-green-800",
  };

  async function submitRating(order: Order) {
    const rating = selectedRatings[order.id];
    if (!user || !rating) return;

    setSubmittingRatingId(order.id);
    setRatingError("");
    const { error } = await supabase.from("ratings").insert({
      order_item_id: order.id,
      food_id: order.food_id,
      seller_id: order.seller_id,
      buyer_user_id: user.id,
      rating,
    });

    if (error) {
      setRatingError(error.message);
    } else {
      setRatings((current) => ({ ...current, [order.id]: rating }));
    }
    setSubmittingRatingId(null);
  }

  if (loading) {
    return (
      <main className="market-shell flex items-center justify-center">
        <p className="text-gray-500">Loading your orders...</p>
      </main>
    );
  }

  return (
    <main className="market-shell p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="market-panel mb-6 flex items-center justify-between rounded-3xl p-5">
          <div>
            <h1 className="text-2xl font-bold">My Orders</h1>
            <p className="text-gray-500 text-sm">{user?.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/messages"
              className="rounded-full bg-green-100 px-3 py-2 text-sm font-semibold text-green-800 transition hover:bg-green-200"
            >
              Messages
            </Link>
            <Link
              href="/"
              className="rounded-full bg-green-100 px-3 py-2 text-sm font-semibold text-green-800 transition hover:bg-green-200"
            >
              Back to Campus Eats
            </Link>
          </div>
        </div>

        {orders.length === 0 && (
          <div className="market-panel rounded-3xl p-10 text-center text-gray-500">
            You haven&apos;t ordered anything yet.
          </div>
        )}

        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="market-panel rounded-2xl p-5 transition hover:-translate-y-0.5">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold">{order.food_name}</h3>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      statusColors[order.status] ?? "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
                <span className="font-semibold text-green-700">GH₵{order.price}</span>
              </div>

              <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                <p>
                  {order.fulfillment_method === "delivery" ? "🛵 Delivery" : "🛍️ Pickup"}
                  {order.fulfillment_method === "delivery" && order.delivery_location && (
                    <> — to <span className="font-medium">{order.delivery_location}</span></>
                  )}
                </p>
                {order.order_note && <p className="italic">Note: “{order.order_note}”</p>}
              </div>

              {order.status === "on the way" && order.fulfillment_method === "delivery" && (
                <LiveMap order={order} />
              )}

              {order.status === "delivered" && (
                <div className="mt-4 border-t border-gray-100 pt-3">
                  {ratings[order.id] ? (
                    <p className="text-sm font-medium text-green-700">Thanks for rating this order ★ {ratings[order.id]}/5</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-gray-800">How was your food?</p>
                      <div className="mt-2 flex items-center gap-1" aria-label={`Rate ${order.food_name}`}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setSelectedRatings((current) => ({ ...current, [order.id]: star }))}
                            className={`text-2xl leading-none ${
                              star <= (selectedRatings[order.id] ?? 0) ? "text-amber-400" : "text-gray-300"
                            }`}
                            aria-label={`${star} star${star === 1 ? "" : "s"}`}
                          >
                            ★
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => submitRating(order)}
                          disabled={!selectedRatings[order.id] || submittingRatingId === order.id}
                          className="market-button ml-2 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {submittingRatingId === order.id ? "Saving..." : "Submit rating"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        {ratingError && <p className="mt-3 text-sm text-red-600">Could not save rating: {ratingError}</p>}
      </div>
    </main>
  );
}