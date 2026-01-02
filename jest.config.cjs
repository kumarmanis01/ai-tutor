/** Jest config using ts-jest for TypeScript tests */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // run only unit tests by default; integration tests are excluded
  testMatch: ['**/tests/**/*.test.ts'],
  testPathIgnorePatterns: ['/tests/integration/', '\\.*\\.d\\.ts\\.test\\.ts$'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  moduleNameMapper: {
    // map @/lib/... to the repo root lib/ folder, and everything else to src/
    '^@/(lib/.*)$': '<rootDir>/$1',
    '^@/(producers/.*)$': '<rootDir>/$1',
    '^@/(queues/.*)$': '<rootDir>/$1',
    '^@/(workers/.*)$': '<rootDir>/$1',
    // default: map `@/whatever` -> `src/whatever` to match source layout
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  moduleDirectories: ['node_modules', '<rootDir>'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup/prismaEnsureColumns.ts', '<rootDir>/tests/setup/loggerTeardown.ts'],
  // Force exit after tests to avoid intermittent open-handle failures in CI
  // This is a pragmatic fix; ideally open handles should be tracked down.
  forceExit: true,
};
