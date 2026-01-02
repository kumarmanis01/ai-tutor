import fs from 'fs';

describe('exists lib/inputHandlers.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\inputHandlers.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
