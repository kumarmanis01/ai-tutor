import fs from 'fs';
import path from 'path';

test('file exists: hooks/useContinueLearning.ts', () => {
  const p = path.join(process.cwd(), 'hooks/useContinueLearning.ts');
  expect(fs.existsSync(p)).toBe(true);
});
