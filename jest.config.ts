import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.spec.ts'],
  coverageDirectory: '../coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json-summary',
  ],
  coverageThreshold: {
    global: {
      // Aligned with current suite; raise as coverage improves
      branches: 77,
      functions: 89,
      lines: 91,
      statements: 90,
    },
  },
};

export default config;
