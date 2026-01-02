import fs from 'fs';

describe('exists lib/onboarding.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\onboarding.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
