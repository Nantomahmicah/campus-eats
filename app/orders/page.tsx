"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../Lib/supabase";

function OrdersLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push(redirectTo);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-1">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-gray-500 mb-6">
          {mode === "signup"
            ? "Sign up to order food or start selling"
            : "Log in to continue"}
        </p>

        {errorMsg && (
          <div className="bg-red-100 text-red-800 p-3 rounded mb-4 text-sm">{errorMsg}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="At least 6 characters"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-700 text-white py-2 rounded hover:bg-green-800 disabled:opacity-50"
          >
            {submitting ? "Please wait..." : mode === "signup" ? "Sign up" : "Log in"}
          </button>
        </form>

        <p className="text-sm text-gray-500 mt-4 text-center">
          {mode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            className="text-green-700 font-medium underline"
          >
            {mode === "signup" ? "Log in" : "Sign up"}
          </button>
        </p>
      </div>
    </main>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-gray-50" />}>
      <OrdersLoginForm />
    </Suspense>
  );
}
