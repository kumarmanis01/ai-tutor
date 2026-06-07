/** Jest jsdom project config (UI / component tests) */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: [
    '**/tests/**/*.test.tsx',
    '**/tests/**/*.spec.tsx',
    '**/tests/unit/components/**/*.test.ts',
    '**/tests/unit/components/**/*.spec.ts',
    '**/tests/components/**/*.test.ts',
    '**/tests/components/**/*.spec.ts',
    '**/tests/unit/app/**/page.test.ts',
    '**/tests/unit/app/**/page.spec.ts',
    '**/__tests__/**/*.test.tsx',
    '**/__tests__/**/*.spec.tsx',
  ],
  testPathIgnorePatterns: ['/tests/integration/', '/tests/e2e/', '/scripts/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/lib/(.*)\\.js$': '<rootDir>/lib/$1.ts',
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
    '^.+\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/tests/__mocks__/fileMock.js',
    '^@prisma/client$': '<rootDir>/tests/mocks/prismaClientMock.ts'
  },
  moduleDirectories: ['node_modules', '<rootDir>'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  setupFiles: ['<rootDir>/tests/setup/forceTestNodeEnv.cjs'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jsdomPolyfills.ts', '<rootDir>/tests/setup/normalizePaths.cjs', '<rootDir>/tests/setup/loggerTeardown.ts'],
}
