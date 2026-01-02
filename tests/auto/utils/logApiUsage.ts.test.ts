import fs from 'fs';

describe('exists utils/logApiUsage.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\utils\\logApiUsage.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
