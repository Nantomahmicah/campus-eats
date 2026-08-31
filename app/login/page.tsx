"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../Lib/supabase";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState("");

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

  async function handleForgotPassword() {
    setResetError("");
    setResetSent(false);
    if (!email.trim()) {
      setResetError("Type your email above first, then tap this again.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setResetError(error.message);
    } else {
      setResetSent(true);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 relative">
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center blur-sm scale-105"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url('https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80')",
        }}
      />

      <div className="market-panel max-w-sm w-full rounded-3xl p-8 shadow-2xl">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-2xl">
            🍽️
          </div>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-sm text-gray-600 mt-2">
            {mode === "signup"
              ? "Sign up to start ordering from campus favorites."
              : "Log in to continue your order."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="market-input w-full"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="market-input w-full"
              placeholder="••••••••"
            />
          </div>

          {mode === "login" && (
            <div className="text-right -mt-2">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs font-medium text-green-700 hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          {resetSent && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
              Check your email for a link to reset your password.
            </div>
          )}
          {resetError && (
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">{resetError}</div>
          )}

          {errorMsg ? (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{errorMsg}</div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="market-button w-full px-4 py-2.5 disabled:opacity-60"
          >
            {submitting
              ? mode === "signup"
                ? "Creating account..."
                : "Signing in..."
              : mode === "signup"
                ? "Sign up"
                : "Log in"}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-gray-600">
          {mode === "signup" ? "Already have an account?" : "Need an account?"}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            className="font-semibold text-green-600 hover:text-green-700"
          >
            {mode === "signup" ? "Log in" : "Sign up"}
          </button>
        </div>
      </div>
    </main>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-gray-50" />}>
      <LoginForm />
    </Suspense>
  );
}