/**
 * POST /api/push/subscribe
 *
 * Stores a Web Push API subscription for the authenticated user.
 * Infrastructure only — actual push sending is a post-MVP feature.
 *
 * Body: { subscription: PushSubscription }
 * Response: { subscribed: true }
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { AppSession } from '@/lib/types/auth';
import { prisma } from '@/lib/prisma';

interface PushSubscriptionBody {
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
}

export async function POST(request: Request) {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: PushSubscriptionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { subscription } = body;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  await prisma.pushSubscriptionRecord.upsert({
    where: {
      userId_endpoint: {
        userId: session.user.id,
        endpoint: subscription.endpoint,
      },
    },
    update: {
      keys: subscription.keys,
    },
    create: {
      userId: session.user.id,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    },
  });

  return NextResponse.json({ subscribed: true });
}
