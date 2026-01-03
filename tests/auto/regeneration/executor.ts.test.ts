import fs from 'fs';

describe('exists regeneration/executor.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\regeneration\\executor.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
