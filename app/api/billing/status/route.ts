import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { SessionUser } from "@/lib/types";
import { use } from "react";

/**
 * Returns the user's current subscription status.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sessionUser = session.user as SessionUser;
  if (!sessionUser || !sessionUser.email) {
    return NextResponse.json({ plan: "free", status: "inactive" });
  }

  // Get userId from session or fetch by email
  let userId = sessionUser.id;
  if (!userId) {
    const savedUser = await prisma.user.findUnique({
      where: { email: sessionUser.email },
    });
    userId = savedUser?.id;
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
