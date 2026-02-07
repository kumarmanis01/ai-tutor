import fs from 'fs';
import path from 'path';

describe('exists scripts/metricsServer.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'scripts/metricsServer.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
