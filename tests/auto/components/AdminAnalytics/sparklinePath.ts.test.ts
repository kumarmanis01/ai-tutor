describe('import components/AdminAnalytics/sparklinePath.ts', () => {
  it('imports without throwing', async () => {
    await expect(async () => {
      await import('../../../components/AdminAnalytics/sparklinePath.ts');
    }).not.toThrow();
  });
});
