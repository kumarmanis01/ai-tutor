import fs from 'fs';

describe('exists lib/resizeImage.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\resizeImage.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
