const dotenv = require('dotenv');
const path = require('path');

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/test/setup/'],
  collectCoverageFrom: [
    'controllers/**/*.js',
    'routes/**/*.js',
    '!**/node_modules/**',
    '!**/test/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,
  verbose: true,
  globalSetup: '<rootDir>/test/setup/globalSetup.js',
  globalTeardown: '<rootDir>/test/setup/globalTeardown.js',
  maxWorkers: 1, // Run tests serially to avoid database conflicts
};
