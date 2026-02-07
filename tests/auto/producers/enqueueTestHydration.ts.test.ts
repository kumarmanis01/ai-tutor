import fs from 'fs';
import path from 'path';

describe('exists producers/enqueueTestHydration.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'producers/enqueueTestHydration.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
