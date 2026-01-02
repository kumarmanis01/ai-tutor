import fs from 'fs';
import path from 'path';

test('file exists: lib/sms.ts', () => {
  const p = path.join(process.cwd(), 'lib/sms.ts');
  expect(fs.existsSync(p)).toBe(true);
});
