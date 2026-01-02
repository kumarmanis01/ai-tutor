import fs from 'fs';

describe('exists lib/content/quiz/schema.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\content\\quiz\\schema.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
