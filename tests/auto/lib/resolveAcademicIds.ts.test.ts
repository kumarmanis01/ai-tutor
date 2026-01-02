import fs from 'fs';

describe('exists lib/resolveAcademicIds.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\resolveAcademicIds.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
