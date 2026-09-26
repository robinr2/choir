import { playwright } from '@vitest/browser-playwright';
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['src/**/*.spec.tsx', 'src/**/*.spec.ts'],
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        instances: [{ browser: 'chromium' }],
      },
      coverage: {
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.spec.{ts,tsx}',
          'src/main.tsx',
          'src/components/ui/**',
          'src/components/assistant-ui/**',
          'src/hooks/use-attachment-src.ts',
          'src/hooks/use-copy-to-clipboard.ts',
          'src/components/pipecat/**',
          'src/lib/visualizer.ts',
        ],
        thresholds: {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
      },
    },
  }),
);
