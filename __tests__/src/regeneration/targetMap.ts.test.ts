import fs from 'fs';
import path from 'path';

test('file exists: src/regeneration/targetMap.ts', () => {
  const p = path.join(process.cwd(), 'src/regeneration/targetMap.ts');
  expect(fs.existsSync(p)).toBe(true);
});
