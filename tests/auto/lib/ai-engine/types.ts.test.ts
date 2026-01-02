import fs from 'fs';

describe('exists lib/ai-engine/types.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\ai-engine\\types.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
