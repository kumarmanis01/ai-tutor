#!/usr/bin/env node
import { prisma } from '../lib/prisma';
const fs = require('fs');
const path = require('path');

function printManualSQL() {
  console.log('\nManual SQL queries you can run against Postgres (psql or any client):\n');
  console.log('-- Total TopicNote rows');
  console.log('SELECT count(*) FROM "TopicNote";\n');
  console.log('-- Vidya-format: has non-empty sections array (adjust column name as needed)');
  console.log(
    "SELECT count(*) FROM \"TopicNote\" WHERE (content_json -> 'sections') IS NOT NULL AND jsonb_typeof(content_json -> 'sections') = 'array' AND jsonb_array_length(content_json -> 'sections') > 0;\n"
  );
  console.log('-- Legacy-format: presence of common flat fields (adjust column name as needed)');
  console.log(
    "SELECT count(*) FROM \"TopicNote\" WHERE (content_json ? 'explanation') OR (content_json ? 'concept') OR (content_json ? 'notes') OR (content_json ? 'example') OR (content_json ? 'keyPoints') OR (content_json ? 'commonMistakes');\n"
  );
  console.log('-- Unknown/other shapes (total - vidya - legacy):');
  console.log('-- Compute: total - (vidya + legacy)');
}

async function main() {
  const envDb = process.env.DATABASE_URL;
  let dbUrl = envDb;
  if (!dbUrl) {
    // try to read .env.local
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const m = content.match(/DATABASE_URL=(.+)/);
      if (m) dbUrl = m[1].trim().replace(/(^\"|\"$)/g, '');
    }
  }

  if (!dbUrl) {
    console.error('No DATABASE_URL found in environment or .env.local.');
    printManualSQL();
    process.exit(2);
  }

  let PrismaClient;
  try {
    PrismaClient = require('@prisma/client').PrismaClient;
  } catch (e) {
    console.error(
      'Failed to load @prisma/client. Ensure dependencies are installed and `prisma generate` has been run.'
    );
    console.error(e?.message || e);
    printManualSQL();
    process.exit(3);
  }

  try {
    await prisma.$connect();

    // Find candidate TopicNote table names (case-insensitive match)
    const tblRes = await prisma.$queryRawUnsafe(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND (table_name ILIKE '%topic%note%' OR (table_name ILIKE '%topic%' AND table_name ILIKE '%note%'))
      ORDER BY table_name
    `);

    const tables = Array.isArray(tblRes) ? tblRes.map((r) => r.table_name) : [];
    const tableName = tables.length > 0 ? tables[0] : 'TopicNote';

    // Discover column names for the table
    const colRes = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tableName.replace(/'/g, "''")}'`
    );
    const cols = Array.isArray(colRes) ? colRes.map((r) => r.column_name) : [];

    // Heuristics to find the JSON content column
    const contentColCandidates = cols.filter((c) => /content/i.test(c) || /json/i.test(c));
    const contentCol = contentColCandidates.length > 0 ? contentColCandidates[0] : 'contentJson';

    // Ensure we quote identifiers properly for case-sensitivity
    const tq = (s) => '"' + s.replace(/"/g, '""') + '"';

    // Build queries using discovered table/column names
    const totalQ = `SELECT count(*)::int as cnt FROM ${tq(tableName)}`;
    const vidyaCond = `(${tq(contentCol)} -> 'sections') IS NOT NULL AND jsonb_typeof(${tq(contentCol)} -> 'sections') = 'array' AND jsonb_array_length(${tq(contentCol)} -> 'sections') > 0`;
    const legacyCond = `(${tq(contentCol)} ? 'explanation') OR (${tq(contentCol)} ? 'concept') OR (${tq(contentCol)} ? 'notes') OR (${tq(contentCol)} ? 'example') OR (${tq(contentCol)} ? 'keyPoints') OR (${tq(contentCol)} ? 'commonMistakes')`;

    const vidyaQ = `SELECT count(*)::int as cnt FROM ${tq(tableName)} WHERE ${vidyaCond}`;
    const legacyQ = `SELECT count(*)::int as cnt FROM ${tq(tableName)} WHERE ${legacyCond}`;
    const bothQ = `SELECT count(*)::int as cnt FROM ${tq(tableName)} WHERE (${vidyaCond}) AND (${legacyCond})`;
    const vidyaOnlyQ = `SELECT count(*)::int as cnt FROM ${tq(tableName)} WHERE (${vidyaCond}) AND NOT (${legacyCond})`;
    const legacyOnlyQ = `SELECT count(*)::int as cnt FROM ${tq(tableName)} WHERE (${legacyCond}) AND NOT (${vidyaCond})`;
    const neitherQ = `SELECT count(*)::int as cnt FROM ${tq(tableName)} WHERE NOT ((${vidyaCond}) OR (${legacyCond}))`;

    // Execute
    const [totalRes, vidyaRes, legacyRes, bothRes, vidyaOnlyRes, legacyOnlyRes, neitherRes] =
      await Promise.all([
        prisma.$queryRawUnsafe(totalQ),
        prisma.$queryRawUnsafe(vidyaQ),
        prisma.$queryRawUnsafe(legacyQ),
        prisma.$queryRawUnsafe(bothQ),
        prisma.$queryRawUnsafe(vidyaOnlyQ),
        prisma.$queryRawUnsafe(legacyOnlyQ),
        prisma.$queryRawUnsafe(neitherQ),
      ]);

    const total = Array.isArray(totalRes) ? totalRes[0].cnt : (totalRes?.cnt ?? totalRes);
    const vidya = Array.isArray(vidyaRes) ? vidyaRes[0].cnt : (vidyaRes?.cnt ?? vidyaRes);
    const legacy = Array.isArray(legacyRes) ? legacyRes[0].cnt : (legacyRes?.cnt ?? legacyRes);
    const both = Array.isArray(bothRes) ? bothRes[0].cnt : (bothRes?.cnt ?? bothRes);
    const vidyaOnly = Array.isArray(vidyaOnlyRes)
      ? vidyaOnlyRes[0].cnt
      : (vidyaOnlyRes?.cnt ?? vidyaOnlyRes);
    const legacyOnly = Array.isArray(legacyOnlyRes)
      ? legacyOnlyRes[0].cnt
      : (legacyOnlyRes?.cnt ?? legacyOnlyRes);
    const neither = Array.isArray(neitherRes) ? neitherRes[0].cnt : (neitherRes?.cnt ?? neitherRes);

    console.log('\nAudit results: TopicNote rows by shape:\n');
    console.log(`Detected table: ${tableName}`);
    console.log(`Detected content column: ${contentCol}`);
    console.log(`Total TopicNote rows: ${total}`);
    console.log(`Vidya-format (sections array present): ${vidya}`);
    console.log(`Legacy-format (flat fields detected): ${legacy}`);
    console.log(`Both Vidya & Legacy fields present: ${both}`);
    console.log(`Vidya-only: ${vidyaOnly}`);
    console.log(`Legacy-only: ${legacyOnly}`);
    console.log(`Neither format detected: ${neither}`);

    process.exit(0);
  } catch (err) {
    console.error('Query failed:', err?.message || err);
    printManualSQL();
    process.exit(4);
  } finally {
    try {
      await prisma.$disconnect();
    } catch {}
  }
}

main();
