import fs from 'fs';

describe('exists workers/heartbeatWatchdog.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\workers\\heartbeatWatchdog.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
