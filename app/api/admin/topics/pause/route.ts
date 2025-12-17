// app/api/admin/topics/pause/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrModerator } from "@/lib/auth";

export async function POST() {
  await requireAdminOrModerator();

  await prisma.systemSetting.upsert({
    where: { key: "AI_PAUSED" },
    update: { value: "true" },
    create: { key: "AI_PAUSED", value: "true" },
  });

  return NextResponse.json({
    success: true,
    paused: true,
    message: "AI generation paused",
  });
}
