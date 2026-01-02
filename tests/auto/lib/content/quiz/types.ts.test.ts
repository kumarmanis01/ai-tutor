import fs from 'fs';

describe('exists lib/content/quiz/types.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\content\\quiz\\types.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
