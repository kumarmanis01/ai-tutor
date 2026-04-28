/**
 * FILE OBJECTIVE:
 * - Create/verify time-limited HMAC-signed tokens used in parent alert links.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-mute.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger';

const SECRET = process.env.PARENT_ALERT_SIGNING_SECRET || process.env.NEXTAUTH_SECRET || '';

function base64urlEncode(input: string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(input: string) {
  // restore padding
  let s = input.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString('utf8');
}

export type MuteTokenPayload = {
  parentStudentId: string;
  studentId: string;
  muteDays: number;
  expiresAt: string;
};

export function generateMuteToken(opts: {
  parentStudentId: string;
  studentId: string;
  muteDays?: number;
  tokenTTLSeconds?: number;
}) {
  const { parentStudentId, studentId, muteDays = 7, tokenTTLSeconds = 30 * 24 * 60 * 60 } = opts;
  const expiresAt = new Date(Date.now() + tokenTTLSeconds * 1000).toISOString();
  const payload = `${parentStudentId}|${studentId}|${muteDays}|${expiresAt}`;
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${base64urlEncode(payload)}.${sig}`;
}

export function verifyMuteToken(token: string): MuteTokenPayload | null {
  if (!token) return null;
  const idx = token.lastIndexOf('.');
  if (idx <= 0) return null;
  const b64 = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  let payload: string;
  try {
    payload = base64urlDecode(b64);
  } catch (e) {
    logger.debug('verifyMuteToken: base64 decode failed', { error: String(e) });
    return null;
  }

  const parts = payload.split('|');
  if (parts.length !== 4) return null;
  const [parentStudentId, studentId, muteDaysStr, expiresAt] = parts;
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  try {
    const sigBuf = Buffer.from(sig || '', 'hex');
    const expBuf = Buffer.from(expected || '', 'hex');
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  } catch {
    return null;
  }

  const now = new Date();
  const expDate = new Date(expiresAt);
  if (isNaN(expDate.getTime()) || expDate <= now) return null;

  const muteDays = Number(muteDaysStr || '0');
  return { parentStudentId, studentId, muteDays, expiresAt };
}
