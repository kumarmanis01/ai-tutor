import fs from 'fs';
import path from 'path';

describe('exists scripts/sampleSystemHealth.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'scripts/sampleSystemHealth.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
