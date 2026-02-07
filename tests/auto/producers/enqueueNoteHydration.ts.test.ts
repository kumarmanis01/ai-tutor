import fs from 'fs';
import path from 'path';

describe('exists producers/enqueueNoteHydration.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'producers/enqueueNoteHydration.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
