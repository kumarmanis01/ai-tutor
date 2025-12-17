// app/api/admin/topics/resume/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrModerator } from "@/lib/auth";

export async function POST() {
  await requireAdminOrModerator();

  await prisma.systemSetting.upsert({
    where: { key: "AI_PAUSED" },
    update: { value: "false" },
    create: { key: "AI_PAUSED", value: "false" },
  });

  return NextResponse.json({
    success: true,
    paused: false,
    message: "AI generation resumed",
  });
}
