import fs from 'fs';
import path from 'path';

describe('exists producers/enqueueTopicHydration.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'producers/enqueueTopicHydration.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
