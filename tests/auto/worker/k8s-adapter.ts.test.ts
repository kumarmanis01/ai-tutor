import fs from 'fs';

describe('exists worker/k8s-adapter.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\worker\\k8s-adapter.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
