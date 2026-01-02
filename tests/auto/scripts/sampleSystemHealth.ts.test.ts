import fs from 'fs';

describe('exists scripts/sampleSystemHealth.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\scripts\\sampleSystemHealth.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
