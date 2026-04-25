import { parentWelcomeHtml } from '@/lib/email/templates';

describe('parentWelcomeHtml', () => {
  it('includes the student name and privacy summary text', () => {
    const html = parentWelcomeHtml(null, 'Asha');
    expect(html).toContain('Asha');
    expect(html).toMatch(/Privacy summary/i);
    expect(html).toContain('https://spinzyacademy.com/parent/dashboard');
  });
});
