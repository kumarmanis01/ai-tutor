/*
 * FILE OBJECTIVE:
 * - Fix Super Admin stored passwordHash when env contains a pre-hashed bcrypt
 *   value or a plaintext password was used incorrectly during seeding.
 *
 * USAGE:
 *   # Ensure env contains INITIAL_SUPER_ADMIN_EMAIL and INITIAL_SUPER_ADMIN_PASSWORD
 *   node scripts/fix-superadmin-password.cjs
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
    break;
  }
}

loadEnv();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const email = process.env.INITIAL_SUPER_ADMIN_EMAIL;
  const supplied = process.env.INITIAL_SUPER_ADMIN_PASSWORD;

  if (!email || !supplied) {
    console.error('Please set INITIAL_SUPER_ADMIN_EMAIL and INITIAL_SUPER_ADMIN_PASSWORD in environment');
    process.exit(2);
  }

  // Detect bcrypt hash pattern (e.g. $2a$12$...)
  const isBcrypt = /^\$2[aby]\$\d{2}\$/.test(supplied);
  const passwordHash = isBcrypt ? supplied : await bcrypt.hash(supplied, 12);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error('No user found with email:', email);
    process.exit(3);
  }

  // Update both user and adminUser passwordHash where applicable
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await prisma.adminUser.updateMany({ where: { userId: user.id }, data: { passwordHash } });

  console.log('✅ Super Admin passwordHash updated for', email);
}

run()
  .catch((err) => {
    console.error('fix-superadmin-password failed:', err && err.message ? err.message : String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
