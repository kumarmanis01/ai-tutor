/**
 * FILE OBJECTIVE:
 * - Bulk content approval/rejection in a single request.
 * - Replaces N parallel calls to /api/admin/content/approve with one batched transaction.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/content/approve-bulk/route.test.ts
 */

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getServerSessionForHandlers } from "@/lib/session";
import { cacheDelPattern } from "@/lib/cache";

const SUPPORTED_TYPES = ["chapter", "topic", "note", "test"] as const;
type ContentType = typeof SUPPORTED_TYPES[number];

interface BulkItem {
  id: string;
  type: ContentType;
  action: "approve" | "reject";
}

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  let items: BulkItem[];
  try {
    const body = await req.json();
    if (!Array.isArray(body?.items) || body.items.length === 0) {
      return NextResponse.json({ success: false, error: "items array required" }, { status: 400 });
    }
    items = body.items;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  for (const item of items) {
    if (!item.id || !item.type || !SUPPORTED_TYPES.includes(item.type)) {
      return NextResponse.json(
        { success: false, error: `Invalid item: ${JSON.stringify(item)}` },
        { status: 400 },
      );
    }
  }

  try {
    const db = (global as any).__TEST_PRISMA__ ?? prisma;

    // Resolve admin user once for all audit log entries
    let auditUserId: string | null = null;
    try {
      if (session.user?.id) {
        const byId = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true } });
        if (byId) auditUserId = byId.id;
      }
    } catch {
      auditUserId = null;
    }

    // Group items by type and action for batch DB operations
    const byTypeAction: Record<string, BulkItem[]> = {};
    for (const item of items) {
      const key = `${item.type}:${item.action}`;
      if (!byTypeAction[key]) byTypeAction[key] = [];
      byTypeAction[key].push(item);
    }

    const topicIdsForNoteCache: string[] = [];
    const topicIdsForTestCache: string[] = [];

    await db.$transaction(async (tx: any) => {
      for (const [key, group] of Object.entries(byTypeAction)) {
        const [type, action] = key.split(":") as [ContentType, "approve" | "reject"];
        const ids = group.map((g) => g.id);
        const newStatus = action === "reject" ? "rejected" : "approved";

        if (type === "chapter") {
          await tx.chapterDef.updateMany({ where: { id: { in: ids } }, data: { status: newStatus } });
        } else if (type === "topic") {
          await tx.topicDef.updateMany({ where: { id: { in: ids } }, data: { status: newStatus } });
        } else if (type === "note") {
          const rows = await tx.topicNote.findMany({
            where: { id: { in: ids } },
            select: { topicId: true },
          });
          for (const r of rows) if (r.topicId) topicIdsForNoteCache.push(r.topicId);
          await tx.topicNote.updateMany({ where: { id: { in: ids } }, data: { status: newStatus } });
        } else if (type === "test") {
          const rows = await tx.generatedTest.findMany({
            where: { id: { in: ids } },
            select: { topicId: true },
          });
          for (const r of rows) if (r.topicId) topicIdsForTestCache.push(r.topicId);
          await tx.generatedTest.updateMany({ where: { id: { in: ids } }, data: { status: newStatus } });
        }
      }

      // Batch audit log inserts
      await tx.auditLog.createMany({
        data: items.map((item) => ({
          adminId: auditUserId,
          targetEntity:
            item.type === "chapter"
              ? "ChapterDef"
              : item.type === "topic"
                ? "TopicDef"
                : item.type === "note"
                  ? "TopicNote"
                  : "GeneratedTest",
          targetId: item.id,
          action: item.action === "approve" ? "CONTENT_APPROVE" : "CONTENT_REJECT",
          newValue: {
            status: item.action === "reject" ? "rejected" : "approved",
          },
        })),
      });
    });

    // Cache invalidation outside the transaction (best-effort)
    const uniqueNoteTopics = [...new Set(topicIdsForNoteCache)];
    const uniqueTestTopics = [...new Set(topicIdsForTestCache)];
    await Promise.all([
      ...uniqueNoteTopics.flatMap((topicId) => [
        cacheDelPattern(`notes:for-topic:v1:${topicId}:*`).catch(() => {}),
        cacheDelPattern(`notes:topic-content:v1:${topicId}:*`).catch(() => {}),
      ]),
      ...uniqueTestTopics.map((topicId) =>
        cacheDelPattern(`questions:for-topic:v1:${topicId}:*`).catch(() => {}),
      ),
    ]);

    logger.info("Bulk content approval completed", {
      adminId: session.user.id,
      count: items.length,
    });

    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    logger.error("Bulk content approval failed", { error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
