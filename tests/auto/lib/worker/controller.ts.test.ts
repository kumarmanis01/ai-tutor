import fs from 'fs';

describe('exists lib/worker/controller.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\worker\\controller.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
