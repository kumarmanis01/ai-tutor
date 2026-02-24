#!/usr/bin/env node
/**
 * scripts/audit-logs-safety.cjs
 *
 * Scans the repository for unsafe logging patterns:
 *  - `console.log` occurrences (FAIL)
 *  - logging calls that include raw email addresses
 *  - logging calls that include JWT/token/session fields
 *  - logging calls that include raw answer payloads (rawAnswer/answers/answer)
 *  - any route that logs `req.body` directly
 *
 * Prints `LOGGING SAFE FOR PRODUCTION` and exits 0 when no violations found;
 * otherwise prints violations and exits 1.
 *
 * Usage:
 *   node scripts/audit-logs-safety.cjs
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// Note: we intentionally ignore developer scripts and test scaffolding from this
// automated audit because they are developer-facing helpers. Production code
// (app/, lib/, worker/) is still audited.
const IGNORED_DIRS = ['node_modules', '.git', '.next', 'dist', 'build', 'out', 'coverage', 'scripts', 'tests', '__tests__'];
const FILE_EXTENSIONS = ['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx'];

const violations = [];

function isIgnored(p) {
  const parts = p.split(path.sep);
  return parts.some((part) => IGNORED_DIRS.includes(part));
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (isIgnored(full)) continue;
    if (e.isDirectory()) walk(full);
    else if (e.isFile() && FILE_EXTENSIONS.includes(path.extname(e.name))) analyzeFile(full);
  }
}

function addViolation(file, lineNo, snippet, reason) {
  violations.push({ file: path.relative(ROOT, file), line: lineNo, snippet: snippet.trim(), reason });
}

function analyzeFile(file) {
  let txt = '';
  try {
    txt = fs.readFileSync(file, 'utf8');
  } catch (e) {
    // skip unreadable
    return;
  }
  const lines = txt.split(/\r?\n/);

  // Quick checks: any console.log
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // ignore commented out console.log
    const stripped = line.replace(/\/\/.*$/, '');

    // 1) console.log occurrences
    if (/\bconsole\.log\s*\(/.test(stripped)) {
      addViolation(file, i + 1, line, 'console.log detected');
    }

    // 2) any log that mentions an email address literal or logs an email field
    if (/\b(?:console|logger)\.(?:log|info|warn|error|debug)\s*\(([^)]*)\)/.test(stripped)) {
      const callMatch = stripped.match(/\b(?:console|logger)\.(?:log|info|warn|error|debug)\s*\(([^)]*)\)/);
      const args = callMatch ? callMatch[1] : '';
      // email literal
      if (/[\w.+-]+@[\w-]+\.[\w.-]{2,}/.test(args)) {
        addViolation(file, i + 1, line, 'logging contains raw email literal');
      }
      // logging email field or variable
      if (/\bemail\b/.test(args)) {
        addViolation(file, i + 1, line, 'logging includes `email` field or variable');
      }
      // token/jwt/session fields
      if (/\b(token|jwt|session|sessionToken|access_token|refresh_token)\b/.test(args)) {
        addViolation(file, i + 1, line, 'logging includes token/JWT/session field');
      }
      // answer/rawAnswer/answers
      if (/\b(rawAnswer|normalizedAnswer|correctAnswer|answers|answer)\b/.test(args)) {
        addViolation(file, i + 1, line, 'logging includes raw answer payload');
      }
      // logger.info containing answers specifically
      if (/logger\.info\s*\([^)]*(?:rawAnswer|answers|answer)\b[^)]*\)/i.test(stripped)) {
        addViolation(file, i + 1, line, 'logger.info contains answer payload');
      }
    }

    // 3) logging of req.body directly
    if (/\b(?:console|logger)\.(?:log|info|warn|error|debug)\s*\([^)]*req\.body[^)]*\)/.test(stripped)) {
      addViolation(file, i + 1, line, 'route logs req.body directly');
    }

    // 4) any occurrence of req.body logged indirectly: e.g., console.log(req.body)
    if (/\breq\.body\b/.test(stripped) && /\b(?:console|logger)\./.test(stripped)) {
      addViolation(file, i + 1, line, 'req.body present in logging call');
    }

    // 5) raw JWT-like token literal logged
    if (/\b(?:console|logger)\.(?:log|info|warn|error|debug)\s*\(([^)]*)\)/.test(stripped)) {
      const args = (stripped.match(/\(([^)]*)\)/) || [])[1] || '';
      // simple heuristic for JWT-like string (three dot-separated base64 segments)
      if (/[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/.test(args)) {
        addViolation(file, i + 1, line, 'logging includes JWT-like literal');
      }
    }

    // Additionally flag any logger.info that contains 'answer' or 'rawAnswer' in the whole line (case-insensitive)
    if (/logger\.info\s*\([^\)]*(?:answer|rawanswer|answers|rawAnswer)\b/i.test(line)) {
      addViolation(file, i + 1, line, 'logger.info contains test answer payload');
    }
  }
}

// Run
walk(ROOT);

if (violations.length === 0) {
  console.log('LOGGING SAFE FOR PRODUCTION');
  process.exit(0);
}

console.error('LOGGING SAFETY VIOLATIONS FOUND:', violations.length);
for (const v of violations) {
  console.error(`- ${v.file}:${v.line} — ${v.reason}`);
  console.error(`  ${v.snippet}`);
}
process.exit(1);
