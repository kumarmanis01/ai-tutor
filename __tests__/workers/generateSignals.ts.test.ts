import fs from 'fs';
import path from 'path';

test('file exists: workers/generateSignals.ts', () => {
  const p = path.join(process.cwd(), 'workers/generateSignals.ts');
  expect(fs.existsSync(p)).toBe(true);
});
