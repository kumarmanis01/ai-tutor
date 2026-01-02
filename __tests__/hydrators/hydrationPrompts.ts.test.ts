import fs from 'fs';
import path from 'path';

test('file exists: hydrators/hydrationPrompts.ts', () => {
  const p = path.join(process.cwd(), 'hydrators/hydrationPrompts.ts');
  expect(fs.existsSync(p)).toBe(true);
});
