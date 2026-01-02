import fs from 'fs';

describe('exists lib/redis.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\redis.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
