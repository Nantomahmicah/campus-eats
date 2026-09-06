import { NextRequest, NextResponse } from "next/server";

// Confirms an account number actually resolves to a real account holder name
// before we let a seller save it — Paystack cannot reverse a payout sent to
// the wrong account, so this check matters.
export async function GET(request: NextRequest) {
  const accountNumber = request.nextUrl.searchParams.get("account_number");
  const bankCode = request.nextUrl.searchParams.get("bank_code");

  if (!accountNumber || !bankCode) {
    return NextResponse.json({ error: "Missing account number or bank code" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(
        accountNumber
      )}&bank_code=${encodeURIComponent(bankCode)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );
    const data = await res.json();

    if (!res.ok || !data.status) {
      return NextResponse.json(
        { error: data.message || "Could not verify this account number" },
        { status: 400 }
      );
    }

    return NextResponse.json({ account_name: data.data.account_name });
  } catch {
    return NextResponse.json({ error: "Could not reach Paystack" }, { status: 500 });
  }
}