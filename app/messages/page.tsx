"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../Lib/supabase";

type Message = {
  id: number;
  created_at: string;
  sender_id: string;
  recipient_id: string;
  food_id: number | null;
  body: string;
};

export default function MessagesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadMessages() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login?redirect=/messages");
        return;
      }
      setUser(userData.user);

      const { data, error } = await supabase
        .from("messages")
        .select("id, created_at, sender_id, recipient_id, food_id, body")
        .or(`sender_id.eq.${userData.user.id},recipient_id.eq.${userData.user.id}`)
        .order("created_at", { ascending: false });

      if (error) setErrorMessage(error.message);
      else setMessages((data as Message[]) ?? []);
      setLoading(false);
    }

    loadMessages();
    const refreshInterval = window.setInterval(loadMessages, 8000);
    return () => window.clearInterval(refreshInterval);
  }, [router]);

  async function sendReply() {
    if (!user || !replyingTo || !replyText.trim()) return;
    setSending(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        recipient_id: replyingTo.sender_id,
        food_id: replyingTo.food_id,
        body: replyText.trim(),
      })
      .select("id, created_at, sender_id, recipient_id, food_id, body")
      .single();

    if (error) {
      setErrorMessage(error.message);
    } else if (data) {
      setMessages((current) => [data as Message, ...current]);
      setReplyingTo(null);
      setReplyText("");
    }
    setSending(false);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-green-50 via-amber-50 to-emerald-100 p-4 sm:p-6">
      <div className="pointer-events-none absolute -left-24 top-20 h-64 w-64 rounded-full bg-lime-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
      <div className="relative mx-auto max-w-2xl">
        <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-white/80 bg-white/80 p-5 shadow-lg shadow-green-900/5 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-green-600 to-emerald-500 text-xl shadow-md shadow-green-700/20">💬</div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Messages</h1>
              <p className="text-sm text-gray-600">Talk directly with buyers and sellers.</p>
            </div>
          </div>
          <Link href="/" className="rounded-full bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-100">← Home</Link>
        </div>

        {loading && <div className="rounded-2xl bg-white/80 p-6 text-center text-gray-600 shadow-sm">Loading messages...</div>}
        {errorMessage && <p className="mb-3 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700 shadow-sm">{errorMessage}</p>}
        {!loading && messages.length === 0 && (
          <div className="rounded-2xl border border-white bg-white/90 p-10 text-center shadow-lg shadow-green-900/5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">👋</div>
            <h2 className="mt-4 text-lg font-bold text-gray-900">Your inbox is quiet</h2>
            <p className="mt-1 text-sm text-gray-600">Messages from buyers and sellers will appear here.</p>
          </div>
        )}

        <div className="space-y-3">
          {messages.map((message) => {
            const isIncoming = message.recipient_id === user?.id;
            return (
              <article key={message.id} className={`flex gap-3 ${isIncoming ? "justify-start" : "justify-end"}`}>
                {isIncoming && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm">🍽️</div>}
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                  isIncoming
                    ? "rounded-tl-sm border border-white bg-white text-gray-800"
                    : "rounded-tr-sm bg-gradient-to-br from-green-700 to-emerald-600 text-white shadow-green-900/15"
                }`}>
                  <div className="flex items-center justify-between gap-5">
                    <p className={`text-xs font-bold ${isIncoming ? "text-green-700" : "text-green-100"}`}>{isIncoming ? "Buyer / seller" : "You"}</p>
                    <time className={`text-[11px] ${isIncoming ? "text-gray-400" : "text-green-100"}`}>{new Date(message.created_at).toLocaleString()}</time>
                  </div>
                  <p className={`mt-1 whitespace-pre-wrap text-sm leading-6 ${isIncoming ? "text-gray-700" : "text-white"}`}>{message.body}</p>
                  {isIncoming && (
                    <button
                      onClick={() => { setReplyingTo(message); setReplyText(""); }}
                      className="mt-2 text-sm font-bold text-green-700 transition hover:text-green-900"
                    >
                      Reply →
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {replyingTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/80 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-lg">✉️</div>
              <div><h2 className="text-xl font-bold text-gray-900">Reply</h2><p className="text-sm text-gray-500">Keep the conversation going.</p></div>
            </div>
            <textarea
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
              maxLength={1000}
              placeholder="Write your reply..."
              className="mt-5 min-h-28 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setReplyingTo(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">Cancel</button>
              <button
                onClick={sendReply}
                disabled={!replyText.trim() || sending}
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-green-800/20 transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send reply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
