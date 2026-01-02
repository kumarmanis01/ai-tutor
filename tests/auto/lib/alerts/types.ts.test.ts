import fs from 'fs';

describe('exists lib/alerts/types.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\alerts\\types.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
