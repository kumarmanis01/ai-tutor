import fs from 'fs';
import path from 'path';

test('file exists: src/regeneration/generatorAdapter.ts', () => {
  const p = path.join(process.cwd(), 'src/regeneration/generatorAdapter.ts');
  expect(fs.existsSync(p)).toBe(true);
});
