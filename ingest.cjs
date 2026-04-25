#!/usr/bin/env node
/*
  node ingest.cjs --file ...
  node ingest.cjs --subject mathematics --grade 10
  node ingest.cjs --retry-failed --run-id <id>
*/
const { spawn } = require('child_process');
const path = require('path');

function tsxBin() {
  return path.join(process.cwd(), 'node_modules', '.bin', 'tsx');
}

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.log('Usage examples:');
  console.log(
    '  node ingest.cjs --file ncert_math10.pdf --board CBSE --subject mathematics --grade 10 --lang en'
  );
  console.log('  node ingest.cjs --subject mathematics --grade 10 --lang en');
  console.log('  node ingest.cjs --retry-failed --run-id <ingestRunId>');
  process.exit(0);
}

if (argv.includes('--file')) {
  const child = spawn(tsxBin(), ['scripts/parse-pdf-cli.ts', ...argv], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  child.on('exit', (code) => process.exit(code));
  return;
}

if (argv.includes('--retry-failed')) {
  const child = spawn(tsxBin(), ['scripts/ingest-curriculum.ts', ...argv], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  child.on('exit', (code) => process.exit(code));
  return;
}

// Default: run scraper
const child = spawn(tsxBin(), ['scripts/scrape-ncert.ts', ...argv], {
  stdio: 'inherit',
  cwd: process.cwd(),
});
child.on('exit', (code) => process.exit(code));
