import { defineConfig, devices } from '@playwright/test';
import { resolvePlaywrightTarget } from './tests/support/playwright-target';

const { baseURL, shouldStartWebServer, testPort } = resolvePlaywrightTarget();
const rspackDevServerPort =
  process.env.RSPACK_DEVSERVER_PORT ?? String(testPort + 2);

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
        command: `meteor run --port 127.0.0.1:${testPort} --settings tests/settings/playwright-settings.json`,
        env: {
          METEOR_LOCAL_DIR: '.meteor/local-playwright',
          NODE_ENV: 'test',
          PORT: String(testPort),
          ROOT_URL: baseURL,
          RSPACK_DEVSERVER_PORT: rspackDevServerPort,
          RUGBY_ROOSTER_TEST_DATABASE_ID:
            process.env.RUGBY_ROOSTER_TEST_DATABASE_ID ?? '',
          RUGBY_ROOSTER_TEST_DATABASE_NAME:
            process.env.RUGBY_ROOSTER_TEST_DATABASE_NAME ?? '',
          RUGBY_ROOSTER_TEST_MODE:
            process.env.RUGBY_ROOSTER_TEST_MODE ?? '',
          RUGBY_ROOSTER_TEST_MONGO_HOST:
            process.env.RUGBY_ROOSTER_TEST_MONGO_HOST ?? '',
          RUGBY_ROOSTER_TEST_MONGO_PORT:
            process.env.RUGBY_ROOSTER_TEST_MONGO_PORT ?? '',
          RUGBY_ROOSTER_TEST_RUN_ID:
            process.env.RUGBY_ROOSTER_TEST_RUN_ID ?? '',
        },
        reuseExistingServer: false,
        timeout: 300_000,
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
