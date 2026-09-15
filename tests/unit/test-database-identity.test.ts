import { describe, expect, it } from 'vitest';

import {
  assertIsolatedMongoConnectionIdentity,
  type ExpectedMongoConnectionIdentity,
  type ObservedMongoConnectionIdentity,
  resolveExpectedMongoConnectionIdentity,
} from '../../imports/shared/auth/testDatabaseIdentity';

const expectedIdentity: ExpectedMongoConnectionIdentity = {
  databaseName: 'meteor',
  endpoint: {
    host: '127.0.0.1',
    port: 3401,
  },
};

const observedIdentity = (
  override: Partial<ObservedMongoConnectionIdentity> = {},
): ObservedMongoConnectionIdentity => ({
  databaseName: 'meteor',
  endpoints: [
    {
      host: '127.0.0.1',
      port: 3401,
    },
  ],
  topology: 'single',
  ...override,
});

describe('isolated test database identity verification', () => {
  it('accepts the expected local endpoint and database', () => {
    expect(
      assertIsolatedMongoConnectionIdentity({
        expected: expectedIdentity,
        observed: observedIdentity(),
      }),
    ).toMatchObject({
      databaseName: 'meteor',
      endpoints: [
        {
          host: '127.0.0.1',
          port: 3401,
        },
      ],
    });
  });

  it('accepts multiple loopback aliases on the expected MongoDB port', () => {
    expect(
      assertIsolatedMongoConnectionIdentity({
        expected: expectedIdentity,
        observed: observedIdentity({
          endpoints: [
            {
              host: 'localhost',
              port: 3401,
            },
            {
              host: '127.0.0.1',
              port: 3401,
            },
          ],
          topology: 'multiple',
        }),
      }),
    ).toMatchObject({
      databaseName: 'meteor',
      topology: 'multiple',
    });
  });

  it('rejects the right database on the wrong port', () => {
    expect(() =>
      assertIsolatedMongoConnectionIdentity({
        expected: expectedIdentity,
        observed: observedIdentity({
          endpoints: [
            {
              host: '127.0.0.1',
              port: 3201,
            },
          ],
        }),
      }),
    ).toThrow(/active MongoDB endpoint/);
  });

  it('rejects the right endpoint on the wrong database', () => {
    expect(() =>
      assertIsolatedMongoConnectionIdentity({
        expected: expectedIdentity,
        observed: observedIdentity({
          databaseName: 'production',
        }),
      }),
    ).toThrow(/active database/);
  });

  it('rejects non-loopback observed endpoints', () => {
    expect(() =>
      assertIsolatedMongoConnectionIdentity({
        expected: expectedIdentity,
        observed: observedIdentity({
          endpoints: [
            {
              host: 'db.example.test',
              port: 3401,
            },
          ],
        }),
      }),
    ).toThrow(/endpoint to be loopback/);
  });

  it('rejects missing, unavailable, ambiguous, or unsupported metadata', () => {
    expect(() =>
      assertIsolatedMongoConnectionIdentity({
        expected: expectedIdentity,
        observed: null,
      }),
    ).toThrow(/connection metadata/);

    expect(() =>
      assertIsolatedMongoConnectionIdentity({
        expected: expectedIdentity,
        observed: observedIdentity({
          endpoints: null,
        }),
      }),
    ).toThrow(/active MongoDB endpoint/);

    expect(() =>
      assertIsolatedMongoConnectionIdentity({
        expected: expectedIdentity,
        observed: observedIdentity({
          endpoints: [
            {
              host: '127.0.0.1',
              port: 3401,
            },
            {
              host: '127.0.0.1',
              port: 3402,
            },
          ],
          topology: 'multiple',
        }),
      }),
    ).toThrow(/active MongoDB endpoint/);

    expect(() =>
      assertIsolatedMongoConnectionIdentity({
        expected: expectedIdentity,
        observed: observedIdentity({
          topology: 'srv',
        }),
      }),
    ).toThrow(/supported local MongoDB topology/);

    expect(() =>
      assertIsolatedMongoConnectionIdentity({
        expected: expectedIdentity,
        observed: observedIdentity({
          databaseName: null,
        }),
      }),
    ).toThrow(/database name/);
  });

  it('normalizes only explicitly supported loopback representations', () => {
    expect(
      resolveExpectedMongoConnectionIdentity({
        databaseName: 'meteor',
        host: '[::1]',
        port: '3401',
      }),
    ).toMatchObject({
      endpoint: {
        host: '::1',
        port: 3401,
      },
    });

    expect(() =>
      resolveExpectedMongoConnectionIdentity({
        databaseName: 'meteor',
        host: 'database.local',
        port: '3401',
      }),
    ).toThrow(/expected loopback/);
  });
});
