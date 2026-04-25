/**
 * FILE OBJECTIVE:
 * - Shared security helpers for admin invite, MFA setup/verification, and login session handling.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/admin/authSecurity.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created admin invite and MFA security helpers
 */

import { createHash, createHmac, randomBytes } from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'protonmail.com',
  'aol.com',
]);

export interface PasswordValidationResult {
  valid: boolean;
  issues: string[];
}

interface AdminLoginSessionClaims {
  adminUserId: string;
  role: string;
  type: 'admin_login_session';
}

interface SignedTokenPayload {
  sub: string;
  role?: string;
  type: 'admin_login_session' | 'admin_device';
  subnet24?: string;
  exp: number;
}

function getAdminAccessSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error('Missing required environment variable: ADMIN_JWT_ACCESS_SECRET');
  }
  return new TextEncoder().encode(secret);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isCorporateEmail(email: string): boolean {
  const [, domain = ''] = normalizeEmail(email).split('@');
  return domain.length > 0 && !FREE_EMAIL_DOMAINS.has(domain);
}

export function validateAdminPassword(password: string): PasswordValidationResult {
  const issues: string[] = [];
  if (password.length < 12) issues.push('Minimum 12 characters required');
  if (!/[A-Z]/.test(password)) issues.push('At least one uppercase letter required');
  if (!/[a-z]/.test(password)) issues.push('At least one lowercase letter required');
  if (!/\d/.test(password)) issues.push('At least one number required');
  if (!/[^A-Za-z0-9]/.test(password)) issues.push('At least one special character required');
  return { valid: issues.length === 0, issues };
}

export function validateAdminName(name: string): boolean {
  const n = name.trim();
  return n.length >= 2 && n.length <= 100;
}

export function generateInviteToken(): string {
  return randomBytes(32).toString('hex');
}

function encodeBase32(input: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function decodeBase32(input: string): Uint8Array {
  const normalized = input.replace(/=+$/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const ch of normalized) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Uint8Array.from(bytes);
}

export function generateMfaSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function buildOtpAuthUri(email: string, secret: string): string {
  const issuer = encodeURIComponent('Spinzy Academy Admin');
  const account = encodeURIComponent(`Spinzy:${normalizeEmail(email)}`);
  const encodedSecret = encodeURIComponent(secret);
  return `otpauth://totp/${account}?secret=${encodedSecret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

function totpAt(secret: string, timestampMs: number, periodSec = 30, digits = 6): string {
  const key = decodeBase32(secret);
  const counter = Math.floor(timestampMs / 1000 / periodSec);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binaryCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binaryCode % 10 ** digits;
  return otp.toString().padStart(digits, '0');
}

export function verifyTotp(secret: string, code: string, window = 1): boolean {
  const cleaned = code.replace(/\D/g, '');
  if (cleaned.length !== 6) return false;

  const now = Date.now();
  for (let i = -window; i <= window; i += 1) {
    const candidate = totpAt(secret, now + i * 30_000);
    if (candidate === cleaned) {
      return true;
    }
  }
  return false;
}

export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => randomBytes(4).toString('hex').toUpperCase());
}

export function extractClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') ?? '';
  const firstForwarded = forwarded.split(',')[0]?.trim();
  if (firstForwarded) return firstForwarded;
  return req.headers.get('x-real-ip') ?? '0.0.0.0';
}

export function toIpv4Subnet24(ip: string): string {
  const match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return 'unknown';
  return `${match[1]}.${match[2]}.${match[3]}.0/24`;
}

export function computeTrustedDeviceHash(userAgent: string, subnet24: string): string {
  return createHash('sha256').update(`${userAgent}|${subnet24}`).digest('hex');
}

function toBase64Url(input: Buffer | string): string {
  const raw = Buffer.isBuffer(input) ? input.toString('base64') : Buffer.from(input).toString('base64');
  return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = pad === 0 ? normalized : `${normalized}${'='.repeat(4 - pad)}`;
  return Buffer.from(padded, 'base64');
}

function signToken(payload: SignedTokenPayload): string {
  const serialized = JSON.stringify(payload);
  const encoded = toBase64Url(serialized);
  const signature = toBase64Url(
    createHmac('sha256', Buffer.from(getAdminAccessSecret())).update(encoded).digest()
  );
  return `${encoded}.${signature}`;
}

function verifySignedToken(token: string): SignedTokenPayload {
  const [encodedPayload, encodedSignature] = token.split('.');
  if (!encodedPayload || !encodedSignature) {
    throw new Error('Invalid token format');
  }

  const expectedSignature = toBase64Url(
    createHmac('sha256', Buffer.from(getAdminAccessSecret())).update(encodedPayload).digest()
  );
  if (encodedSignature !== expectedSignature) {
    throw new Error('Invalid token signature');
  }

  const payload = JSON.parse(fromBase64Url(encodedPayload).toString('utf8')) as SignedTokenPayload;
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }
  return payload;
}

export async function signAdminLoginSessionToken(
  adminUserId: string,
  role: string
): Promise<string> {
  return signToken({
    sub: adminUserId,
    role,
    type: 'admin_login_session',
    exp: Math.floor(Date.now() / 1000) + 5 * 60,
  });
}

export async function verifyAdminLoginSessionToken(
  token: string
): Promise<AdminLoginSessionClaims> {
  const payload = verifySignedToken(token);
  if (!payload.sub || payload.type !== 'admin_login_session' || typeof payload.role !== 'string') {
    throw new Error('Invalid admin login session token');
  }
  return {
    adminUserId: payload.sub,
    role: payload.role,
    type: 'admin_login_session',
  };
}

export async function signAdminDeviceToken(adminUserId: string, subnet24: string): Promise<string> {
  return signToken({
    sub: adminUserId,
    type: 'admin_device',
    subnet24,
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  });
}
