import fs from 'fs';

describe('exists scripts/runRegenerationJobOneOff.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\scripts\\runRegenerationJobOneOff.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
