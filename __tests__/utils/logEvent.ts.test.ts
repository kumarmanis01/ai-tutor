import fs from 'fs';
import path from 'path';

test('file exists: utils/logEvent.ts', () => {
  const p = path.join(process.cwd(), 'utils/logEvent.ts');
  expect(fs.existsSync(p)).toBe(true);
});
