/**
 * FILE OBJECTIVE:
 * - Scan `components/student/**` for hard-coded hex color literals and inline style usage,
 *   and emit a CSV + JSON audit that prioritizes remediation work.
 *
 * LINKED UNIT TEST:
 * - tests/unit/scripts/style-audit.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-04-22T00:00:00Z | copilot | created CommonJS style-audit script variant
 */

const fs = require('fs').promises;
const path = require('path');

const TARGET_DIR = path.join(process.cwd(), 'components', 'student');
const OUT_DIR = path.join(process.cwd(), 'scripts', 'style-audit', 'output');

const hexRegex = /#[0-9A-Fa-f]{3,6}/g;
const styleObjRegex = /style\s*=\s*{{/g;
const styleStrRegex = /style\s*=\s*["']/g;

async function walk(dir, acc = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full, acc);
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (['.ts', '.tsx', '.js', '.jsx', '.md', '.mdx'].includes(ext)) acc.push(full);
    }
  }
  return acc;
}

function computePriority(hexCount) {
  if (hexCount >= 10) return 'high';
  if (hexCount >= 3) return 'medium';
  if (hexCount >= 1) return 'low';
  return 'none';
}

async function main() {
  try {
    // ensure target exists
    await fs.stat(TARGET_DIR);
  } catch (e) {
    console.error('Target directory not found:', TARGET_DIR);
    process.exit(1);
  }

  const files = await walk(TARGET_DIR);
  const results = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const hexMatches = content.match(hexRegex) || [];
    const styleObjMatches = content.match(styleObjRegex) || [];
    const styleStrMatches = content.match(styleStrRegex) || [];
    const inlineStyleCount = styleObjMatches.length + styleStrMatches.length;

    const lines = content.split(/\r?\n/);
    const samples = [];
    for (let i = 0; i < lines.length && samples.length < 3; i++) {
      if (hexRegex.test(lines[i])) samples.push(lines[i].trim());
    }

    const hexCount = hexMatches.length;
    if (hexCount === 0) continue; // skip files without hex literals

    results.push({
      file: path.relative(process.cwd(), file).replace(/\\/g, '/'),
      hex_count: hexCount,
      inline_style_count: inlineStyleCount,
      sample_snippets: samples,
      remediation_priority: computePriority(hexCount),
    });
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const csvPath = path.join(OUT_DIR, 'student-style-audit.csv');
  const jsonPath = path.join(OUT_DIR, 'student-style-audit.json');

  const header = 'file_path,hex_count,inline_style_count,sample_snippets,remediation_priority\n';
  const rows = [header];
  for (const r of results) {
    const sample = (r.sample_snippets || []).map(s => s.replace(/"/g, '""')).join(' | ');
    const line = `"${r.file.replace(/"/g, '""')}",${r.hex_count},${r.inline_style_count},"${sample}","${r.remediation_priority}"\n`;
    rows.push(line);
  }

  await fs.writeFile(csvPath, rows.join(''), 'utf8');
  await fs.writeFile(jsonPath, JSON.stringify(results, null, 2), 'utf8');

  console.log('Wrote audit CSV:', csvPath);
  console.log('Wrote audit JSON:', jsonPath);
  console.log('Scanned files:', files.length);
  console.log('Files with matches:', results.length);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
