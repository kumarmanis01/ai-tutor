import { NextResponse } from 'next/server';
import { requireAdminOrModerator } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { formatErrorForResponse } from '@/lib/errorResponse';

function parseISO(q: string | null, fallback: Date) {
  if (!q) return fallback;
  const d = new Date(q);
  if (isNaN(d.getTime())) return fallback;
  return d;
}

export async function GET(req: Request) {
  try {
    await requireAdminOrModerator();
    const url = new URL(req.url);
    const from = parseISO(url.searchParams.get('from'), new Date(Date.now() - 1000 * 60 * 60));
    const to = parseISO(url.searchParams.get('to'), new Date());
    const keysParam = url.searchParams.get('keys') || '';
    const keys = keysParam.split(',').map((k) => k.trim()).filter(Boolean);
    const bucketParam = (url.searchParams.get('bucket') || 'auto').toLowerCase();

    const rangeMs = to.getTime() - from.getTime();
    const MAX_MINUTE_RANGE_MS = 1000 * 60 * 60 * 24; // 24 hours
    const MAX_HOUR_RANGE_MS = 1000 * 60 * 60 * 24 * 90; // 90 days

    // Auto-select bucket: prefer minute for short ranges, otherwise hour.
    let bucket = bucketParam === 'minute' || bucketParam === 'hour' ? bucketParam : rangeMs <= MAX_MINUTE_RANGE_MS ? 'minute' : 'hour';

    // Defensive guard: if minute requested but range too large, switch to hour
    if (bucket === 'minute' && rangeMs > MAX_MINUTE_RANGE_MS) {
      bucket = 'hour';
    }
    // Reject overly large hour-range requests
    if (bucket === 'hour' && rangeMs > MAX_HOUR_RANGE_MS) {
      return NextResponse.json({ error: 'range_too_large_for_hour_bucket' }, { status: 400 });
    }

    const responseMeta: any = { requestedBucket: bucketParam, effectiveBucket: bucket };

    if (bucket === 'minute') {
      // return raw minute samples
      const where: any = { timestamp: { gte: from, lte: to } };
      if (keys.length > 0) where.key = { in: keys };
      const rows = await prisma.telemetrySample.findMany({ where, orderBy: { timestamp: 'asc' } });

      const series: Record<string, any> = {};
      for (const r of rows) {
        const seriesKey = `${r.key}::${r.dimensionHash}`;
        if (!series[seriesKey]) series[seriesKey] = { key: r.key, dimensions: r.dimensions ?? null, points: [] };
        series[seriesKey].points.push({ ts: r.timestamp.toISOString(), value: r.value });
      }

      return NextResponse.json({ range: { from: from.toISOString(), to: to.toISOString(), bucket: 'minute' }, series, meta: responseMeta });
    }

    // bucket === 'hour' -> aggregate by hour on the DB side
    // Use parameterized query to avoid SQL injection and use MIN(dimensions) for semantic correctness.
    const rows = await prisma.$queryRaw(
      Prisma.sql`
        SELECT "key", "dimensionHash", date_trunc('hour', "timestamp") as bucket_ts,
               AVG("value")::double precision as value, MIN("dimensions") as dimensions
        FROM "TelemetrySample"
        WHERE "timestamp" >= ${from.toISOString()} AND "timestamp" <= ${to.toISOString()}
        ${keys.length > 0 ? Prisma.sql`AND "key" = ANY(${keys})` : Prisma.empty}
        GROUP BY "key", "dimensionHash", bucket_ts
        ORDER BY bucket_ts ASC
      `
    ) as Array<any>;

    const series: Record<string, any> = {};
    for (const r of rows) {
      const dh = r.dimensionhash ?? r.dimensionHash;
      const seriesKey = `${r.key}::${dh}`;
      if (!series[seriesKey]) series[seriesKey] = { key: r.key, dimensions: r.dimensions ?? null, points: [] };
      series[seriesKey].points.push({ ts: new Date(r.bucket_ts).toISOString(), value: Number(r.value) });
    }

    return NextResponse.json({ range: { from: from.toISOString(), to: to.toISOString(), bucket: 'hour' }, series, meta: responseMeta });
  } catch (err: any) {
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}
