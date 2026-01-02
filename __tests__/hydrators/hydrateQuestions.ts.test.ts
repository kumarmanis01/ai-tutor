import fs from 'fs';
import path from 'path';

test('file exists: hydrators/hydrateQuestions.ts', () => {
  const p = path.join(process.cwd(), 'hydrators/hydrateQuestions.ts');
  expect(fs.existsSync(p)).toBe(true);
});
