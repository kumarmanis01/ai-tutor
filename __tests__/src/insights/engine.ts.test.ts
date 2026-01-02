import fs from 'fs';
import path from 'path';

test('file exists: src/insights/engine.ts', () => {
  const p = path.join(process.cwd(), 'src/insights/engine.ts');
  expect(fs.existsSync(p)).toBe(true);
});
