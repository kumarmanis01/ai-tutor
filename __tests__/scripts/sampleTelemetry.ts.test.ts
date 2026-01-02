import fs from 'fs';
import path from 'path';

test('file exists: scripts/sampleTelemetry.ts', () => {
  const p = path.join(process.cwd(), 'scripts/sampleTelemetry.ts');
  expect(fs.existsSync(p)).toBe(true);
});
