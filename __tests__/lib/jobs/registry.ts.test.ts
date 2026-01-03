import fs from 'fs';
import path from 'path';

test('file exists: lib/jobs/registry.ts', () => {
  const p = path.join(process.cwd(), 'lib/jobs/registry.ts');
  expect(fs.existsSync(p)).toBe(true);
});
