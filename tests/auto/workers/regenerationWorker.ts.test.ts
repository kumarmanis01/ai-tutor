import fs from 'fs';
import path from 'path';

describe('exists workers/regenerationWorker.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'workers/regenerationWorker.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
