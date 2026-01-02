import fs from 'fs';

describe('exists lib/extractBadge.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\extractBadge.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
