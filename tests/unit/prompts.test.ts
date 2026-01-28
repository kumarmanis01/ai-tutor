import fs from 'fs'
import path from 'path'

describe('prompts folder', () => {
  it('has md files for entries in prompts/prompt_config.json', () => {
    const cfgPath = path.join(process.cwd(), 'prompts', 'prompt_config.json');
    expect(fs.existsSync(cfgPath)).toBe(true);
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    const keys = Object.keys(cfg);
    const files = fs.readdirSync(path.join(process.cwd(), 'prompts'));
    for (const k of keys) {
      const candidates = [
        `${k}.md`,
        `${k.replace(/_/g, '.')}.md`,
        `${k.replace(/_/g, '-')}.md`,
      ];
      // also try splitting parts (e.g. questions_easy -> questions.easy.md)
      if (k.includes('_')) {
        const parts = k.split('_');
        candidates.push(`${parts[0]}.${parts[1]}.md`);
      }
      const found = candidates.some((c) => files.includes(c));
      expect(found).toBe(true);
    }
  });
});
