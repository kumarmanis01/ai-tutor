/**
 * FILE OBJECTIVE:
 * - Jest configuration for the node-environment project (backend, API
 *   route, worker and service unit tests). Defines testMatch, transform,
 *   module aliases and the setup files that prime each test process.
 *
 * LINKED UNIT TEST:
 * - (test-infra; exercised by every node-project spec.)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-06-07T00:00:00Z | claude | replace single-line note with standard header.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.spec.ts'],
  testPathIgnorePatterns: ['/tests/integration/', '/tests/e2e/', '/scripts/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/lib/(.*)\\.js$': '<rootDir>/lib/$1.ts',
    '^@/lib/(.*)\\.ts$': '<rootDir>/lib/$1.ts',
    '^@/lib/(.*)$': ['<rootDir>/lib/$1.ts', '<rootDir>/lib/$1/index.ts', '<rootDir>/lib/$1'],
    '^@/components/(.*)$': [
      '<rootDir>/components/$1.tsx',
      '<rootDir>/components/$1.ts',
      '<rootDir>/components/$1/index.tsx',
      '<rootDir>/components/$1/index.ts',
      '<rootDir>/src/components/$1.tsx',
      '<rootDir>/src/components/$1.ts',
    ],
    '^@/(.*)\\.js$': [
      '<rootDir>/src/$1.js',
      '<rootDir>/$1.js',
      '<rootDir>/src/$1.ts',
      '<rootDir>/$1.ts',
      '<rootDir>/lib/$1.ts',
    ],
    '^@/(.*)$': [
      '<rootDir>/src/$1',
      '<rootDir>/$1',
      '<rootDir>/lib/$1',
      '<rootDir>/components/$1',
    ],
    '^@prisma/client$': '<rootDir>/tests/mocks/prismaClientMock.ts'
  },
  moduleDirectories: ['node_modules', '<rootDir>'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  setupFiles: ['<rootDir>/tests/setup/forceTestNodeEnv.cjs'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/normalizePaths.cjs', '<rootDir>/tests/setup/prismaEnsureColumns.ts', '<rootDir>/tests/setup/loggerTeardown.ts', '<rootDir>/tests/setup/navigationMock.ts'],
}
