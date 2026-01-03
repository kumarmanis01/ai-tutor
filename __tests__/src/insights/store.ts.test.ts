import fs from 'fs';
import path from 'path';

test('file exists: src/insights/store.ts', () => {
  const p = path.join(process.cwd(), 'src/insights/store.ts');
  expect(fs.existsSync(p)).toBe(true);
});
