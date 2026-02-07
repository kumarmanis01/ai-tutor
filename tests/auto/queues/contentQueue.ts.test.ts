import fs from 'fs';
import path from 'path';

describe('exists queues/contentQueue.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'queues/contentQueue.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
