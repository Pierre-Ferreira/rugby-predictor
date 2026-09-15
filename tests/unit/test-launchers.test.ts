import { describe, expect, it } from 'vitest';

import {
  assertNoInheritedMongoConnection,
  buildMeteorManagedTestDatabaseId,
  createIsolatedTestEnvironment,
  deriveRspackDevServerPort,
  parseLoopbackPort,
} from '../../scripts/test-environment.mjs';

describe('test launcher environment', () => {
  it('rejects inherited Mongo connection variables without printing values', () => {
    expect(() =>
      assertNoInheritedMongoConnection({
        MONGO_URL: 'mongodb://user:secret@db.example/prod',
      }),
    ).toThrow(/MONGO_URL/);

    expect(() =>
      assertNoInheritedMongoConnection({
        MONGO_URL: 'mongodb://user:secret@db.example/prod',
      }),
    ).not.toThrow(/secret/);
  });

  it('builds an explicit isolated Meteor-managed test environment', () => {
    const env = createIsolatedTestEnvironment({
      env: {},
      kind: 'integration',
      localDir: '.meteor/local-integration',
      port: 3400,
    });

    expect(env).toMatchObject({
      METEOR_LOCAL_DIR: '.meteor/local-integration',
      NODE_ENV: 'test',
      PORT: '3400',
      ROOT_URL: 'http://127.0.0.1:3400',
      RSPACK_DEVSERVER_PORT: '3402',
      RUGBY_ROOSTER_TEST_DATABASE_ID:
        buildMeteorManagedTestDatabaseId('.meteor/local-integration'),
      RUGBY_ROOSTER_TEST_DATABASE_NAME: 'meteor',
      RUGBY_ROOSTER_TEST_MODE: 'isolated',
    });
    expect(env.RUGBY_ROOSTER_TEST_RUN_ID).toMatch(/^rr-integration-/);
  });

  it('validates configured test ports', () => {
    expect(parseLoopbackPort('3301', 3200, 'Playwright test port')).toBe(3301);
    expect(() =>
      parseLoopbackPort('not-a-port', 3200, 'Playwright test port'),
    ).toThrow(/Playwright test port/);
  });

  it('derives a supported numeric Rspack dev-server port', () => {
    expect(deriveRspackDevServerPort(3200)).toBe(3202);
    expect(() => deriveRspackDevServerPort(65534)).toThrow(
      /Rspack dev server/,
    );
  });
});
