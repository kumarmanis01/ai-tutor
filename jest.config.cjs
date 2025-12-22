/** Jest config using ts-jest for TypeScript tests */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // run only unit tests by default; integration tests are excluded
  testMatch: ['**/tests/**/*.test.ts'],
  testPathIgnorePatterns: ['/tests/integration/'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
};
