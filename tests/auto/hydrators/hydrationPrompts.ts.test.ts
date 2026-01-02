describe('import hydrators/hydrationPrompts.ts', () => {
  it('imports without throwing', async () => {
    await expect(async () => {
      await import('../../hydrators/hydrationPrompts.ts');
    }).not.toThrow();
  });
});
