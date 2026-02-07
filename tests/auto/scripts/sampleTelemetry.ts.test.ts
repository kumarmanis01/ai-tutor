import fs from 'fs';
import path from 'path';

describe('exists scripts/sampleTelemetry.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'scripts/sampleTelemetry.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
