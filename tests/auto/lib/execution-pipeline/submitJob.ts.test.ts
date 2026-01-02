import fs from 'fs';

describe('exists lib/execution-pipeline/submitJob.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\execution-pipeline\\submitJob.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
