import fs from 'fs';

describe('exists scripts/runWatchdogs.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\scripts\\runWatchdogs.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
