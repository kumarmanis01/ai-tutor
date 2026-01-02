import fs from 'fs';
import path from 'path';

test('file exists: hydrators/hydrateNotes.ts', () => {
  const p = path.join(process.cwd(), 'hydrators/hydrateNotes.ts');
  expect(fs.existsSync(p)).toBe(true);
});
