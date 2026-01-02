import fs from 'fs';
import path from 'path';

test('file exists: scripts/sampleTelemetry.tmp.ts', () => {
  const p = path.join(process.cwd(), 'scripts/sampleTelemetry.tmp.ts');
  expect(fs.existsSync(p)).toBe(true);
});
