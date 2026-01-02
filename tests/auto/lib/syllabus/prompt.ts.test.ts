import fs from 'fs';

describe('exists lib/syllabus/prompt.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\syllabus\\prompt.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
