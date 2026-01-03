import fs from 'fs';

describe('exists next.config.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\next.config.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
