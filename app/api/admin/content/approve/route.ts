/**
 * FILE OBJECTIVE:
 * - API endpoint to approve or reject draft content (syllabus, chapters, topics, notes, tests).
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
 * - 2026-01-22T06:55:00Z | copilot | Added support for all hydrated content types: syllabus, chapters, topics
 */

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getServerSessionForHandlers } from "@/lib/session";

const SUPPORTED_TYPES = ['syllabus', 'chapter', 'topic', 'note', 'test'] as const;
type ContentType = typeof SUPPORTED_TYPES[number];

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

    if (!SUPPORTED_TYPES.includes(type as ContentType)) {
      return NextResponse.json({ 
        success: false, 
        error: `Unsupported type. Allowed: ${SUPPORTED_TYPES.join(', ')}` 
      }, { status: 400 });
    }

    // Determine new status based on type and action
    // Syllabus uses SyllabusStatus (DRAFT, APPROVED, ARCHIVED)
    // Others use ApprovalStatus (draft, approved, rejected)
    const isSyllabus = type === 'syllabus';
    const newStatus = isSyllabus
      ? (action === 'reject' ? 'DRAFT' : 'APPROVED') // Syllabus: DRAFT or APPROVED (no rejected state)
      : (action === 'reject' ? 'rejected' : 'approved'); // Others: draft, approved, rejected

    // Update the content status
    switch (type) {
      case 'syllabus':
        await prisma.syllabus.update({
          where: { id },
          data: { status: newStatus as 'DRAFT' | 'APPROVED' | 'ARCHIVED' },
        });
        break;
      case 'chapter':
        await prisma.chapterDef.update({
          where: { id },
          data: { status: newStatus as 'draft' | 'approved' | 'rejected' },
        });
        break;
      case 'topic':
        await prisma.topicDef.update({
          where: { id },
          data: { status: newStatus as 'draft' | 'approved' | 'rejected' },
        });
        break;
      case 'note':
        await prisma.topicNote.update({
          where: { id },
          data: { status: newStatus as 'draft' | 'approved' | 'rejected' },
        });
        break;
      case 'test':
        await prisma.generatedTest.update({
          where: { id },
          data: { status: newStatus as 'draft' | 'approved' | 'rejected' },
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
