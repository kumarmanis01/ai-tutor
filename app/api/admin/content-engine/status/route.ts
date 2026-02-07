import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminOrModerator } from '@/lib/auth';
import { isSystemSettingEnabled } from '@/lib/systemSettings';

export async function GET() {
  await requireAdminOrModerator();

  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'AI_PAUSED' },
  });

  const paused = isSystemSettingEnabled(setting?.value);

  return NextResponse.json({
    status: paused ? 'paused' : 'running',
    paused,
  });
}
