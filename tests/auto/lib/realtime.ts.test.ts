import fs from 'fs';

describe('exists lib/realtime.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\realtime.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
