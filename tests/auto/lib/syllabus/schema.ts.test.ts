import fs from 'fs';

describe('exists lib/syllabus/schema.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\syllabus\\schema.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
