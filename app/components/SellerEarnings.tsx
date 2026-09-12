"use client";

import { useEffect, useState } from "react";
import { supabase } from "../Lib/supabase";

type Props = {
  sellerId: number;
  subaccountCode: string | null;
};

export default function SellerEarnings({ sellerId, subaccountCode }: Props) {
  const [totalEarned, setTotalEarned] = useState<number | null>(null);
  const [totalPaidOut, setTotalPaidOut] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      const { data: orders, error: ordersError } = await supabase
        .from("order_items")
        .select("price")
        .eq("seller_id", sellerId)
        .eq("payment_status", "paid");

      if (cancelled) return;

      if (ordersError) {
        setError(ordersError.message);
        setLoading(false);
        return;
      }

      const earned =
        (orders ?? []).reduce((sum: number, o: { price: number }) => sum + o.price, 0) * 0.95;
      setTotalEarned(earned);

      if (subaccountCode) {
        try {
          const res = await fetch(`/api/seller-settlements?subaccount_code=${subaccountCode}`);
          const data = await res.json();
          if (!cancelled) {
            if (data.error) setError(data.error);
            else setTotalPaidOut(data.totalPaidOut);
          }
        } catch {
          if (!cancelled) setError("Could not load settlement history");
        }
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sellerId, subaccountCode]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-bold text-gray-900">Your earnings</h2>
        <p className="text-sm text-gray-500 mt-1">Loading...</p>
      </div>
    );
  }

  const pending = totalPaidOut !== null ? Math.max((totalEarned ?? 0) - totalPaidOut, 0) : null;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="font-bold text-gray-900">Your earnings</h2>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <p className="text-xs text-gray-500">Total earned</p>
          <p className="text-lg font-bold text-gray-900">GH₵{(totalEarned ?? 0).toFixed(2)}</p>
        </div>

        {subaccountCode ? (
          <>
            <div>
              <p className="text-xs text-gray-500">Already sent to you</p>
              <p className="text-lg font-bold text-green-700">
                GH₵{(totalPaidOut ?? 0).toFixed(2)}
              </p>
            </div>
            <div className="col-span-2 pt-2 border-t">
              <p className="text-xs text-gray-500">On the way to your account</p>
              <p className="text-lg font-bold text-amber-600">GH₵{(pending ?? 0).toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">
                This drops to zero automatically once Paystack settles it to you.
              </p>
            </div>
          </>
        ) : (
          <div className="col-span-2">
            <p className="text-xs text-gray-500">
              Set up your payout details above to see how much has been sent to you.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}