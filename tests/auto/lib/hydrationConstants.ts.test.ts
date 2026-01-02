import fs from 'fs';

describe('exists lib/hydrationConstants.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\hydrationConstants.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
