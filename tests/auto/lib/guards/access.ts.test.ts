import fs from 'fs';

describe('exists lib/guards/access.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\guards\\access.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
