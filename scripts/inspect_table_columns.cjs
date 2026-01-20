#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
function loadEnvFile(file) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const parts = trimmed.split('=', 2);
      if (parts.length === 2) {
        const k = parts[0].trim();
        const v = parts[1].trim();
        if (!process.env[k]) process.env[k] = v;
      }
    });
  } catch {}
}
loadEnvFile(path.resolve(process.cwd(), '.env.production'));
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async ()=>{
  try {
    const table = process.argv[2] || 'JobExecutionLog';
    const cols = await prisma.$queryRawUnsafe("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name = $1 ORDER BY ordinal_position", table);
    console.log(JSON.stringify(cols, null, 2));
  } catch (e) {
    console.error('ERROR', e && e.stack ? e.stack : e);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
})();
