describe('import hydrators/hydrateNotes.ts', () => {
  it('imports without throwing', async () => {
    await expect(async () => {
      await import('../../hydrators/hydrateNotes.ts');
    }).not.toThrow();
  });
});
