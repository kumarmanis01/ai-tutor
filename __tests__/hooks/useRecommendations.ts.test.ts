import fs from 'fs';
import path from 'path';

test('file exists: hooks/useRecommendations.ts', () => {
  const p = path.join(process.cwd(), 'hooks/useRecommendations.ts');
  expect(fs.existsSync(p)).toBe(true);
});
