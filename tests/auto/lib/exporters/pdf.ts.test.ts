import fs from 'fs';
import path from 'path';

describe('exists lib/exporters/pdf.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/exporters/pdf.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
