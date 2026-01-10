import fs from 'fs';
import path from 'path';

describe('exists workers/heartbeatWatchdog.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'workers', 'heartbeatWatchdog.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
