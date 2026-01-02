import fs from 'fs';

describe('exists lib/content/lesson/prompt.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\content\\lesson\\prompt.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
