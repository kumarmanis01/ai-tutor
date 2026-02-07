import fs from 'fs';
import path from 'path';

describe('exists types/rooms.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'types/rooms.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
