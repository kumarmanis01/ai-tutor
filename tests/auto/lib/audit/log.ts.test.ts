import fs from 'fs';

describe('exists lib/audit/log.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\audit\\log.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
