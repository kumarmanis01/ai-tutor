import fs from 'fs';

describe('exists src/insights/engine.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\src\\insights\\engine.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
