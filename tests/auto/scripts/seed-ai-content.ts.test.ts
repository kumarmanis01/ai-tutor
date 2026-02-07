import fs from 'fs';
import path from 'path';

describe('exists scripts/seed-ai-content.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'scripts/seed-ai-content.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
