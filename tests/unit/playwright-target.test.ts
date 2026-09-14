import { describe, expect, it } from 'vitest';
import { resolvePlaywrightTarget } from '../support/playwright-target';

describe('Playwright target resolution', () => {
  it('uses the dedicated local test port by default', () => {
    expect(resolvePlaywrightTarget({})).toEqual({
      baseURL: 'http://127.0.0.1:3200',
      shouldStartWebServer: true,
      testPort: 3200,
    });
  });

  it('honors a custom local port when starting the web server', () => {
    expect(resolvePlaywrightTarget({ PORT: '3301' })).toEqual({
      baseURL: 'http://127.0.0.1:3301',
      shouldStartWebServer: true,
      testPort: 3301,
    });
  });

  it('allows an explicit local Playwright base URL without starting Meteor', () => {
    expect(
      resolvePlaywrightTarget({
        PLAYWRIGHT_BASE_URL: 'http://localhost:3200',
      }),
    ).toEqual({
      baseURL: 'http://localhost:3200',
      shouldStartWebServer: false,
      testPort: 3200,
    });
  });

  it('rejects non-local Playwright base URLs', () => {
    expect(() =>
      resolvePlaywrightTarget({
        PLAYWRIGHT_BASE_URL: 'https://rugby-rooster.example.com',
      }),
    ).toThrow(/Refusing to run Playwright tests against non-local host/);
  });

  it('rejects invalid test ports', () => {
    expect(() => resolvePlaywrightTarget({ PORT: 'not-a-port' })).toThrow(
      /Invalid Playwright test port/,
    );
  });
});
