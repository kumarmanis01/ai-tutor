import fs from 'fs';
import path from 'path';

test('file exists: hooks/useLearningSessionProgress.ts', () => {
  const p = path.join(process.cwd(), 'hooks/useLearningSessionProgress.ts');
  expect(fs.existsSync(p)).toBe(true);
});
