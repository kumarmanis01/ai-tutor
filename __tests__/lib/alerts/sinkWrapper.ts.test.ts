import fs from 'fs';
import path from 'path';

test('file exists: lib/alerts/sinkWrapper.ts', () => {
  const p = path.join(process.cwd(), 'lib/alerts/sinkWrapper.ts');
  expect(fs.existsSync(p)).toBe(true);
});
