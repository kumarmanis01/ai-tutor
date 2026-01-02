import fs from 'fs';

describe('exists queues/contentQueue.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\queues\\contentQueue.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
