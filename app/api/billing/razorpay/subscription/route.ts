import { NextResponse } from "next/server";
import { razorpay } from "@/lib/payments";

export async function POST(req: Request) {
  try {
    const { amount, currency } = await req.json();

    const order = await razorpay.orders.create({
      amount: amount * 100, // convert to paise
      currency: currency || "INR",
      receipt: `order_rcpt_${Date.now()}`,
    });

    return NextResponse.json(order);
  } catch (err) {
    console.error("Razorpay error:", err);
    return NextResponse.json({ error: "razorpay_failed" }, { status: 500 });
  }
}

// import { NextResponse } from "next/server";
// import razorpay from "@/lib/razorpay";

// export async function POST(req: Request) {
//   try {
//     const { planId, customerId } = await req.json();
//     const subscription = await razorpay.subscriptions.create({
//       plan_id: planId,
//       customer_notify: 1,
//       total_count: 12, // e.g., 12 months
//       customer: customerId,
//     });
//     return NextResponse.json(subscription);
//   } catch (err) {
//     console.error("Razorpay subscription error:", err);
//     return NextResponse.json({ error: "razorpay_subscription_failed" }, { status: 500 });
//   }
// }
