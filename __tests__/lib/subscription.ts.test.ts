import fs from 'fs';
import path from 'path';

test('file exists: lib/subscription.ts', () => {
  const p = path.join(process.cwd(), 'lib/subscription.ts');
  expect(fs.existsSync(p)).toBe(true);
});
