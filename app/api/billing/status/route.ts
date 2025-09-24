import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

/**
 * Returns the user's current subscription status.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ plan: "free", active: false });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userEmail: session.user.email },
  });

  if (!subscription || !subscription.active) {
    return NextResponse.json({ plan: "free", active: false });
  }

  return NextResponse.json({
    plan: subscription.plan,
    billingCycle: subscription.billingCycle,
    active: subscription.active,
    validTill: subscription.endDate,
  });
}
