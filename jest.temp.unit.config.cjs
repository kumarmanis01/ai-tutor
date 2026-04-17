module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],
  testPathIgnorePatterns: ['/tests/integration/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/lib/(.*)\\.js$': '<rootDir>/lib/$1.ts',
    '^@/lib/(.*)\\.ts$': '<rootDir>/lib/$1.ts',
    '^@/lib/(.*)$': ['<rootDir>/lib/$1.ts', '<rootDir>/lib/$1/index.ts', '<rootDir>/lib/$1'],
    '^@/(.*)\\.js$': '<rootDir>/src/$1.ts',
    // Fallback to handle relative lib imports and Windows paths
    '^[\\/\\.\\w\-]*(?:\\\|/)?lib(?:\\|/)(.*)\\.js$': '<rootDir>/lib/$1.ts',
    '^[\\/\\.\\w\-]*(?:\\\|/)?lib(?:\\|/)(.*)$': ['<rootDir>/lib/$1.ts', '<rootDir>/lib/$1/index.ts'],
    '^@/(.*)$': ['<rootDir>/src/$1', '<rootDir>/$1']
  },
  moduleDirectories: ['node_modules', '<rootDir>'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  setupFiles: ['<rootDir>/tests/setup/forceTestNodeEnv.cjs'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jsdomPolyfills.ts', '<rootDir>/tests/setup/normalizePaths.cjs', '<rootDir>/tests/setup/normalizePaths.ts', '<rootDir>/tests/setup/prismaEnsureColumns.ts', '<rootDir>/tests/setup/loggerTeardown.ts'],
  forceExit: true,
  collectCoverage: false,
};
