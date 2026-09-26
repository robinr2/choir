import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const fakeMicrophone = path.resolve(
  import.meta.dirname,
  'e2e/fixtures/quick-brown-fox.wav',
);

function server(recipe: string, url: string) {
  return {
    command: `just ${recipe}`,
    cwd: repoRoot,
    url,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  };
}

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 120_000,
  forbidOnly: !!process.env.CI,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:5173',
    permissions: ['microphone'],
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${fakeMicrophone}`,
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
  webServer: [
    server('web', 'http://localhost:5173'),
    server('core', 'http://localhost:3000'),
    server('voice', 'http://localhost:7860/docs'),
  ],
});
