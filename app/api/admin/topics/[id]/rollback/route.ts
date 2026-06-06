import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSessionForHandlers } from '@/lib/session';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSessionForHandlers();
  const role = (session?.user as any)?.role ?? null;
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await params;
  await prisma.topicDef.update({
    where: { id },
    data: { lifecycle: "deleted" },
  })

  return NextResponse.json({ success: true })
}
