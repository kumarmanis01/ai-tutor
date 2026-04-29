/*
 * FILE OBJECTIVE:
 * - CommonJS seed script to create an initial Super Admin from environment variables.
 * - Runnable on AlmaLinux VPS without TypeScript/ts-node.
 *
 * LINKED UNIT TEST:
 * - tests/unit/prisma/seed.spec.ts (TS unit tests still target prisma/seed.ts)
 *
 * EDIT LOG:
 * - 2026-04-29T00:00:00Z | copilot | added CJS seed wrapper for VPS
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

function loadEnv() {
  const root = path.resolve(__dirname, '..');
  for (const name of ['.env.production', '.env', '.env.local']) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    for (let line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/^([^=\s]+)=((?:".*")|(?:'.*')|.*)$/);
      if (!m) continue;
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
    console.log(`[env] loaded ${p}`);
    break;
  }
}

loadEnv();

// Avoid requiring TypeScript/ESM modules from a CJS script. Instantiate a
// PrismaClient directly so the script can run on systems without a compiled
// ESM build present (e.g., AlmaLinux VPS run from repo root).
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function validateInitialPassword(pw) {
  const issues = [];
  if (!pw || pw.length < 16) issues.push('minimum 16 characters');
  if (!/[A-Z]/.test(pw)) issues.push('at least one uppercase letter');
  if (!/[a-z]/.test(pw)) issues.push('at least one lowercase letter');
  if (!/\d/.test(pw)) issues.push('at least one number');
  if (!/[^A-Za-z0-9]/.test(pw)) issues.push('at least one special character');
  return { ok: issues.length === 0, issues };
}

async function seedSuperAdmin() {
  const email = process.env.INITIAL_SUPER_ADMIN_EMAIL;
  const name = process.env.INITIAL_SUPER_ADMIN_NAME;
  const password = process.env.INITIAL_SUPER_ADMIN_PASSWORD;

  if (!email || !name || !password) {
    console.error('Missing one of required env vars: INITIAL_SUPER_ADMIN_EMAIL / NAME / PASSWORD');
    throw new Error('missing_initial_super_admin_env');
  }

  const existing = await prisma.adminUser.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (existing) {
    console.log('ℹ️ Super Admin already exists. Skipping creation.');
    return;
  }

  const { ok, issues } = validateInitialPassword(password);
  if (!ok) {
    console.error('Initial super admin password does not meet requirements:', issues.join(', '));
    throw new Error('initial_super_admin_password_policy_failed');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: String(email).toLowerCase(),
        name,
        role: 'admin',
        passwordHash,
        accountStatus: 'active',
        language:'en',
      },
    });

    await tx.adminUser.create({
      data: {
        userId: user.id,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        passwordHash,
        mfaEnabled: false,
      },
    });
  });

  console.log(`✅ Initial Super Admin created: ${email}`);
}

if (require.main === module) {
  seedSuperAdmin()
    .then(() => prisma.$disconnect().then(() => process.exit(0)))
    .catch((err) => {
      // Ensure we disconnect Prisma and surface a concise error message.
      prisma
        .$disconnect()
        .catch(() => {})
        .finally(() => {
          console.error('seedSuperAdmin failed:', err && err.message ? err.message : String(err));
          process.exit(1);
        });
    });
}

module.exports = { seedSuperAdmin };
