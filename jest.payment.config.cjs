// Temporary Jest config used to run only payment-related tests added in this change.
const base = require('./jest.node.cjs');

module.exports = {
  ...base,
  testPathIgnorePatterns: ['/scripts/'],
  testMatch: [
    '<rootDir>/__tests__/app/api/payments/**/**.test.ts',
    '<rootDir>/tests/integration/payment_methods.integration.test.ts',
  ],
};
