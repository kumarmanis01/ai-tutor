import fs from 'fs';

describe('exists lib/systemHealth.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\systemHealth.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
