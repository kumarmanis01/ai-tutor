/**
 * FILE OBJECTIVE:
 * - API endpoint to approve or reject draft content (notes, tests).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/content/approve/route.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22T04:10:00Z | copilot | Rewrote approval API to properly update status field
 */

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getServerSessionForHandlers } from "@/lib/session";

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { type, id, action = 'approve', reason } = await req.json();
    
    if (!type || !id) {
      return NextResponse.json({ success: false, error: "Type and ID are required" }, { status: 400 });
    }

    if (!['note', 'test'].includes(type)) {
      return NextResponse.json({ success: false, error: "Only 'note' and 'test' types support approval" }, { status: 400 });
    }

    const newStatus = action === 'reject' ? 'rejected' : 'approved';

    // Update the content status
    switch (type) {
      case 'note':
        await prisma.topicNote.update({
          where: { id },
          data: { status: newStatus },
        });
        break;
      case 'test':
        await prisma.generatedTest.update({
          where: { id },
          data: { status: newStatus },
        });
        break;
    }

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: `${action}_${type}`,
        details: {
          entityType: type,
          entityId: id,
          newStatus,
          reason: reason || null,
        },
      },
    });

    logger.info(`Content ${action}d`, { type, id, adminId: session.user.id, newStatus });

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    logger.error("Content approval failed", { error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
