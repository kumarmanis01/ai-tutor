import fs from 'fs';

describe('exists hydrators/personalizeContent.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\hydrators\\personalizeContent.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
