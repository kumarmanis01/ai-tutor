import fs from 'fs';
import path from 'path';

test('file exists: lib/alertEvaluator.ts', () => {
  const p = path.join(process.cwd(), 'lib/alertEvaluator.ts');
  expect(fs.existsSync(p)).toBe(true);
});
