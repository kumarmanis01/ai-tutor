/*
 * FILE OBJECTIVE:
 * - Inspect the seeded Super Admin record and verify the provided password
 *   matches the stored bcrypt hash. Safe, console-only diagnostics.
 *
 * LINKED UNIT TEST:
 * - tests/unit/prisma/seed.spec.ts (related)
 *
 * EDIT LOG:
 * - 2026-04-29T00:00:00Z | copilot | added inspection script for super admin login issues
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

function loadEnv() {
  const root = path.resolve(__dirname, '..');
  for (const name of ['.env', '.env.production', '.env.local']) {
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
    // stop after first env file found
    break;
  }
}

loadEnv();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = process.env.INITIAL_SUPER_ADMIN_EMAIL;
  const supplied = process.env.INITIAL_SUPER_ADMIN_PASSWORD;

  if (!email) {
    console.error('Please set INITIAL_SUPER_ADMIN_EMAIL in your environment or .env');
    process.exit(2);
  }

  console.log('Inspecting admin for:', email);

  const admin = await prisma.adminUser.findFirst({
    where: { user: { email: String(email).toLowerCase() } },
    include: { user: { select: { id: true, email: true, passwordHash: true } } },
  });

  if (!admin) {
    console.error('No AdminUser record found for that email.');
    process.exit(3);
  }

  const info = {
    adminId: admin.id,
    role: admin.role,
    status: admin.status,
    mfaEnabled: Boolean(admin.mfaEnabled),
    failedLoginAttempts: admin.failedLoginAttempts || 0,
    lockoutUntil: admin.lockoutUntil ? admin.lockoutUntil.toISOString() : null,
    userId: admin.user?.id ?? null,
    userEmail: admin.user?.email ?? null,
  };

  console.log('Record summary:', JSON.stringify(info, null, 2));

  // Detect hash type without printing it
  const ah = admin.passwordHash || admin.user?.passwordHash || null;
  if (!ah) {
    console.error('No password hash found on admin/user records.');
    await prisma.$disconnect();
    process.exit(4);
  }

  const hashType = /^\$2[aby]\$\d{2}\$/.test(ah) ? 'bcrypt' : 'unknown';
  console.log('Stored password hash type:', hashType);

  if (!supplied) {
    console.log('No INITIAL_SUPER_ADMIN_PASSWORD provided in env to verify.');
    await prisma.$disconnect();
    process.exit(0);
  }

  const matchesAdmin = await bcrypt.compare(supplied, admin.passwordHash || '');
  const matchesUser = admin.user?.passwordHash ? await bcrypt.compare(supplied, admin.user.passwordHash) : false;

  console.log('Password matches admin.passwordHash:', matchesAdmin);
  console.log('Password matches user.passwordHash:', matchesUser);

  if (admin.passwordHash && admin.user && admin.passwordHash !== admin.user.passwordHash) {
    console.warn('Warning: admin.passwordHash and user.passwordHash differ (expected to be the same after seeding).');
  }

  await prisma.$disconnect();

  if (matchesAdmin || matchesUser) {
    console.log('✅ Supplied password matches stored hash.');
    process.exit(0);
  }

  console.error('❌ Supplied password does NOT match stored hash.');
  console.error('If the seed used a pre-hashed value, run scripts/fix-superadmin-password.cjs to correct the stored hash.');
  console.error('Alternatively, re-run `npm run seed:superadmin` after removing the existing SUPER_ADMIN record.');
  process.exit(5);
}

main().catch((err) => {
  console.error('inspect-superadmin failed:', err && err.message ? err.message : String(err));
  prisma
    .$disconnect()
    .catch(() => {})
    .finally(() => process.exit(1));
});
