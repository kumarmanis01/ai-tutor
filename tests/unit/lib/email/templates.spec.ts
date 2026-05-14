import fs from 'fs';
import path from 'path';

describe('email templates file sanity', () => {
  test('templates file contains header/logo and footer/unsubscribe markers', () => {
    const p = path.resolve(__dirname, '../../../../lib/email/templates.ts');
    const src = fs.readFileSync(p, 'utf8').toLowerCase();

    // basic existence checks for expected template pieces
    expect(src).toEqual(expect.any(String));
    expect(src.length).toBeGreaterThan(100);
    // look for logo/image and unsubscribe/support copy
    expect(src).toMatch(/<img|logo|brand/);
    expect(src).toMatch(/unsubscribe|support|contact/);
  });
});
