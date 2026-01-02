import fs from 'fs';
import path from 'path';

test('file exists: scripts/metricsServer.ts', () => {
  const p = path.join(process.cwd(), 'scripts/metricsServer.ts');
  expect(fs.existsSync(p)).toBe(true);
});
