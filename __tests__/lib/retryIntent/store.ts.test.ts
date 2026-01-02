import fs from 'fs';
import path from 'path';

test('file exists: lib/retryIntent/store.ts', () => {
  const p = path.join(process.cwd(), 'lib/retryIntent/store.ts');
  expect(fs.existsSync(p)).toBe(true);
});
