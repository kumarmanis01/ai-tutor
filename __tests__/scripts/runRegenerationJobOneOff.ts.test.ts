import fs from 'fs';
import path from 'path';

test('file exists: scripts/runRegenerationJobOneOff.ts', () => {
  const p = path.join(process.cwd(), 'scripts/runRegenerationJobOneOff.ts');
  expect(fs.existsSync(p)).toBe(true);
});
