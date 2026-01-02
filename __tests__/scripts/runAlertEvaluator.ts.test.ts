import fs from 'fs';
import path from 'path';

test('file exists: scripts/runAlertEvaluator.ts', () => {
  const p = path.join(process.cwd(), 'scripts/runAlertEvaluator.ts');
  expect(fs.existsSync(p)).toBe(true);
});
