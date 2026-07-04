const packageJson = require('../package.json');

describe('package.json', () => {
  it('has required fields', () => {
    expect(packageJson.name).toBe('itsasign');
    expect(packageJson.version).toBe('1.2.0');
    expect(packageJson.type).toBe('commonjs');
  });

  it('has test script', () => {
    expect(packageJson.scripts.test).toBeDefined();
    expect(packageJson.scripts.lint).toBeDefined();
  });

  it('has required dependencies', () => {
    expect(packageJson.dependencies.puppeteer).toBeDefined();
    expect(packageJson.dependencies.serve).toBeDefined();
  });

  it('has dev dependencies', () => {
    expect(packageJson.devDependencies.eslint).toBeDefined();
    expect(packageJson.devDependencies.jest).toBeDefined();
  });
});
