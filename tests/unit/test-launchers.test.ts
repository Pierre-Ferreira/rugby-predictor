import { describe, expect, it } from 'vitest';

import {
  assertNoInheritedMongoConnection,
  buildMeteorManagedTestDatabaseId,
  collectOwnedTestProcessIds,
  createIsolatedTestEnvironment,
  deriveMeteorManagedMongoPort,
  deriveRspackDevServerPort,
  parseProcessTable,
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
      RUGBY_ROOSTER_TEST_DATABASE_ID: buildMeteorManagedTestDatabaseId(
        '.meteor/local-integration',
      ),
      RUGBY_ROOSTER_TEST_DATABASE_NAME: 'meteor',
      RUGBY_ROOSTER_TEST_MODE: 'isolated',
      RUGBY_ROOSTER_TEST_MONGO_HOST: '127.0.0.1',
      RUGBY_ROOSTER_TEST_MONGO_PORT: '3401',
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
    expect(() => deriveRspackDevServerPort(65534)).toThrow(/Rspack dev server/);
  });

  it('derives the Meteor-managed MongoDB port from the test port', () => {
    expect(deriveMeteorManagedMongoPort(3400)).toBe(3401);
    expect(() => deriveMeteorManagedMongoPort(65535)).toThrow(
      /Meteor-managed MongoDB/,
    );
  });

  it('collects only isolated run-owned process trees for cleanup', () => {
    const rows = parseProcessTable(`
      100 1 npm exec rspack serve --env devServerPort=3202 --env projectConfigPath=/home/pierreferreira/Desktop/rugby-predictor/rspack.config.ts
      101 100 sh -c "rspack" serve
      102 101 rspack-node
      200 1 /bin/sh -c meteor run --port 127.0.0.1:3200 --settings tests/settings/playwright-settings.json
      201 200 /home/pierreferreira/Desktop/rugby-predictor/.meteor/local-playwright/build/main.js
      300 1 meteor run --port 127.0.0.1:3000 --settings config/local/development.settings.json
      400 1 npm exec rspack serve --env devServerPort=3002 --env projectConfigPath=/home/pierreferreira/Desktop/rugby-predictor/rspack.config.ts
      500 1 node scripts/run-playwright-tests.mjs kaplay-prediction-preview.spec.ts
    `);

    expect(
      collectOwnedTestProcessIds({
        appPort: '3200',
        cwd: '/home/pierreferreira/Desktop/rugby-predictor',
        excludedPids: [500],
        localDir: '.meteor/local-playwright',
        mongoPort: '3201',
        processRows: rows,
        rspackDevServerPort: '3202',
      }),
    ).toEqual([201, 200, 102, 101, 100]);
  });
});
