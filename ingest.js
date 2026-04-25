#!/usr/bin/env node
/*
FILE OBJECTIVE:
- Lightweight CLI wrapper to run ingestion workflows (NCERT scraper, local PDF parser, retry re-embed).

LINKED UNIT TEST:
- tests/unit/scripts/ingest-cli.test.js

COPILOT INSTRUCTIONS FOLLOWED:
- .github/copilot-instructions.md
- /docs/COPILOT_GUARDRAILS.md

EDIT LOG:
- 2026-04-17T00:00:00Z | copilot | add wrapper to run tsx scripts for ingestion and retries
*/

const { spawn } = require('child_process');
const path = require('path');

function tsxBin() {
  const candidate = path.join(process.cwd(), 'node_modules', '.bin', 'tsx');
  return candidate;
}

function spawnTsx(args) {
  const bin = tsxBin();
  const child = spawn(bin, args, { stdio: 'inherit', cwd: process.cwd() });
  child.on('exit', (code) => process.exit(code));
}

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.log('Usage examples:');
  console.log(
    '  node ingest.js --file ncert_math10.pdf --board CBSE --subject Mathematics --grade 10 --lang en'
  );
  console.log('  node ingest.js --subject mathematics --grade 10 --lang en  # runs NCERT scraper');
  console.log(
    '  node ingest.js --retry-failed --run-id <ingestRunId>   # retry failed chunks from run'
  );
  process.exit(0);
}

if (argv.includes('--file')) {
  // Forward file ingestion to parse-pdf-cli.ts
  const args = ['scripts/parse-pdf-cli.ts', ...argv];
  spawnTsx(args);
  return;
}

// Retry failed chunk embeddings via ingest-curriculum
if (argv.includes('--retry-failed')) {
  const args = ['scripts/ingest-curriculum.ts', ...argv];
  spawnTsx(args);
  return;
}

// Default: assume NCERT scraper invocation
// Example: node ingest.js --subject mathematics --grade 10 --lang en --board CBSE
const args = ['scripts/scrape-ncert.ts', ...argv];
spawnTsx(args);
