#!/usr/bin/env node
// CommonJS runner for marking a user admin (compatible with package.json type: module)
'use strict';

const fs = require('fs');
const path = require('path');
const { PrismaClient, UserRole } = require('@prisma/client');

// Load .env.local/.env into process.env for local script runs (set defaults only)
function loadEnvFileIfPresent() {
  try {
    const root = path.resolve(__dirname, '..');
    const candidates = ['.env.production', '.env.local', '.env'];
    for (const name of candidates) {
      const p = path.join(root, name);
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, 'utf8');
      const lines = raw.split(/\r?\n/);
      for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        const m = line.match(/^([^=\s]+)=((?:\".*\")|(?:'.*')|.*)$/);
        if (!m) continue;
        const key = m[1];
        let val = m[2];
        // strip quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        // Only set if not already provided in environment (imitates bash default assignment)
        if (typeof process.env[key] === 'undefined' || process.env[key] === '') {
          process.env[key] = val;
        }
      }
      console.log(`[env-loader] loaded ${p}`);
      break;
    }
  } catch (e) {
    // Non-fatal for CI/container environments
    console.warn('[env-loader] failed to load .env file', e && e.message);
  }
}

loadEnvFileIfPresent();
const prisma = new PrismaClient();

const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};



async function main() {
  const email = process.argv[2];
  if (!email) {
    logger.error('Usage: node scripts/mark-admin.cjs <user-email>');
    process.exit(1);
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    logger.error(`User not found for email: ${email}`);
    process.exit(1);
  }
  await prisma.user.update({ where: { email }, data: { role: UserRole.admin } });
  logger.info(`User ${email} marked as admin.`);
}

main()
  .catch((e) => {
    logger.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
