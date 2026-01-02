import fs from 'fs';

describe('exists workers/generateSignals.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\workers\\generateSignals.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
