import fs from 'fs';
import path from 'path';

test('file exists: lib/jobs/retention.ts', () => {
  const p = path.join(process.cwd(), 'lib/jobs/retention.ts');
  expect(fs.existsSync(p)).toBe(true);
});
