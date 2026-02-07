import fs from 'fs';
import path from 'path';

describe('exists lib/telemetry.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/telemetry.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
