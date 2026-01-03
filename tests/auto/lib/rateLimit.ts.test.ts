import fs from 'fs';

describe('exists lib/rateLimit.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\rateLimit.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
