import fs from 'fs';
import path from 'path';

test('file exists: lib/alerts/sinks/dryRun.ts', () => {
  const p = path.join(process.cwd(), 'lib/alerts/sinks/dryRun.ts');
  expect(fs.existsSync(p)).toBe(true);
});
