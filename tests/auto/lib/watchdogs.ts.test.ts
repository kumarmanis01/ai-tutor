import fs from 'fs';

describe('exists lib/watchdogs.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\watchdogs.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
