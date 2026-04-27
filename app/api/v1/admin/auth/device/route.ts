/**
 * FILE OBJECTIVE:
 * - Register/update an admin trusted device after successful MFA verification.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/auth/device/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T19:01:00Z | copilot | added admin trusted-device endpoint for remember-device flow
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAccessToken } from '@/lib/auth/token.service';
import {
  computeTrustedDeviceHash,
  extractClientIp,
  signAdminDeviceToken,
  toIpv4Subnet24,
} from '@/lib/admin/authSecurity';

export const dynamic = 'force-dynamic';

function getBearerToken(req: Request): string {
  const header = req.headers.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() === 'bearer' && token) {
    return token;
  }
  return '';
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { accessToken?: string; label?: string };
  const accessToken =
    typeof body.accessToken === 'string' && body.accessToken ? body.accessToken : getBearerToken(req);

  if (!accessToken) {
    return NextResponse.json({ error: 'missing_access_token' }, { status: 400 });
  }

  const claims = await verifyAdminAccessToken(accessToken).catch(() => null);
  if (!claims || claims.scope !== 'admin') {
    return NextResponse.json({ error: 'invalid_access_token' }, { status: 401 });
  }

  const admin = await prisma.adminUser.findFirst({
    where: { userId: claims.sub, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!admin) {
    return NextResponse.json({ error: 'admin_not_found' }, { status: 404 });
  }

  const ip = extractClientIp(req);
  const ipSubnet = toIpv4Subnet24(ip);
  const userAgent = req.headers.get('user-agent') ?? 'unknown';
  const fingerprint = computeTrustedDeviceHash(userAgent, ipSubnet);
  const deviceToken = await signAdminDeviceToken(admin.id, ipSubnet);

  await prisma.adminTrustedDevice.upsert({
    where: {
      adminUserId_deviceHash: {
        adminUserId: admin.id,
        deviceHash: fingerprint,
      },
    },
    create: {
      adminUserId: admin.id,
      deviceHash: fingerprint,
      ipSubnet,
      fingerprint,
      deviceToken,
      label: typeof body.label === 'string' ? body.label.trim().slice(0, 80) : 'Remembered device',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastUsedAt: new Date(),
    },
    update: {
      ipSubnet,
      fingerprint,
      deviceToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastUsedAt: new Date(),
      label: typeof body.label === 'string' ? body.label.trim().slice(0, 80) : undefined,
    },
  });

  return NextResponse.json({ ok: true, deviceToken, expiresInDays: 30 });
}
