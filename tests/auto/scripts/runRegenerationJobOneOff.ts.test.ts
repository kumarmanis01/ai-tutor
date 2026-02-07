import fs from 'fs';
import path from 'path';

describe('exists scripts/runRegenerationJobOneOff.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'scripts/runRegenerationJobOneOff.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
