import fs from 'fs';

describe('exists scripts/sampleTelemetry.tmp.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\scripts\\sampleTelemetry.tmp.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
