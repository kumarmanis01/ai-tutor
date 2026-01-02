import fs from 'fs';

describe('exists src/insights/mappings.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\src\\insights\\mappings.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
