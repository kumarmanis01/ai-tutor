import fs from 'fs';

describe('exists src/regeneration/generatorAdapter.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\src\\regeneration\\generatorAdapter.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
