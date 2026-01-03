import fs from 'fs';

describe('exists lib/exporters/pdf.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\exporters\\pdf.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
