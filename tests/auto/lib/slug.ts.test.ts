import fs from 'fs';

describe('exists lib/slug.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\slug.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
