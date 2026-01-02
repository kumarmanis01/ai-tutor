import fs from 'fs';
import path from 'path';

test('file exists: lib/onboardingService.ts', () => {
  const p = path.join(process.cwd(), 'lib/onboardingService.ts');
  expect(fs.existsSync(p)).toBe(true);
});
