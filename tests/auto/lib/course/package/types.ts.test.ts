import fs from 'fs';

describe('exists lib/course/package/types.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\course\\package\\types.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
