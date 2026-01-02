import fs from 'fs';
import path from 'path';

test('file exists: lib/guardrails.ts', () => {
  const p = path.join(process.cwd(), 'lib/guardrails.ts');
  expect(fs.existsSync(p)).toBe(true);
});
