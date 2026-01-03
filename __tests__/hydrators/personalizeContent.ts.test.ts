import fs from 'fs';
import path from 'path';

test('file exists: hydrators/personalizeContent.ts', () => {
  const p = path.join(process.cwd(), 'hydrators/personalizeContent.ts');
  expect(fs.existsSync(p)).toBe(true);
});
