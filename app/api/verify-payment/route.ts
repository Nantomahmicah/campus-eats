import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type OrderRow = {
  food_id: number;
  food_name: string;
  price: number;
  seller_id: number;
  buyer_name: string;
  buyer_phone: string;
  payment_method: string;
  fulfillment_method: string;
  delivery_location: string | null;
  order_note: string | null;
  order_user_id: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const { reference, rows } = (await request.json()) as {
      reference: string;
      rows: OrderRow[];
    };

    if (!reference || !rows || rows.length === 0) {
      return NextResponse.json({ error: "Missing order details" }, { status: 400 });
    }

    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );
    const verifyData = await verifyRes.json();

    if (!verifyRes.ok || verifyData.data?.status !== "success") {
      return NextResponse.json({ error: "Payment could not be verified" }, { status: 400 });
    }

    const expectedAmount = Math.round(rows.reduce((sum, row) => sum + row.price, 0) * 100);
    if (verifyData.data.amount !== expectedAmount) {
      return NextResponse.json({ error: "Payment amount doesn't match order total" }, { status: 400 });
    }

    const insertRows = rows.map((row) => ({
      ...row,
      payment_status: "paid",
      paystack_reference: reference,
    }));

    const { error } = await supabase.from("order_items").insert(insertRows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong verifying payment" }, { status: 500 });
  }
}