import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { razorpay } from "@/lib/payments";

/**
 * Creates a Razorpay order for the selected plan.
 * Requires user to be signed in.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  console.log("inside billing POST:");
  const { plan, billingCycle } = await req.json();

  // Amounts in paise
  const amount =
    plan === "pro"
      ? billingCycle === "monthly"
        ? 29900 // ₹299
        : 299900 // ₹2999
      : 0;

  if (amount === 0) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const order = await razorpay.orders.create({
    amount,
    currency: "INR",
    receipt: `order_${Date.now()}`,
  });

  console.log("Razorpay order created:", order);
  return NextResponse.json({
    orderId: order.id,
    amount,
    email: session.user.email,
  });
}
