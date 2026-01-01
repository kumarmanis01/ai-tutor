import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

/**
 * POST /api/admin/syllabus/{id}/approve
 * - Only admins may call this endpoint (enforced by requireAdmin)
 * - Sets `status` to `APPROVED` on the Syllabus row
 * - Records approval metadata inside the persisted `json.approvalMetadata`
 * - Prevents re-approving an already approved syllabus
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();

  const id = params.id;

  // Fetch existing syllabus
  const existing = await prisma.syllabus.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (existing.status === 'APPROVED') {
    return NextResponse.json({ error: 'Already approved' }, { status: 400 });
  }

  // Build approval metadata inside the JSON payload (no schema change to DB)
  const now = new Date().toISOString();
  const prevJson = (existing.json as any) ?? {};
  const approvalMetadata = {
    ...(prevJson.approvalMetadata ?? {}),
    approvedAt: now,
  };
  const newJson = { ...prevJson, approvalMetadata };

  const updated = await prisma.syllabus.update({
    where: { id },
    data: {
      status: 'APPROVED',
      json: newJson,
    },
  });

  return NextResponse.json(updated);
}
