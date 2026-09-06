"use client";

import { useEffect, useState } from "react";
import { supabase } from "../Lib/supabase";

type Bank = { name: string; code: string };

type Props = {
  sellerId: number;
  businessName: string;
  currentSubaccountCode: string | null;
  currentPayoutMethod: string | null;
  currentAccountName: string | null;
  onSaved: (details: {
    paystack_subaccount_code: string;
    payout_method: string;
    payout_bank_code: string;
    payout_account_number: string;
    payout_account_name: string;
  }) => void;
};

export default function PayoutSetup({
  sellerId,
  businessName,
  currentSubaccountCode,
  currentPayoutMethod,
  currentAccountName,
  onSaved,
}: Props) {
  const [editing, setEditing] = useState(!currentSubaccountCode);
  const [method, setMethod] = useState<"momo" | "bank">(
    currentPayoutMethod === "bank" ? "bank" : "momo"
  );
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) return;
    setLoadingBanks(true);
    setBankCode("");
    setResolvedName(null);
    setError("");
    fetch(`/api/paystack-banks?type=${method === "momo" ? "mobile_money" : "ghipss"}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.banks) setBanks(data.banks);
        else setError(data.error || "Could not load providers");
      })
      .catch(() => setError("Could not load providers"))
      .finally(() => setLoadingBanks(false));
  }, [method, editing]);

  async function verifyAccount() {
    if (!bankCode || !accountNumber.trim()) return;
    setVerifying(true);
    setError("");
    setResolvedName(null);
    try {
      const res = await fetch(
        `/api/resolve-account?account_number=${encodeURIComponent(
          accountNumber.trim()
        )}&bank_code=${encodeURIComponent(bankCode)}`
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Could not verify this account");
      }
      setResolvedName(data.account_name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not verify this account");
    }
    setVerifying(false);
  }

  async function saveDetails() {
    if (!resolvedName || !bankCode || !accountNumber.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/create-subaccount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: businessName,
          bank_code: bankCode,
          account_number: accountNumber.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Could not set up payouts");
      }

      const details = {
        paystack_subaccount_code: data.subaccount_code as string,
        payout_method: method,
        payout_bank_code: bankCode,
        payout_account_number: accountNumber.trim(),
        payout_account_name: data.account_name as string,
      };

      const { error: dbError } = await supabase.from("sellers").update(details).eq("id", sellerId);
      if (dbError) throw new Error(dbError.message);

      onSaved(details);
      setEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not set up payouts");
    }
    setSaving(false);
  }

  if (!editing) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-bold text-gray-900">Payout details</h2>
            <p className="text-sm text-green-700 mt-1">
              ✅ Set up — {currentPayoutMethod === "bank" ? "Bank" : "MoMo"} · {currentAccountName}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              You automatically receive 95% of each order; Campus Eats keeps 5%.
            </p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-3 py-1 rounded-full font-medium bg-blue-100 text-blue-800 h-fit"
          >
            Update
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-3">
      <h2 className="font-bold text-gray-900">Set up payouts</h2>
      <p className="text-xs text-gray-500">
        You&apos;ll receive 95% of each order directly. Campus Eats keeps 5%.
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => setMethod("momo")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium ${
            method === "momo" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700"
          }`}
        >
          Mobile Money
        </button>
        <button
          onClick={() => setMethod("bank")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium ${
            method === "bank" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700"
          }`}
        >
          Bank account
        </button>
      </div>

      <div>
        <label className="block text-xs text-gray-700 mb-1">
          {method === "momo" ? "Network" : "Bank"}
        </label>
        <select
          value={bankCode}
          onChange={(e) => {
            setBankCode(e.target.value);
            setResolvedName(null);
          }}
          className="border rounded px-2 py-1.5 text-sm w-full"
          disabled={loadingBanks}
        >
          <option value="">{loadingBanks ? "Loading..." : "Select one"}</option>
          {banks.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-700 mb-1">
          {method === "momo" ? "Mobile money number" : "Account number"}
        </label>
        <div className="flex gap-2">
          <input
            value={accountNumber}
            onChange={(e) => {
              setAccountNumber(e.target.value);
              setResolvedName(null);
            }}
            placeholder={method === "momo" ? "e.g. 0551234567" : "Account number"}
            className="border rounded px-2 py-1.5 text-sm flex-1"
          />
          <button
            onClick={verifyAccount}
            disabled={verifying || !bankCode || !accountNumber.trim()}
            className="text-sm px-3 py-1.5 rounded bg-gray-800 text-white disabled:opacity-40"
          >
            {verifying ? "Checking..." : "Verify"}
          </button>
        </div>
      </div>

      {resolvedName && (
        <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-sm text-green-800">
          Account holder: <span className="font-semibold">{resolvedName}</span>
          <p className="text-xs text-green-700 mt-1">
            Make sure this is your name or business name before saving.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2 justify-end">
        {currentSubaccountCode && (
          <button
            onClick={() => setEditing(false)}
            className="text-xs px-3 py-1.5 rounded-full font-medium bg-gray-100 text-gray-700"
          >
            Cancel
          </button>
        )}
        <button
          onClick={saveDetails}
          disabled={!resolvedName || saving}
          className="text-xs px-4 py-1.5 rounded-full font-medium bg-green-600 text-white disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save payout details"}
        </button>
      </div>
    </div>
  );
}