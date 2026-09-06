"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../Lib/supabase";

type Toast = {
  id: string;
  title: string;
  body: string;
  href?: string;
};

let toastCounter = 0;

// Short pleasant "ding" using the Web Audio API — no external sound file needed.
function playDing() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    [880, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.18, now + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.4);
    });

    setTimeout(() => ctx.close(), 800);
  } catch {
    // Audio isn't available (e.g. autoplay restrictions before first click) — fail silently.
  }
}

function notifyOS(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted" && document.hidden) {
    try {
      new Notification(title, { body, icon: "/favicon.ico" });
    } catch {
      // ignore
    }
  }
}

export default function NotificationCenter() {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const sellerIdRef = useRef<number | null>(null);

  function pushToast(title: string, body: string, href?: string) {
    const id = `t-${Date.now()}-${toastCounter++}`;
    setToasts((prev) => [...prev, { id, title, body, href }]);
    playDing();
    notifyOS(title, body);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      // Ask quietly; harmless if denied.
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    let messagesChannel: ReturnType<typeof supabase.channel> | null = null;
    let ordersInsertChannel: ReturnType<typeof supabase.channel> | null = null;
    let ordersUpdateChannel: ReturnType<typeof supabase.channel> | null = null;

    async function setup() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;

      // New message notifications (buyer or seller, either direction)
      messagesChannel = supabase
        .channel(`notify-messages-${user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
          (payload) => {
            const row = payload.new as { sender_name: string | null; body: string };
            pushToast(
              "New message" + (row.sender_name ? ` from ${row.sender_name}` : ""),
              row.body,
              "/messages"
            );
          }
        )
        .subscribe();

      // Order status changes for buyers
      ordersUpdateChannel = supabase
        .channel(`notify-order-status-${user.id}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "order_items", filter: `order_user_id=eq.${user.id}` },
          (payload) => {
            const oldRow = payload.old as { status: string };
            const newRow = payload.new as { status: string; food_name: string };
            if (oldRow.status !== newRow.status) {
              pushToast(
                "Order update",
                `Your order for ${newRow.food_name} is now "${newRow.status}"`,
                "/my-orders"
              );
            }
          }
        )
        .subscribe();

      // New order notifications for sellers
      const { data: sellerData } = await supabase
        .from("sellers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (sellerData) {
        sellerIdRef.current = sellerData.id;
        ordersInsertChannel = supabase
          .channel(`notify-new-orders-${sellerData.id}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "order_items", filter: `seller_id=eq.${sellerData.id}` },
            (payload) => {
              const row = payload.new as { food_name: string; price: number; buyer_name: string };
              pushToast(
                "New order! 🎉",
                `${row.buyer_name} ordered ${row.food_name} — GH₵${row.price}`,
                "/dashboard"
              );
            }
          )
          .subscribe();
      }
    }

    setup();

    return () => {
      if (messagesChannel) supabase.removeChannel(messagesChannel);
      if (ordersInsertChannel) supabase.removeChannel(ordersInsertChannel);
      if (ordersUpdateChannel) supabase.removeChannel(ordersUpdateChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-xs w-[calc(100%-2rem)] sm:w-80">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => {
            if (t.href) router.push(t.href);
            setToasts((prev) => prev.filter((x) => x.id !== t.id));
          }}
          className="text-left rounded-2xl border border-white/85 bg-white/95 shadow-lg backdrop-blur px-4 py-3 hover:-translate-y-0.5 transition-transform"
        >
          <p className="text-sm font-bold text-gray-900">{t.title}</p>
          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{t.body}</p>
        </button>
      ))}
    </div>
  );
}