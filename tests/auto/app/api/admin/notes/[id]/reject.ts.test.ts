describe('import app/api/admin/notes/[id]/reject.ts', () => {
  it('imports without throwing', async () => {
    await expect(async () => {
      await import('../../../../../../app/api/admin/notes/[id]/reject.ts');
    }).not.toThrow();
  });
});
