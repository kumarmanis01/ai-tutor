import fs from 'fs';

describe('exists lib/types/content.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\types\\content.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
