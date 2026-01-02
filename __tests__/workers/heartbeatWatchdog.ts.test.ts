import fs from 'fs';
import path from 'path';

test('file exists: workers/heartbeatWatchdog.ts', () => {
  const p = path.join(process.cwd(), 'workers/heartbeatWatchdog.ts');
  expect(fs.existsSync(p)).toBe(true);
});
