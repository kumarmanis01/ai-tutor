import fs from 'fs';

describe('exists lib/onboardingService.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\onboardingService.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
