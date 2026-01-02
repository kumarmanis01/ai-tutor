import fs from 'fs';

describe('exists lib/telemetry.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\telemetry.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
