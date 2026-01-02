import fs from 'fs';

describe('exists scripts/metricsServer.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\scripts\\metricsServer.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
