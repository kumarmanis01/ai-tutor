import fs from 'fs';
import path from 'path';

describe('exists workers/syllabusWorker.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'workers', 'syllabusWorker.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
