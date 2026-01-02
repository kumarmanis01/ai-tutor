import fs from 'fs';

describe('exists lib/content/project/schema.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\content\\project\\schema.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
