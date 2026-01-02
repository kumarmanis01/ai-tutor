import fs from 'fs';

describe('exists utils/logEvent.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\utils\\logEvent.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
