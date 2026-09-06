"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../Lib/supabase";
import type { User } from "@supabase/supabase-js";

type Message = {
  id: number;
  created_at: string;
  sender_id: string;
  recipient_id: string;
  food_id: number | null;
  food_name: string | null;
  sender_name: string | null;
  body: string;
  read_at: string | null;
};

type Conversation = {
  otherId: string;
  otherName: string;
  lastMessage: Message;
  unreadCount: number;
};

export default function Messages() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({});
  const [myDisplayName, setMyDisplayName] = useState("Campus Eats user");
  const [selectedOtherId, setSelectedOtherId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login?redirect=/messages");
        return;
      }
      setUser(data.user);

      // Figure out how I should sign my own replies
      const { data: sellerRow } = await supabase
        .from("sellers")
        .select("business_name")
        .eq("user_id", data.user.id)
        .maybeSingle();

      setMyDisplayName(
        sellerRow?.business_name ??
          data.user.user_metadata?.buyer_name ??
          data.user.email ??
          "Campus Eats user"
      );

      // Map of every seller's user_id -> business name, for labeling conversations
      const { data: sellers } = await supabase.from("sellers").select("user_id, business_name");
      const map: Record<string, string> = {};
      (sellers ?? []).forEach((s: { user_id: string; business_name: string }) => {
        map[s.user_id] = s.business_name;
      });
      setSellerNames(map);

      const { data: msgs, error } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${data.user.id},recipient_id.eq.${data.user.id}`)
        .order("created_at", { ascending: true });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setMessages((msgs as Message[]) ?? []);
      }
      setLoading(false);
    }
    init();
  }, [router]);

  // Live updates: append new incoming messages as they arrive
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`messages-inbox-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const conversations = useMemo<Conversation[]>(() => {
    if (!user) return [];
    const byOther = new Map<string, Message[]>();

    for (const m of messages) {
      const otherId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
      if (!byOther.has(otherId)) byOther.set(otherId, []);
      byOther.get(otherId)!.push(m);
    }

    const result: Conversation[] = [];
    byOther.forEach((msgs, otherId) => {
      const sorted = [...msgs].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const lastMessage = sorted[sorted.length - 1];
      const unreadCount = sorted.filter(
        (m) => m.recipient_id === user.id && m.read_at === null
      ).length;

      const theirMessage = [...sorted].reverse().find((m) => m.sender_id === otherId);
      const otherName = sellerNames[otherId] ?? theirMessage?.sender_name ?? "Campus Eats user";

      result.push({ otherId, otherName, lastMessage, unreadCount });
    });

    return result.sort(
      (a, b) =>
        new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );
  }, [messages, user, sellerNames]);

  const thread = useMemo(() => {
    if (!selectedOtherId || !user) return [];
    return messages
      .filter((m) => m.sender_id === selectedOtherId || m.recipient_id === selectedOtherId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages, selectedOtherId, user]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.length]);

  async function openConversation(otherId: string) {
    setSelectedOtherId(otherId);
    if (!user) return;

    const unreadIds = messages
      .filter((m) => m.sender_id === otherId && m.recipient_id === user.id && m.read_at === null)
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      const { error } = await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds);
      if (!error) {
        setMessages((prev) =>
          prev.map((m) =>
            unreadIds.includes(m.id) ? { ...m, read_at: new Date().toISOString() } : m
          )
        );
      }
    }
  }

  async function sendReply() {
    if (!user || !selectedOtherId || !replyText.trim()) return;
    setSending(true);
    setErrorMsg("");

    const lastFoodContext = [...thread].reverse().find((m) => m.food_id)?.food_id ?? null;
    const lastFoodName = [...thread].reverse().find((m) => m.food_name)?.food_name ?? null;

    const newMessage = {
      sender_id: user.id,
      recipient_id: selectedOtherId,
      food_id: lastFoodContext,
      food_name: lastFoodName,
      sender_name: myDisplayName,
      body: replyText.trim(),
    };

    const { data, error } = await supabase.from("messages").insert(newMessage).select().single();

    if (error) {
      setErrorMsg(error.message);
    } else {
      setMessages((prev) => [...prev, data as Message]);
      setReplyText("");
    }
    setSending(false);
  }

  if (loading) {
    return (
      <main className="market-shell flex items-center justify-center">
        <p className="text-gray-500">Loading your messages...</p>
      </main>
    );
  }

  const selectedConversation = conversations.find((c) => c.otherId === selectedOtherId);

  return (
    <main className="market-shell p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="market-panel mb-4 flex items-center justify-between rounded-3xl p-5">
          <div>
            <h1 className="text-2xl font-bold">Messages</h1>
            <p className="text-gray-500 text-sm">{user?.email}</p>
          </div>
          <Link
            href="/"
            className="rounded-full bg-green-100 px-3 py-2 text-sm font-semibold text-green-800 transition hover:bg-green-200"
          >
            Back to Campus Eats
          </Link>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <div className="market-panel rounded-3xl overflow-hidden grid grid-cols-1 sm:grid-cols-[280px_1fr] min-h-[28rem]">
          {/* Conversation list */}
          <div
            className={`border-r border-gray-100 overflow-y-auto max-h-[32rem] ${
              selectedOtherId ? "hidden sm:block" : ""
            }`}
          >
            {conversations.length === 0 ? (
              <p className="p-5 text-sm text-gray-500">
                No conversations yet. Message a seller from the homepage to start one.
              </p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.otherId}
                  onClick={() => openConversation(c.otherId)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-green-50/60 transition ${
                    selectedOtherId === c.otherId ? "bg-green-50" : ""
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-gray-900 text-sm truncate">{c.otherName}</p>
                    {c.unreadCount > 0 && (
                      <span className="ml-2 shrink-0 bg-green-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {c.lastMessage.sender_id === user?.id ? "You: " : ""}
                    {c.lastMessage.body}
                  </p>
                </button>
              ))
            )}
          </div>

          {/* Thread */}
          <div className={`flex flex-col ${selectedOtherId ? "" : "hidden sm:flex"}`}>
            {!selectedOtherId ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-6">
                Select a conversation to view messages
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
                  <button
                    onClick={() => setSelectedOtherId(null)}
                    className="sm:hidden text-green-700 text-sm font-semibold"
                  >
                    ← Back
                  </button>
                  <p className="font-bold text-gray-900">{selectedConversation?.otherName}</p>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[26rem] p-4 space-y-2">
                  {thread.map((m) => {
                    const mine = m.sender_id === user?.id;
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                            mine
                              ? "bg-green-600 text-white rounded-br-sm"
                              : "bg-gray-100 text-gray-900 rounded-bl-sm"
                          }`}
                        >
                          {m.food_name && (
                            <p
                              className={`text-[11px] mb-1 ${
                                mine ? "text-green-100" : "text-gray-500"
                              }`}
                            >
                              Re: {m.food_name}
                            </p>
                          )}
                          <p>{m.body}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={threadEndRef} />
                </div>

                <div className="border-t border-gray-100 p-3 flex gap-2">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !sending) sendReply();
                    }}
                    placeholder="Type a message..."
                    className="market-input flex-1"
                  />
                  <button
                    onClick={sendReply}
                    disabled={sending || !replyText.trim()}
                    className="market-button px-4 py-2 text-sm disabled:opacity-50"
                  >
                    {sending ? "..." : "Send"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}