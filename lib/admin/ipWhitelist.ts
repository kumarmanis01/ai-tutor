/**
 * FILE OBJECTIVE:
 * - Evaluate admin IP whitelist rules from ADMIN_ALLOWED_IPS and enforce CIDR/network checks.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/admin/ipWhitelist.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T18:35:00Z | copilot | created ADMIN_ALLOWED_IPS CIDR whitelist helper with localhost dev bypass
 */

function ipv4ToLong(ip: string): number | null {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return null;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function parseCidr(cidr: string): { base: number; mask: number } | null {
  const [ip, prefixRaw] = cidr.trim().split('/');
  const prefix = Number(prefixRaw);
  if (!ip || Number.isNaN(prefix) || prefix < 0 || prefix > 32) {
    return null;
  }
  const baseLong = ipv4ToLong(ip);
  if (baseLong === null) {
    return null;
  }
  const mask = prefix === 0 ? 0 : (~((1 << (32 - prefix)) - 1)) >>> 0;
  return { base: baseLong, mask };
}

function isLocalhost(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip.toLowerCase() === 'localhost';
}

export function isAllowedAdminIp(ip: string): boolean {
  const allowedRaw = process.env.ADMIN_ALLOWED_IPS ?? '';

  // No whitelist configured means allow by default.
  if (!allowedRaw.trim()) {
    return true;
  }

  if (process.env.NODE_ENV !== 'production' && isLocalhost(ip)) {
    return true;
  }

  const ipLong = ipv4ToLong(ip);
  if (ipLong === null) {
    return false;
  }

  const cidrs = allowedRaw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  for (const cidr of cidrs) {
    const parsed = parseCidr(cidr);
    if (!parsed) {
      continue;
    }
    if ((ipLong & parsed.mask) === (parsed.base & parsed.mask)) {
      return true;
    }
  }

  return false;
}
