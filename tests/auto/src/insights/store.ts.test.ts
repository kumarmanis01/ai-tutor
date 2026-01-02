import fs from 'fs';

describe('exists src/insights/store.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\src\\insights\\store.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
