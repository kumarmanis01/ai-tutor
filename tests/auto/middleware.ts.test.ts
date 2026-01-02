import fs from 'fs';

describe('exists middleware.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\middleware.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
