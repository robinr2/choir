import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    root: './',
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          sequence: { groupOrder: 0 },
          include: ['src/**/*.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          sequence: { groupOrder: 1 },
          include: ['test/**/*.e2e-spec.ts'],
          testTimeout: 60_000,
          hookTimeout: 60_000,
          restoreMocks: true,
        },
      },
    ],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/test/**'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
