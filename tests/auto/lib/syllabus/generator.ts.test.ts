import fs from 'fs';

describe('exists lib/syllabus/generator.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\syllabus\\generator.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
