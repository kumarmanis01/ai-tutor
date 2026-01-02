import fs from 'fs';

describe('exists lib/awsSecrets.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\awsSecrets.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
