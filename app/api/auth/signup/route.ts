import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcrypt';
import type { SessionUser } from '@/lib/types';
import { logger } from '@/lib/logger';
import { logApiUsage } from '@/utils/logApiUsage';

type SignupBody = Pick<SessionUser, 'name' | 'email' | 'parentEmail' | 'grade'> & {
  profileImage?: string;
  password?: string;
  country?: string;
};

const CLASS_NAME = 'AuthSignupRoute';

export async function POST(req: NextRequest) {
  logApiUsage('/api/auth/signup', 'POST');
  const METHOD_NAME = 'POST';
  await logger.logRouteInfo(req, undefined, { className: CLASS_NAME, methodName: METHOD_NAME });

  const { name, email, parentEmail, profileImage, grade, password, country }: SignupBody =
    await req.json();

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const response = NextResponse.json({ error: 'User exists' }, { status: 409 });
    await logger.logRouteInfo(req, response, { className: CLASS_NAME, methodName: METHOD_NAME });
    return response;
  }

  // Hash the password if provided
  let passwordHash: string | undefined = undefined;
  if (password) {
    passwordHash = await bcrypt.hash(password, 10);
  }

  // Create user
  await prisma.user.create({
    data: {
      name,
      email,
      parentEmail: parentEmail || null,
      image: profileImage || null,
      grade: grade || null,
      passwordHash: passwordHash || null,
      country: country || null, // <-- Add country
    },
  });

  const response = NextResponse.json({ ok: true });
  await logger.logRouteInfo(req, response, { className: CLASS_NAME, methodName: METHOD_NAME });
  return response;
}
