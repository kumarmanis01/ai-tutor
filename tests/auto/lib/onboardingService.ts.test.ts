import fs from 'fs';
import path from 'path';

describe('exists lib/onboardingService.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/onboardingService.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
