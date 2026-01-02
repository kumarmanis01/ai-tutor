import fs from 'fs';
import path from 'path';

test('file exists: lib/onboarding.ts', () => {
  const p = path.join(process.cwd(), 'lib/onboarding.ts');
  expect(fs.existsSync(p)).toBe(true);
});
