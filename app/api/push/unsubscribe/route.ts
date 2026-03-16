/**
 * POST /api/push/unsubscribe
 *
 * Removes a Web Push API subscription for the authenticated user.
 * Infrastructure only — actual push sending is a post-MVP feature.
 *
 * Body: { endpoint: string }
 * Response: { unsubscribed: true }
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { AppSession } from '@/lib/types/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { endpoint } = body;
  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
  }

  await prisma.pushSubscriptionRecord.deleteMany({
    where: {
      userId: session.user.id,
      endpoint,
    },
  });

  return NextResponse.json({ unsubscribed: true });
}
