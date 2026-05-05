/** Root Jest config: run node + jsdom projects and keep e2e out of Jest. */
module.exports = {
  projects: ['<rootDir>/jest.node.cjs', '<rootDir>/jest.ui.cjs'],
  testPathIgnorePatterns: ['/tests/e2e/', '/scripts/'],
};
