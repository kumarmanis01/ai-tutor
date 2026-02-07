import fs from 'fs';
import path from 'path';

describe('exists lib/razorpay.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/razorpay.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
