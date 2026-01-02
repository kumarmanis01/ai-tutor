import fs from 'fs';

describe('exists lib/toast.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\toast.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
