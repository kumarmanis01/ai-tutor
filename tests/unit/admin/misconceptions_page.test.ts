import fs from 'fs';
import path from 'path';

describe('admin misconceptions page', () => {
  test('page file exists', () => {
    const p = path.join(process.cwd(), 'app', 'admin', 'misconceptions', 'page.tsx');
    expect(fs.existsSync(p)).toBe(true);
  });
});
