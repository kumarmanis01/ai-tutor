import fs from 'fs';
import path from 'path';

describe('exists workers/contentWorker.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'workers', 'contentWorker.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
