// app/api/subscribe/route.ts
/**
 * POST /api/subscribe
 * Body: { plan: "pro" | "enterprise", billing: "monthly" | "yearly" }
 *
 * Creates a Razorpay order (server-side) and returns order id + amount + key.
 * Client will open Razorpay checkout using the returned order id.
 */

import { NextResponse } from "next/server";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

const PRICES = {
  pro: { monthly: 49900, yearly: 499000 }, // paise (₹499.00, ₹4,990.00)
  enterprise: { monthly: 199900, yearly: 1999000 }, // example
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { plan = "pro", billing = "monthly" } = body;

    const amount = PRICES[plan]?.[billing];
    if (!amount) {
      return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
    }

    // Create order in Razorpay
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: { plan, billing },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("subscribe error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
