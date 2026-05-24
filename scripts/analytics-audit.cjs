#!/usr/bin/env node
/**
 * FILE OBJECTIVE:
 * - Audit analytics event coverage by counting 30-day occurrences for each event in the canonical registry.
 * - Generate a markdown report at analytics-audit.md for quick review.
 *
 * LINKED UNIT TEST:
 * - tests/unit/scripts/analytics-audit.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | convert script from .js to .cjs for CommonJS compatibility and add required file header
 */

const fs = require('fs');
const path = require('path');
require('./_env-loader').loadEnv();
const { PrismaClient } = require('@prisma/client');

async function main(){
  const file = path.resolve(__dirname, '..', 'lib', 'analytics', 'events.ts');
  if(!fs.existsSync(file)){
    console.error('events.ts not found at', file);
    process.exit(1);
  }
  const content = fs.readFileSync(file, 'utf8');
  const regex = /:\s*'([^']+)'/g;
  const events = new Set();
  let m;
  while((m = regex.exec(content)) !== null){
    events.add(m[1]);
  }
  const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  const since30d = new Date(Date.now() - 30*24*60*60*1000);
  const rows = [];
  for(const ev of Array.from(events).sort()){
    try{
      const count = await prisma.analyticsEvent.count({ where: { eventType: ev, createdAt: { gte: since30d } } });
      rows.push({ event: ev, count });
    }catch(err){
      console.error('DB query failed for', ev, err.message || err);
      rows.push({ event: ev, count: null, error: String(err) });
    }
  }
  const out = ['# Analytics registry audit (last 30 days)','', '| event | 30d count |', '|---|---|'];
  for(const r of rows){
    out.push(`| ${r.event} | ${r.count === null ? 'ERROR' : r.count} |`);
  }
  fs.writeFileSync(path.resolve(__dirname, '..', 'analytics-audit.md'), out.join('\n'));
  console.log('Wrote analytics-audit.md');
  await prisma.$disconnect();
}

main().catch(err=>{ console.error(err); process.exit(1); });