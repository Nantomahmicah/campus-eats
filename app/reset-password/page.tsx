"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../Lib/supabase";

function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    }
    setSubmitting(false);
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
            🔒
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Set a new password</h1>

        {!ready && !success && (
          <p className="text-sm text-gray-600 text-center">
            Verifying your reset link... if this doesn&apos;t update in a few seconds, the link may
            have expired — request a new one from the login page.
          </p>
        )}

        {ready && !success && (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="market-input w-full"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="market-input w-full"
                placeholder="Re-enter password"
              />
            </div>
            {errorMsg && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{errorMsg}</div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="market-button w-full px-4 py-2.5 disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Save new password"}
            </button>
          </form>
        )}

        {success && (
          <div className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700 text-center">
            Password updated! Redirecting you to log in...
          </div>
        )}
      </div>
    </main>
  );
}

export default function ResetPassword() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-gray-50" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}