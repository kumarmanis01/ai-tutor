import fs from 'fs';

describe('exists lib/logger.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\logger.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
