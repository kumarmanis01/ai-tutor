import fs from 'fs';

describe('exists lib/syllabus/store.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\syllabus\\store.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
