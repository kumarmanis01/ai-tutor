import fs from 'fs';

describe('exists lib/promotion/reader.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\promotion\\reader.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
