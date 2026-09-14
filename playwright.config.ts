import { defineConfig, devices } from '@playwright/test';
import { resolvePlaywrightTarget } from './tests/support/playwright-target';

const { baseURL, shouldStartWebServer, testPort } = resolvePlaywrightTarget();

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: shouldStartWebServer
    ? {
        command: `meteor run --port ${testPort}`,
        env: {
          NODE_ENV: 'test',
          PORT: String(testPort),
          ROOT_URL: baseURL,
        },
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        url: baseURL,
      }
    : undefined,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
