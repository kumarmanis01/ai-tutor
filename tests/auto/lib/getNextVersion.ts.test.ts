import fs from 'fs';

describe('exists lib/getNextVersion.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\getNextVersion.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
