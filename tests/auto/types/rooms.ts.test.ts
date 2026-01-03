import fs from 'fs';

describe('exists types/rooms.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\types\\rooms.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
