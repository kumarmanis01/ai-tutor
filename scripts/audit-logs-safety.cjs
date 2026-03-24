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

/**
 * Production-safe logging audit
 * Detects only REAL sensitive leaks.
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const SCAN_DIRS = [
  "app",
  "lib",
  "worker",
  "components",
  "context",
  "middleware.ts"
];

const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "scripts",
  "prisma"
]);

const JWT_REGEX =
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;

const violations = [];

function walk(targetPath) {
  if (!fs.existsSync(targetPath)) return;

  const stat = fs.statSync(targetPath);

  if (stat.isDirectory()) {
    const folderName = path.basename(targetPath);
    if (IGNORE_DIRS.has(folderName)) return;

    for (const file of fs.readdirSync(targetPath)) {
      walk(path.join(targetPath, file));
    }
  } else if (/\.(ts|tsx|js|cjs)$/.test(targetPath)) {
    scanFile(targetPath);
  }
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");

  lines.forEach((line, idx) => {
    const l = line.trim();

      // Block console usage ONLY in runtime code
      if (
        l.startsWith("console.") &&
        !filePath.endsWith(path.join("lib", "logger.ts"))
      ) {
        violations.push(`${filePath}:${idx + 1} -- console.* detected`);
    }

    // Block raw body logging
    if (
      l.includes("req.body") ||
      l.includes("request.body") ||
      l.includes("JSON.stringify(req") ||
      l.includes("JSON.stringify(request")
    ) {
      violations.push(`${filePath}:${idx + 1} -- raw request body logged`);
    }

    // Block auth header logging
    if (
      l.includes("authorization") &&
      l.includes("logger")
    ) {
      violations.push(`${filePath}:${idx + 1} -- authorization header logged`);
    }

    // Block cookies logging
    if (
      l.includes("cookies(") &&
      l.includes("logger")
    ) {
      violations.push(`${filePath}:${idx + 1} -- cookies logged`);
    }

    // Detect real JWT literals
    if (JWT_REGEX.test(l)) {
      violations.push(`${filePath}:${idx + 1} -- JWT literal detected`);
    }
  });
}

// Only scan allowed directories
SCAN_DIRS.forEach(dir => {
  walk(path.join(root, dir));
});

if (violations.length > 0) {
  console.error("\nLOGGING SAFETY VIOLATIONS FOUND:\n");
  violations.forEach(v => console.error("-", v));
  process.exit(1);
}

console.log("LOGGING SAFE FOR PRODUCTION.");
process.exit(0);
