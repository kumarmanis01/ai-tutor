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

  const subscription = await prisma.subscription.findFirst({
    where: { userId: session.user.id, active: true },
    orderBy: { createdAt: "desc" },
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ plan: "free", status: "inactive" });
    }

    // Get userId from session or fetch by email
    let userId = (session.user as any).id;
    if (!userId) {
      const user = await prisma.user.findUnique({ where: { email: session.user.email } });
      userId = user?.id;
    }
    if (!userId) {
      return NextResponse.json({ plan: "free", status: "inactive" });
    }

    const subscription = await prisma.subscription.findFirst({
      where: { userId, status: "active" },
      orderBy: { createdAt: "desc" },
    });

    if (!subscription) {
      return NextResponse.json({ plan: "free", status: "inactive" });
    }

    return NextResponse.json({
      plan: subscription.plan,
      billingCycle: subscription.billingCycle,
      status: subscription.status,
      validTill: subscription.endDate,
    });
}
