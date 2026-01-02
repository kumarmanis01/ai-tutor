import fs from 'fs';

describe('exists lib/exporters/lms.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\exporters\\lms.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
