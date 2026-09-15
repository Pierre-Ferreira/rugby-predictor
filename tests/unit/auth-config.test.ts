import { describe, expect, it } from 'vitest';

import {
  buildMeteorManagedTestDatabaseId,
  POSTMARK_PACKAGE_SETTINGS_KEY,
  resolveAuthThrottleLimits,
  validateAuthRuntimeConfig,
} from '../../imports/shared/auth/config';

const validProductionSettings = {
  appUrl: 'https://rugby-rooster.example',
};

const validPostmarkSettings = {
  apiToken: 'postmark-token-for-unit-tests',
  from: 'pierre@tektite.biz',
  supportEmail: 'pierre@tektite.biz',
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
          RUGBY_ROOSTER_TEST_MONGO_HOST: '127.0.0.1',
          RUGBY_ROOSTER_TEST_MONGO_PORT: '3401',
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
        mongoEndpoint: {
          host: '127.0.0.1',
          port: 3401,
        },
        runId: 'rr-integration-test123',
      },
    });
  });

  it('does not require the isolated helper database contract when helpers are disabled', () => {
    expect(
      validateAuthRuntimeConfig({
        isProduction: false,
        settings: {
          appUrl: 'http://127.0.0.1:3000',
        },
      }),
    ).toMatchObject({
      testEnvironment: null,
      testHelpersEnabled: false,
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
      mailTransportProvider: 'meteor',
      shouldCaptureMailLocally: false,
      testHelpersEnabled: false,
      testEnvironment: null,
    });
  });

  it('selects Postmark when development delivery is enabled with valid settings', () => {
    expect(
      validateAuthRuntimeConfig({
        email: {
          enabled: true,
        },
        isProduction: false,
        postmark: validPostmarkSettings,
        settings: {
          appUrl: 'http://127.0.0.1:3000',
          mail: {
            capture: false,
          },
        },
      }),
    ).toMatchObject({
      mailDeliveryMode: 'transport',
      mailTransportProvider: 'postmark',
      postmark: validPostmarkSettings,
      shouldCaptureMailLocally: false,
      testHelpersEnabled: false,
      testEnvironment: null,
    });
  });

  it('keeps disabled development email on local capture without selecting Postmark', () => {
    expect(
      validateAuthRuntimeConfig({
        email: {
          enabled: false,
        },
        isProduction: false,
        postmark: validPostmarkSettings,
        settings: {
          appUrl: 'http://127.0.0.1:3000',
          mail: {
            capture: false,
          },
        },
      }),
    ).toMatchObject({
      mailDeliveryMode: 'capture',
      mailTransportProvider: null,
      postmark: null,
      shouldCaptureMailLocally: true,
    });
  });

  it('lets isolated capture take precedence over Postmark credentials', () => {
    const localDir = '.meteor/local-integration';

    expect(
      validateAuthRuntimeConfig({
        email: {
          enabled: true,
        },
        env: {
          METEOR_LOCAL_DIR: localDir,
          ROOT_URL: 'http://127.0.0.1:3400',
          RUGBY_ROOSTER_TEST_DATABASE_ID:
            buildMeteorManagedTestDatabaseId(localDir),
          RUGBY_ROOSTER_TEST_DATABASE_NAME: 'meteor',
          RUGBY_ROOSTER_TEST_MODE: 'isolated',
          RUGBY_ROOSTER_TEST_MONGO_HOST: '127.0.0.1',
          RUGBY_ROOSTER_TEST_MONGO_PORT: '3401',
          RUGBY_ROOSTER_TEST_RUN_ID: 'rr-integration-test123',
        },
        isProduction: false,
        postmark: validPostmarkSettings,
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
      mailTransportProvider: null,
      postmark: null,
      shouldCaptureMailLocally: true,
      testHelpersEnabled: true,
    });
  });

  it('fails clearly when enabled Postmark delivery has placeholder credentials', () => {
    expect(() =>
      validateAuthRuntimeConfig({
        email: {
          enabled: true,
        },
        isProduction: false,
        postmark: {
          ...validPostmarkSettings,
          apiToken: 'REPLACE_LOCALLY',
        },
        settings: {
          appUrl: 'http://127.0.0.1:3000',
          mail: {
            capture: false,
          },
        },
      }),
    ).toThrow(
      new RegExp(
        `Meteor\\.settings\\.packages\\["${POSTMARK_PACKAGE_SETTINGS_KEY}"\\]\\.apiToken`,
      ),
    );
  });

  it('rejects enabled Postmark delivery when another transport is configured', () => {
    expect(() =>
      validateAuthRuntimeConfig({
        email: {
          enabled: true,
        },
        env: {
          MAIL_URL: 'smtp://user:secret@mail.example:587',
        },
        isProduction: false,
        postmark: validPostmarkSettings,
        settings: {
          appUrl: 'http://127.0.0.1:3000',
          mail: {
            capture: false,
          },
        },
      }),
    ).toThrow(/cannot be combined with MAIL_URL/);
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

  it('rejects helper enablement without an expected MongoDB endpoint', () => {
    const localDir = '.meteor/local-integration';

    expect(() =>
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
          test: {
            enableTestHelpers: true,
          },
        },
      }),
    ).toThrow(/expected loopback MongoDB endpoint/);
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

  it('keeps shared-address defaults coherent while preserving per-email limits', () => {
    const limits = resolveAuthThrottleLimits();

    expect(limits.linkRequestByAddressAggregate).toMatchObject({
      limit: 40,
      windowMs: 900_000,
    });
    expect(limits.redemptionByAddress).toMatchObject({
      limit: 40,
      windowMs: 900_000,
    });
    expect(limits.linkRequestByEmail.limit).toBe(3);
    expect(limits.redemptionByEmail.limit).toBe(8);
  });

  it('rejects throttle windows outside the documented minute range', () => {
    expect(() =>
      resolveAuthThrottleLimits({
        throttle: {
          redemptionByAddress: {
            windowMinutes: Number.MIN_VALUE,
          },
        },
      }),
    ).toThrow(/Use minutes from 1 to 1440/);

    expect(() =>
      resolveAuthThrottleLimits({
        throttle: {
          linkRequestByEmail: {
            windowMinutes: 0.5,
          },
        },
      }),
    ).toThrow(/Use minutes from 1 to 1440/);
  });
});
