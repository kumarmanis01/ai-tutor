describe('import hydrators/assembleTest.ts', () => {
  it('imports without throwing', async () => {
    await expect(async () => {
      await import('../../hydrators/assembleTest.ts');
    }).not.toThrow();
  });
});
