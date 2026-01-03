import fs from 'fs';

describe('exists lib/aiContext.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\aiContext.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
