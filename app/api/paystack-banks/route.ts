import { NextRequest, NextResponse } from "next/server";

// Proxies Paystack's List Banks endpoint so the secret key never reaches the browser.
// type: "ghipss" -> real banks, "mobile_money" -> MTN/Telecel/AirtelTigo MoMo
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") === "mobile_money" ? "mobile_money" : "ghipss";

  try {
    const res = await fetch(
      `https://api.paystack.co/bank?country=ghana&type=${type}&currency=GHS`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.message || "Could not load banks" }, { status: 500 });
    }

    const banks = (data.data ?? []).map((b: { name: string; code: string }) => ({
      name: b.name,
      code: b.code,
    }));

    return NextResponse.json({ banks });
  } catch {
    return NextResponse.json({ error: "Could not reach Paystack" }, { status: 500 });
  }
}