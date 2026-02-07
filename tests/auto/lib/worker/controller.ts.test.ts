import fs from 'fs';
import path from 'path';

describe('exists lib/worker/controller.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/worker/controller.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
