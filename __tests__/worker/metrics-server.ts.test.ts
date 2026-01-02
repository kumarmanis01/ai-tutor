import fs from 'fs';
import path from 'path';

test('file exists: worker/metrics-server.ts', () => {
  const p = path.join(process.cwd(), 'worker/metrics-server.ts');
  expect(fs.existsSync(p)).toBe(true);
});
