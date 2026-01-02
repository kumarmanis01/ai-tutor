import fs from 'fs';

describe('exists worker/loop.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\worker\\loop.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
