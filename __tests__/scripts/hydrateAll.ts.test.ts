import fs from 'fs';
import path from 'path';

test('file exists: scripts/hydrateAll.ts', () => {
  const p = path.join(process.cwd(), 'scripts/hydrateAll.ts');
  expect(fs.existsSync(p)).toBe(true);
});
