import fs from 'fs';
import path from 'path';

test('file exists: scripts/run-focused-tests.ps1', () => {
  const p = path.join(process.cwd(), 'scripts/run-focused-tests.ps1');
  expect(fs.existsSync(p)).toBe(true);
});
