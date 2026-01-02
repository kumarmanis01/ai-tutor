import fs from 'fs';
import path from 'path';

test('file exists: hydrators/hydrateSyllabus.ts', () => {
  const p = path.join(process.cwd(), 'hydrators/hydrateSyllabus.ts');
  expect(fs.existsSync(p)).toBe(true);
});
