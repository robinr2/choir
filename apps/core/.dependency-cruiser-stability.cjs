const { options } = require('./.dependency-cruiser.cjs');

module.exports = {
  forbidden: [
    {
      name: 'no-unstable-dependencies',
      severity: 'error',
      from: {},
      to: { moreUnstable: true },
    },
  ],
  options: {
    ...options,
    exclude: { path: ['\\.(e2e-)?spec\\.tsx?$', '^test/'] },
  },
};
