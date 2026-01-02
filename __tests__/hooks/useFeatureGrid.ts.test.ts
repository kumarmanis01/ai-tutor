import fs from 'fs';
import path from 'path';

test('file exists: hooks/useFeatureGrid.ts', () => {
  const p = path.join(process.cwd(), 'hooks/useFeatureGrid.ts');
  expect(fs.existsSync(p)).toBe(true);
});
