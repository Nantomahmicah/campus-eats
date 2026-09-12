import { NextRequest, NextResponse } from "next/server";

// Reports how much has actually been settled (paid out) to a seller's
// subaccount so far, straight from Paystack's own settlement records.
export async function GET(request: NextRequest) {
  const subaccountCode = request.nextUrl.searchParams.get("subaccount_code");

  if (!subaccountCode) {
    return NextResponse.json({ error: "Missing subaccount code" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.paystack.co/settlement?subaccount=${encodeURIComponent(
        subaccountCode
      )}&status=success&perPage=100`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );
    const data = await res.json();

    if (!res.ok || !data.status) {
      return NextResponse.json(
        { error: data.message || "Could not load settlement history" },
        { status: 500 }
      );
    }

    const totalPaidOutPesewas = (data.data ?? []).reduce(
      (sum: number, s: { total_amount: number }) => sum + s.total_amount,
      0
    );

    return NextResponse.json({ totalPaidOut: totalPaidOutPesewas / 100 });
  } catch {
    return NextResponse.json({ error: "Could not reach Paystack" }, { status: 500 });
  }
}