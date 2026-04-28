import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function getYesterdayIstBounds() {
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  const todayMidnight = new Date(nowIst);
  todayMidnight.setUTCHours(0, 0, 0, 0);
  const yesterdayMidnight = new Date(todayMidnight.getTime() - 24 * 60 * 60 * 1000);
  return {
    start: new Date(yesterdayMidnight.getTime() - IST_OFFSET_MS),
    end: new Date(todayMidnight.getTime() - IST_OFFSET_MS),
  };
}

type SessionRow = {
  id: string;
  studentId: string;
  startedAt: Date;
  completedAt: Date | null;
  turnCount: number;
};

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { start, end } = getYesterdayIstBounds();

  const [rows, totalRow] = await Promise.all([
    prisma.$queryRaw<SessionRow[]>`
      SELECT s.id, s."studentId", s."startedAt", s."completedAt",
             COUNT(t.id)::int AS "turnCount"
      FROM "StructuredSession" s
      JOIN "AITutorTurnLog" t ON t."sessionId" = s.id
      WHERE s."startedAt" >= ${start} AND s."startedAt" < ${end}
      GROUP BY s.id, s."studentId", s."startedAt", s."completedAt"
      ORDER BY RANDOM()
      LIMIT 10
    `,
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT s.id) FROM "StructuredSession" s
      JOIN "AITutorTurnLog" t ON t."sessionId" = s.id
      WHERE s."startedAt" >= ${start} AND s."startedAt" < ${end}
    `,
  ]);

  const totalYesterday = Number(totalRow[0]?.count ?? 0);

  const sessions = await Promise.all(
    rows.map(async (row) => {
      const turns = await prisma.aITutorTurnLog.findMany({
        where: { sessionId: row.id },
        orderBy: { createdAt: 'asc' },
        take: 5,
        select: {
          id: true,
          callType: true,
          tag: true,
          stage: true,
          qualityFlag: true,
          createdAt: true,
        },
      });
      return { ...row, turns };
    })
  );

  const date = start.toISOString().slice(0, 10);
  return NextResponse.json({ sessions, date, totalYesterday });
}
