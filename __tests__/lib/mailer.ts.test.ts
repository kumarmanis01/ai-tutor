import fs from 'fs';
import path from 'path';

test('file exists: lib/mailer.ts', () => {
  const p = path.join(process.cwd(), 'lib/mailer.ts');
  expect(fs.existsSync(p)).toBe(true);
});
