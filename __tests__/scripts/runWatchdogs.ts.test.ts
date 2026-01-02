import fs from 'fs';
import path from 'path';

test('file exists: scripts/runWatchdogs.ts', () => {
  const p = path.join(process.cwd(), 'scripts/runWatchdogs.ts');
  expect(fs.existsSync(p)).toBe(true);
});
