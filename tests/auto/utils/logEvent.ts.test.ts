import fs from 'fs';
import path from 'path';

describe('exists utils/logEvent.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'utils', 'logEvent.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
