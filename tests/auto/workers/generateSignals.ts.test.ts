import fs from 'fs';
import path from 'path';

describe('exists workers/generateSignals.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'workers', 'generateSignals.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
