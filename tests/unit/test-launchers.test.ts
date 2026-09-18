import { describe, expect, it } from 'vitest';

import {
  assertNoInheritedMongoConnection,
  buildMeteorManagedTestDatabaseId,
  cleanupOwnedTestProcesses,
  createOwnedTestProcessTracker,
  createIsolatedTestEnvironment,
  deriveMeteorManagedMongoPort,
  deriveRspackDevServerPort,
  ownedTestProcessRecords,
  parseProcessTable,
  parseLoopbackPort,
  recordOwnedTestProcessTree,
} from '../../scripts/test-environment.mjs';

type SyntheticIdentity = {
  readonly command?: string;
  readonly pid: number;
  readonly startId: string;
};

const identity = (
  pid: number,
  startId = `start-${pid}`,
  command?: string,
): SyntheticIdentity => ({
  command,
  pid,
  startId,
});

const createIdentityLookup =
  (identities: Map<number, SyntheticIdentity | Error | null>) =>
  (pid: number) => {
    const value = identities.get(pid);

    if (value instanceof Error) {
      throw value;
    }

    return value ?? null;
  };

const metadataError = (message: string) =>
  Object.assign(new Error(message), { code: 'EACCES' });

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

  it('records only the current launcher root and verified descendants for cleanup', () => {
    const rows = parseProcessTable(`
      100 1 npm exec rspack serve --env devServerPort=3202 --env projectConfigPath=/tmp/other/.meteor/local-playwright/rspack.config.ts
      101 100 sh -c "rspack" serve
      200 1 /bin/sh -c meteor run --port 127.0.0.1:3200 --settings tests/settings/playwright-settings.json
      201 200 /home/pierreferreira/Desktop/rugby-predictor/.meteor/local-playwright/build/main.js
      300 1 meteor run --port 127.0.0.1:3000 --settings config/local/development.settings.json
      400 1 npm exec rspack serve --env devServerPort=3002 --env projectConfigPath=/home/pierreferreira/Desktop/rugby-predictor/rspack.config.ts
      410 1 npm exec rspack serve --env devServerPort=32020 --env projectConfigPath=/home/pierreferreira/Desktop/rugby-predictor/rspack.config.ts
      500 1 node scripts/run-playwright-tests.mjs kaplay-prediction-preview.spec.ts
      501 500 /bin/sh -c meteor run --port 127.0.0.1:3200 --settings tests/settings/playwright-settings.json
      502 501 /home/pierreferreira/Desktop/rugby-predictor/.meteor/local-playwright/build/main.js
      503 502 npm exec rspack serve --env devServerPort=3202 --env projectConfigPath=/home/pierreferreira/Desktop/rugby-predictor/rspack.config.ts
      600 1 /home/pierreferreira/Desktop/rugby-predictor/.meteor/local-playwright/orphan.js
    `);
    const identities = new Map([
      [500, identity(500)],
      [501, identity(501)],
      [502, identity(502)],
      [503, identity(503)],
      [600, identity(600)],
    ]);
    const tracker = createOwnedTestProcessTracker({
      rootIdentity: identity(500),
      rootPid: 500,
      runId: 'rr-e2e-current',
    });

    const result = recordOwnedTestProcessTree({
      identityLookup: createIdentityLookup(identities),
      processRows: rows,
      tracker,
    });

    expect(result.recorded).toEqual([503, 502, 501, 500]);
    expect(
      ownedTestProcessRecords(tracker).map((record) => record.pid),
    ).toEqual([503, 502, 501, 500]);
  });

  it('signals only verified owned records and skips exited or changed identities', async () => {
    const rows = parseProcessTable(`
      500 1 node scripts/run-playwright-tests.mjs kaplay-prediction-preview.spec.ts
      501 500 meteor run --port 127.0.0.1:3200 --settings tests/settings/playwright-settings.json
      502 501 rspack serve --env devServerPort=3202
    `);
    const identities = new Map<number, SyntheticIdentity | Error | null>([
      [500, identity(500)],
      [501, identity(501)],
      [502, identity(502)],
    ]);
    const tracker = createOwnedTestProcessTracker({
      rootIdentity: identity(500),
      rootPid: 500,
      runId: 'rr-e2e-current',
    });
    const signalCalls: Array<{
      readonly pid: number;
      readonly signal: string;
    }> = [];

    recordOwnedTestProcessTree({
      identityLookup: createIdentityLookup(identities),
      processRows: rows,
      tracker,
    });

    identities.set(500, null);
    identities.set(501, identity(501, 'reused-501'));

    const result = await cleanupOwnedTestProcesses({
      graceMs: 0,
      identityLookup: createIdentityLookup(identities),
      signalProcess: (pid, signal) => {
        signalCalls.push({ pid, signal: String(signal) });
      },
      sleep: async () => {},
      tracker,
    });

    expect(signalCalls).toEqual([
      { pid: 502, signal: 'SIGTERM' },
      { pid: 502, signal: 'SIGKILL' },
    ]);
    expect(result.term.exited).toEqual([
      { pid: 500, reason: 'not-running', signal: 'SIGTERM' },
    ]);
    expect(result.term.skipped).toEqual([
      { pid: 501, reason: 'identity-changed', signal: 'SIGTERM' },
    ]);
    expect(result.kill.sent).toEqual([
      { pid: 502, signal: 'SIGKILL', status: 'sent' },
    ]);
  });

  it('keeps a verified descendant eligible after reparenting while identity matches', async () => {
    const rows = parseProcessTable(`
      700 1 node scripts/run-playwright-tests.mjs kaplay-prediction-preview.spec.ts
      701 700 meteor run --port 127.0.0.1:3200 --settings tests/settings/playwright-settings.json
    `);
    const identities = new Map<number, SyntheticIdentity | Error | null>([
      [700, identity(700)],
      [701, identity(701)],
    ]);
    const tracker = createOwnedTestProcessTracker({
      rootIdentity: identity(700),
      rootPid: 700,
      runId: 'rr-e2e-current',
    });
    const signalCalls: Array<{
      readonly pid: number;
      readonly signal: string;
    }> = [];

    recordOwnedTestProcessTree({
      identityLookup: createIdentityLookup(identities),
      processRows: rows,
      tracker,
    });

    identities.set(700, null);

    await cleanupOwnedTestProcesses({
      graceMs: 0,
      identityLookup: createIdentityLookup(identities),
      signalProcess: (pid, signal) => {
        signalCalls.push({ pid, signal: String(signal) });
      },
      sleep: async () => {},
      tracker,
    });

    expect(signalCalls).toEqual([
      { pid: 701, signal: 'SIGTERM' },
      { pid: 701, signal: 'SIGKILL' },
    ]);
  });

  it('does not record descendants when ownership metadata is incomplete or unreadable', () => {
    const rows = parseProcessTable(`
      800 1 node scripts/run-playwright-tests.mjs kaplay-prediction-preview.spec.ts
      801 800 meteor run --port 127.0.0.1:3200 --settings tests/settings/playwright-settings.json
      802 800 rspack serve --env devServerPort=3202
    `);
    const identities = new Map<number, SyntheticIdentity | Error | null>([
      [800, identity(800)],
      [801, { pid: 801, startId: '' }],
      [802, metadataError('metadata denied')],
    ]);
    const tracker = createOwnedTestProcessTracker({
      rootIdentity: identity(800),
      rootPid: 800,
      runId: 'rr-e2e-current',
    });

    const result = recordOwnedTestProcessTree({
      identityLookup: createIdentityLookup(identities),
      processRows: rows,
      tracker,
    });

    expect(result.recorded).toEqual([800]);
    expect(result.skipped).toEqual([
      { pid: 801, reason: 'identity-unverified' },
      { pid: 802, reason: 'identity-unavailable:metadata denied' },
    ]);
  });

  it('does not signal on repeated cleanup calls or recruit later matching processes', async () => {
    const rows = parseProcessTable(`
      900 1 node scripts/run-playwright-tests.mjs kaplay-prediction-preview.spec.ts
      901 900 meteor run --port 127.0.0.1:3200 --settings tests/settings/playwright-settings.json
    `);
    const identities = new Map([
      [900, identity(900)],
      [901, identity(901)],
      [902, identity(902)],
    ]);
    const tracker = createOwnedTestProcessTracker({
      rootIdentity: identity(900),
      rootPid: 900,
      runId: 'rr-e2e-current',
    });
    const signalCalls: Array<{
      readonly pid: number;
      readonly signal: string;
    }> = [];

    recordOwnedTestProcessTree({
      identityLookup: createIdentityLookup(identities),
      processRows: rows,
      tracker,
    });

    await cleanupOwnedTestProcesses({
      graceMs: 0,
      identityLookup: createIdentityLookup(identities),
      signalProcess: (pid, signal) => {
        signalCalls.push({ pid, signal: String(signal) });
      },
      sleep: async () => {},
      tracker,
    });

    recordOwnedTestProcessTree({
      identityLookup: createIdentityLookup(identities),
      processRows: parseProcessTable(`
        900 1 node scripts/run-playwright-tests.mjs kaplay-prediction-preview.spec.ts
        902 900 /home/pierreferreira/Desktop/rugby-predictor/.meteor/local-playwright/new-child.js
      `),
      tracker,
    });

    const repeated = await cleanupOwnedTestProcesses({
      graceMs: 0,
      identityLookup: createIdentityLookup(identities),
      signalProcess: (pid, signal) => {
        signalCalls.push({ pid, signal: String(signal) });
      },
      sleep: async () => {},
      tracker,
    });

    expect(signalCalls).toEqual([
      { pid: 901, signal: 'SIGTERM' },
      { pid: 900, signal: 'SIGTERM' },
      { pid: 901, signal: 'SIGKILL' },
      { pid: 900, signal: 'SIGKILL' },
    ]);
    expect(repeated.alreadyStarted).toBe(true);
  });
});
