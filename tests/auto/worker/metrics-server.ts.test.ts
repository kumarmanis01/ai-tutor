import fs from 'fs';

describe('exists worker/metrics-server.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\worker\\metrics-server.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
