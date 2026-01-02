import fs from 'fs';
import path from 'path';

test('file exists: hooks/useStreaksAndGoals.ts', () => {
  const p = path.join(process.cwd(), 'hooks/useStreaksAndGoals.ts');
  expect(fs.existsSync(p)).toBe(true);
});
