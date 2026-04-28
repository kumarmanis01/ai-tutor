#!/usr/bin/env node
/*
 * Simple codemod: replace direct `new PrismaClient()` usage with the shared
 * singleton exported by `lib/prisma`.
 *
 * Usage: node scripts/replace-new-prisma.js
 * Recommended: run once, review changes, then commit.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', 'vendor']);
const FILE_EXTS = new Set(['.ts', '.tsx', '.js', '.cjs', '.mjs', '.jsx']);

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (IGNORED_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (stat.isFile() && FILE_EXTS.has(path.extname(full))) processFile(full);
  }
}

function relImport(fromFile) {
  const rel = path
    .relative(path.dirname(fromFile), path.join(ROOT, 'lib', 'prisma'))
    .split(path.sep)
    .join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

function alreadyHasPrismaImport(text) {
  return (
    /import\s+\{\s*prisma\s*\}/.test(text) ||
    /require\(['"].*lib\/prisma['"]\)/.test(text) ||
    /const\s+\{\s*prisma\s*\}/.test(text)
  );
}

function processFile(file) {
  const rel = path.relative(ROOT, file);
  if (rel === 'lib/prisma.ts') return;
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('PrismaClient') && !src.includes('new PrismaClient')) return;

  let out = src;
  const libPath = relImport(file);

  // Handle ES import { PrismaClient, ... } from '@prisma/client'
  const importRe = /(^|\n)\s*import\s+\{([^}]+)\}\s+from\s+['"]@prisma\/client['"];?/m;
  const importMatch = out.match(importRe);
  if (importMatch) {
    const before = importMatch[1];
    const names = importMatch[2]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.includes('PrismaClient')) {
      const remaining = names.filter((n) => n !== 'PrismaClient');
      let replacement = '';
      if (remaining.length > 0) {
        replacement = `${before}import { ${remaining.join(', ')} } from '@prisma/client';\nimport { prisma } from '${libPath}';`;
      } else {
        replacement = `${before}import { prisma } from '${libPath}';`;
      }
      out = out.replace(importRe, replacement);
    }
  } else {
    // CommonJS require pattern: const { PrismaClient, X } = require('@prisma/client')
    const reqRe = /(^|\n)\s*const\s+\{([^}]+)\}\s*=\s*require\(['"]@prisma\/client['"]\);?/m;
    const reqMatch = out.match(reqRe);
    if (reqMatch) {
      const before = reqMatch[1];
      const names = reqMatch[2]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (names.includes('PrismaClient')) {
        const remaining = names.filter((n) => n !== 'PrismaClient');
        let replacement = '';
        if (remaining.length > 0) {
          replacement = `${before}const { ${remaining.join(', ')} } = require('@prisma/client');\nconst { prisma } = require('${libPath}');`;
        } else {
          replacement = `${before}const { prisma } = require('${libPath}');`;
        }
        out = out.replace(reqRe, replacement);
      }
    }
  }

  // If file already imports prisma from lib/prisma, avoid adding duplicate import.
  if (!alreadyHasPrismaImport(out) && /new\s+PrismaClient/.test(out)) {
    // Insert import near top: after any shebang and after existing imports/requires header
    const shebangMatch = out.match(/^#!.*\n/);
    const insertPos = shebangMatch ? shebangMatch[0].length : 0;
    const importStmt = `import { prisma } from '${libPath}';\n`;
    out = out.slice(0, insertPos) + importStmt + out.slice(insertPos);
  }

  // Replace common instantiation patterns
  // 1)
  out = out.replace(/const\s+prisma\s*=\s*new\s+PrismaClient\([^;\n]*\);?/g, '');

  // 2) const p = prisma;  => const p = prisma;
  out = out.replace(
    /const\s+([a-zA-Z_$][\w$]*)\s*=\s*new\s+PrismaClient\([^;\n]*\);?/g,
    (m, name) => {
      return `const ${name} = prisma;`;
    }
  );

  // 3) require-style where pkg used: const pkg = require('@prisma/client'); const { PrismaClient } = pkg;
  out = out.replace(
    /const\s+pkg\s*=\s*require\(['"]@prisma\/client['"]\)\s*;?\s*(?:const\s+\{[^}]+\}\s*=\s*pkg\s*;?\s*)?const\s+([a-zA-Z_$][\w$]*)\s*=\s*new\s+PrismaClient\([^;\n]*\);?/g,
    (m, name) => {
      return `const ${name} = prisma;`;
    }
  );

  if (out !== src) {
    fs.writeFileSync(file, out, 'utf8');
    console.log('Patched', file);
  }
}

function main() {
  console.log('Running replace-new-prisma codemod (dry-run disabled)');
  walk(ROOT);
  console.log('Done');
}

main();
