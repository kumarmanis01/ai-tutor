/**
 * FILE OBJECTIVE:
 * - Small utility to validate DB and API snippets from QA CSVs against a dev environment.
 *
 * LINKED UNIT TEST:
 * - tests/unit/scripts/validate_snippets.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot | created
 */

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const argv = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function parseCsv(content) {
  const rows = [];
  let cur = '';
  let inQuotes = false;
  let row = [];
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const nxt = content[i + 1];
    if (ch === '"') {
      if (inQuotes && nxt === '"') { cur += '"'; i++; continue; }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === ',') { row.push(cur); cur = ''; continue; }
    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && content[i + 1] === '\n') { i++; }
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur !== '' || row.length > 0) { row.push(cur); rows.push(row); }
  return rows;
}

function replacePlaceholders(text, vars) {
  if (!text || !vars) return text;
  return text.replace(/<([a-zA-Z0-9_\-@.]+)>/g, (m, p1) => {
    if (p1 in vars) return vars[p1];
    if (`<${p1}>` in vars) return vars[`<${p1}>`];
    return m;
  });
}

async function main() {
  const args = parseArgs();
  const file = args.file || 'docs/QA/STUDENT_TEST_CASES.csv';
  const apiBase = process.env.API_BASE_URL || args.apiBase || 'http://localhost:3000';
  const varsFile = args['vars-file'] || args['vars-file'] || process.env.QA_VARS_FILE || args.vars;
  const only = (args.only || 'both').toLowerCase(); // db, api, both
  const limit = parseInt(args.limit || '0', 10) || 0;

  let vars = {};
  if (process.env.QA_VARS) {
    try { vars = JSON.parse(process.env.QA_VARS); } catch (e) { console.error('QA_VARS JSON parse error', e.message); }
  }
  if (varsFile) {
    try { const vf = fs.readFileSync(varsFile, 'utf8'); vars = JSON.parse(vf); } catch (e) { console.error('Could not read vars-file', varsFile, e.message); }
  }

  if (!fs.existsSync(file)) { console.error('CSV file not found:', file); process.exit(2); }
  const content = fs.readFileSync(file, 'utf8');
  const rows = parseCsv(content);
  if (!rows || rows.length < 2) { console.error('No rows found in CSV'); process.exit(2); }

  const header = rows[0].map(h => (h || '').trim().toLowerCase());
  const dbIndex = header.findIndex(h => h.includes('db') && h.includes('validation'));
  const apiIndex = header.findIndex(h => h.includes('api') && h.includes('validation'));
  const idIndex = header.findIndex(h => h === 'id') >= 0 ? header.findIndex(h => h === 'id') : 0;

  let prisma;
  try {
const { prisma } = require('../../lib/prisma');
    prisma = new PrismaClient();
    await prisma.$connect();
  } catch (e) {
    console.error('Prisma client not available or failed to connect:', e.message);
    prisma = null;
  }

  const results = [];
  let processed = 0;
  for (let i = 1; i < rows.length; i++) {
    if (limit && processed >= limit) break;
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const id = (r[idIndex] || '').trim();
    const dbSnippet = dbIndex >= 0 ? (r[dbIndex] || '').trim() : '';
    const apiSnippet = apiIndex >= 0 ? (r[apiIndex] || '').trim() : '';
    if (!id && !dbSnippet && !apiSnippet) continue;
    processed++;
    const entry = { id, db: null, api: null };

    // DB check
    if ((only === 'both' || only === 'db') && dbSnippet && dbSnippet.toLowerCase() !== 'n/a' && prisma) {
      const sql = replacePlaceholders(dbSnippet, vars);
      try {
        const rowsRes = await prisma.$queryRawUnsafe(sql);
        entry.db = { executed: true, rows: Array.isArray(rowsRes) ? rowsRes.length : (rowsRes ? 1 : 0), sample: Array.isArray(rowsRes) ? rowsRes.slice(0, 3) : rowsRes };
      } catch (err) {
        entry.db = { executed: false, error: (err && err.message) || String(err) };
      }
    } else if ((only === 'both' || only === 'db') && dbSnippet && dbSnippet.toLowerCase() !== 'n/a' && !prisma) {
      entry.db = { executed: false, error: 'Prisma client not available or DB not configured' };
    }

    // API check
    if ((only === 'both' || only === 'api') && apiSnippet && apiSnippet.toLowerCase() !== 'n/a') {
      // try to extract METHOD and PATH
      const m = apiSnippet.match(/\b(GET|POST|PUT|PATCH|DELETE)\b\s+(\/\S+)/i);
      let method = 'GET';
      let pathSpec = null;
      if (m) { method = m[1].toUpperCase(); pathSpec = m[2]; }
      else {
        const p = apiSnippet.match(/(\/api\/[^\s\)\']+)/i);
        if (p) { pathSpec = p[1]; }
      }
      if (pathSpec) {
        const pathReplaced = replacePlaceholders(pathSpec, vars);
        const url = (apiBase.replace(/\/$/, '') + pathReplaced).replace(/\s+/g, '');
        try {
          if (!globalThis.fetch) throw new Error('global fetch not available in this Node runtime');
          const headers = { 'Content-Type': 'application/json' };
          if (process.env.API_TOKEN) headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
          const res = await fetch(url, { method, headers });
          const status = res.status;
          const text = await res.text();
          const expectedMatch = apiSnippet.match(/returns\s+(\d{3})/i);
          const expected = expectedMatch ? parseInt(expectedMatch[1], 10) : null;
          const ok = expected ? (status === expected) : (status >= 200 && status < 400);
          entry.api = { executed: true, url, method, status, ok, sampleBody: text.slice(0, 1000) };
        } catch (err) {
          entry.api = { executed: false, error: (err && err.message) || String(err) };
        }
      } else {
        entry.api = { executed: false, error: 'Could not extract API path from snippet' };
      }
    }

    results.push(entry);
  }

  if (prisma) await prisma.$disconnect();

  const reportDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const outFile = path.join(reportDir, `qa_validation_report_${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ file, apiBase, varsUsed: Object.keys(vars), results }, null, 2));
  console.log(`Wrote report to ${outFile}`);

  // Summary
  const total = results.length;
  const dbFails = results.filter(r => r.db && r.db.executed === false).length;
  const apiFails = results.filter(r => r.api && r.api.executed === false || (r.api && r.api.ok === false)).length;
  console.log(`Processed ${total} checks -- DB failures: ${dbFails}, API failures: ${apiFails}`);

  process.exit(dbFails + apiFails > 0 ? 2 : 0);
}

main().catch(err => { console.error('Fatal error', err && err.stack || err); process.exit(2); });
