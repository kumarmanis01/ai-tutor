import fs from 'fs';

describe('exists lib/content/lesson/types.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\content\\lesson\\types.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
