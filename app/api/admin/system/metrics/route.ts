import { NextResponse } from 'next/server';
import { requireAdminOrModerator } from '@/lib/auth';
import { queryMetricSamples } from '@/lib/telemetry';
import { systemHealth } from '@/lib/systemHealth';
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
    const from = parseISO(url.searchParams.get('from'), new Date(Date.now() - 1000 * 60 * 60)); // 1h default
    const to = parseISO(url.searchParams.get('to'), new Date());
    const interval = Math.max(10, Number(url.searchParams.get('interval') || '60'));

    // Hard limits
    const maxRangeMs = 1000 * 60 * 60 * 24 * 7; // 7 days
    if (to.getTime() - from.getTime() > maxRangeMs) {
      return NextResponse.json({ error: 'range_too_large' }, { status: 400 });
    }

    const samples = await queryMetricSamples(from, to);
    if (!samples || samples.length === 0) {
      // fallback to live snapshot
      const h = await systemHealth();
      return NextResponse.json({ range: { from: from.toISOString(), to: to.toISOString(), intervalSec: interval }, samples: [h] });
    }

    return NextResponse.json({ range: { from: from.toISOString(), to: to.toISOString(), intervalSec: interval }, samples });
  } catch (err: any) {
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}
