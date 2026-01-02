import fs from 'fs';
import path from 'path';

test('file exists: src/insights/mappings.ts', () => {
  const p = path.join(process.cwd(), 'src/insights/mappings.ts');
  expect(fs.existsSync(p)).toBe(true);
});
