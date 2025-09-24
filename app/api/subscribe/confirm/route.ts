// app/api/subscribe/confirm/route.ts
/**
 * POST /api/subscribe/confirm
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, billing }
 *
 * Verifies payment signature and saves a Subscription record for the logged-in user.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/db";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session as any).user?.id) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan = "pro", billing = "monthly" } = body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    // Verify signature: HMAC_SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET)
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const expected = hmac.digest("hex");

    if (expected !== razorpay_signature) {
      console.warn("Razorpay signature mismatch", { expected, got: razorpay_signature });
      return NextResponse.json({ error: "signature_mismatch" }, { status: 400 });
    }

    // Successful payment → create Subscription record
    const userId = (session as any).user.id as string;
    const now = new Date();
    const startDate = now;
    const endDate = new Date(now);

    if (billing === "monthly") {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    const sub = await prisma.subscription.create({
      data: {
        userId,
        plan,
        status: "active",
        startDate,
        endDate,
      },
    });

    return NextResponse.json({ success: true, subscriptionId: sub.id });
  } catch (err) {
    console.error("subscribe confirm error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
