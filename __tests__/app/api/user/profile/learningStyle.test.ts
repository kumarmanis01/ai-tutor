test('profile route exports VALID_LEARNING_STYLES with expected values', async () => {
  const { VALID_LEARNING_STYLES } = await import('../../../../../app/api/user/profile/route');

  expect(VALID_LEARNING_STYLES).toEqual(['visual', 'reading', 'kinesthetic', 'verbal', 'practice', 'mixed']);
});
