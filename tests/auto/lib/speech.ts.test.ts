import fs from 'fs';

describe('exists lib/speech.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\speech.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
