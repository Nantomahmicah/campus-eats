import { NextRequest, NextResponse } from "next/server";

// Creates the Paystack subaccount that lets a seller receive their share of
// payments directly. The actual per-order split percentage is computed
// dynamically at checkout, but Paystack still requires a percentage_charge
// value at creation time, so we set it to match the platform's commission.
export async function POST(request: NextRequest) {
  try {
    const { business_name, bank_code, account_number } = (await request.json()) as {
      business_name: string;
      bank_code: string;
      account_number: string;
    };

    if (!business_name || !bank_code || !account_number) {
      return NextResponse.json({ error: "Missing payout details" }, { status: 400 });
    }

    const res = await fetch("https://api.paystack.co/subaccount", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        business_name,
        settlement_bank: bank_code,
        account_number,
        percentage_charge: 5,
      }),
    });
    const data = await res.json();

    if (!res.ok || !data.status) {
      return NextResponse.json(
        { error: data.message || "Could not set up payouts" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      subaccount_code: data.data.subaccount_code,
      account_name: data.data.account_name,
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong setting up payouts" }, { status: 500 });
  }
}