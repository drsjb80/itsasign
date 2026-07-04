module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.js', '**/*.test.js'],
  collectCoverageFrom: [
    'widgets/**/*.js',
    '!**/*.test.js',
    '!node_modules/**'
  ]
};
