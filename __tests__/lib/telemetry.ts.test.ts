import fs from 'fs';
import path from 'path';

test('file exists: lib/telemetry.ts', () => {
  const p = path.join(process.cwd(), 'lib/telemetry.ts');
  expect(fs.existsSync(p)).toBe(true);
});
