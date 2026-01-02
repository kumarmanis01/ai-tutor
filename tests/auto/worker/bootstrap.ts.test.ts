import fs from 'fs';

describe('exists worker/bootstrap.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\worker\\bootstrap.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
