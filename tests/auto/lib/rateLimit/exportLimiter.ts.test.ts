import fs from 'fs';

describe('exists lib/rateLimit/exportLimiter.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\rateLimit\\exportLimiter.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
