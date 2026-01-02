import fs from 'fs';
import path from 'path';

test('file exists: utils/logApiUsage.ts', () => {
  const p = path.join(process.cwd(), 'utils/logApiUsage.ts');
  expect(fs.existsSync(p)).toBe(true);
});
