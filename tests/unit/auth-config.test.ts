import { describe, expect, it } from 'vitest';

import {
  buildMeteorManagedTestDatabaseId,
  resolveAuthThrottleLimits,
  validateAuthRuntimeConfig,
} from '../../imports/shared/auth/config';

const validProductionSettings = {
  appUrl: 'https://rugby-rooster.example',
};

describe('auth runtime configuration', () => {
  it('rejects production mail capture even when a transport exists', () => {
    expect(() =>
      validateAuthRuntimeConfig({
        env: {
          MAIL_URL: 'smtp://user:secret@mail.example:587',
        },
        isProduction: true,
        settings: {
          ...validProductionSettings,
          mail: {
            capture: true,
          },
        },
      }),
    ).toThrow(/Production cannot use private\.rugbyRooster\.mail\.capture/);
  });

  it('rejects production test helper enablement', () => {
    expect(() =>
      validateAuthRuntimeConfig({
        env: {
          MAIL_URL: 'smtp://user:secret@mail.example:587',
        },
        isProduction: true,
        settings: {
          ...validProductionSettings,
          test: {
            enableTestHelpers: true,
          },
        },
      }),
    ).toThrow(/Production cannot enable/);
  });

  it('rejects production without required mail configuration', () => {
    expect(() =>
      validateAuthRuntimeConfig({
        isProduction: true,
        settings: validProductionSettings,
      }),
    ).toThrow(/Production mail delivery requires/);
  });

  it('allows explicit non-production capture with an isolated helper contract', () => {
    const localDir = '.meteor/local-integration';

    expect(
      validateAuthRuntimeConfig({
        env: {
          METEOR_LOCAL_DIR: localDir,
          ROOT_URL: 'http://127.0.0.1:3400',
          RUGBY_ROOSTER_TEST_DATABASE_ID:
            buildMeteorManagedTestDatabaseId(localDir),
          RUGBY_ROOSTER_TEST_DATABASE_NAME: 'meteor',
          RUGBY_ROOSTER_TEST_MODE: 'isolated',
          RUGBY_ROOSTER_TEST_RUN_ID: 'rr-integration-test123',
        },
        isProduction: false,
        settings: {
          appUrl: 'http://127.0.0.1:3400',
          mail: {
            capture: true,
          },
          test: {
            enableTestHelpers: true,
          },
        },
      }),
    ).toMatchObject({
      mailDeliveryMode: 'capture',
      shouldCaptureMailLocally: true,
      testHelpersEnabled: true,
      testEnvironment: {
        databaseName: 'meteor',
        localDir,
        runId: 'rr-integration-test123',
      },
    });
  });

  it('selects real delivery for normal production configuration', () => {
    expect(
      validateAuthRuntimeConfig({
        env: {
          MAIL_URL: 'smtp://user:secret@mail.example:587',
        },
        isProduction: true,
        settings: validProductionSettings,
      }),
    ).toMatchObject({
      mailDeliveryMode: 'transport',
      shouldCaptureMailLocally: false,
      testHelpersEnabled: false,
      testEnvironment: null,
    });
  });

  it('rejects incomplete isolated-test helper configuration', () => {
    expect(() =>
      validateAuthRuntimeConfig({
        env: {
          METEOR_LOCAL_DIR: '.meteor/local-integration',
          ROOT_URL: 'http://127.0.0.1:3400',
        },
        isProduction: false,
        settings: {
          appUrl: 'http://127.0.0.1:3400',
          mail: {
            capture: true,
          },
          test: {
            enableTestHelpers: true,
          },
        },
      }),
    ).toThrow(/RUGBY_ROOSTER_TEST_MODE=isolated/);
  });

  it('validates throttle configuration', () => {
    expect(
      resolveAuthThrottleLimits({
        throttle: {
          linkRequestByAddressAggregate: {
            limit: 12,
            windowMinutes: 10,
          },
        },
      }).linkRequestByAddressAggregate,
    ).toMatchObject({
      keyPrefix: 'link-address-aggregate',
      limit: 12,
      windowMs: 600_000,
    });

    expect(() =>
      resolveAuthThrottleLimits({
        throttle: {
          linkRequestByEmail: {
            limit: 0,
          },
        },
      }),
    ).toThrow(/Invalid auth throttle limit/);
  });
});
