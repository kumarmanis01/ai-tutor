import fs from 'fs';

describe('exists lib/content/approval/guard.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\content\\approval\\guard.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
