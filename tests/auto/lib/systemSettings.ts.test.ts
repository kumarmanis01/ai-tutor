import fs from 'fs';

describe('exists lib/systemSettings.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\systemSettings.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
