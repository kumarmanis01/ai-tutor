import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSessionForHandlers } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSessionForHandlers();
  const role = (session?.user as any)?.role ?? null;
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const chapters = await prisma.chapterDef.findMany({
    where: { status: "pending", lifecycle: "active" },
    include: {
      subject: true,
    },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json({ chapters })
}
