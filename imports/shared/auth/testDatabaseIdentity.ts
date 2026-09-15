export interface MongoConnectionEndpoint {
  readonly host: string;
  readonly port: number;
}

export interface ExpectedMongoConnectionIdentity {
  readonly databaseName: string;
  readonly endpoint: MongoConnectionEndpoint;
}

export interface ObservedMongoConnectionIdentity {
  readonly databaseName: string | null;
  readonly endpoints: readonly MongoConnectionEndpoint[] | null;
  readonly topology: 'single' | 'multiple' | 'srv' | 'load-balanced' | 'unknown';
}

const SUPPORTED_LOOPBACK_HOSTS = new Map<string, string>([
  ['127.0.0.1', '127.0.0.1'],
  ['localhost', 'localhost'],
  ['::1', '::1'],
  ['[::1]', '::1'],
]);

const parseTcpPort = (value: string | undefined, label: string): number => {
  const trimmed = value?.trim();

  if (!trimmed || !/^\d+$/.test(trimmed)) {
    throw new Error(`${label} must be a TCP port from 1 to 65535.`);
  }

  const port = Number(trimmed);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${label} must be a TCP port from 1 to 65535.`);
  }

  return port;
};

export const normalizeSupportedLoopbackHost = (
  host: string | undefined,
): string | null => {
  const trimmed = host?.trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  return SUPPORTED_LOOPBACK_HOSTS.get(trimmed) ?? null;
};

export const resolveExpectedMongoConnectionIdentity = ({
  databaseName,
  host,
  port,
}: {
  readonly databaseName: string | undefined;
  readonly host: string | undefined;
  readonly port: string | undefined;
}): ExpectedMongoConnectionIdentity => {
  const normalizedHost = normalizeSupportedLoopbackHost(host);

  if (!normalizedHost) {
    throw new Error(
      'Auth test helpers require an expected loopback MongoDB endpoint.',
    );
  }

  if (!databaseName) {
    throw new Error('Auth test helpers require an expected MongoDB database.');
  }

  return {
    databaseName,
    endpoint: {
      host: normalizedHost,
      port: parseTcpPort(port, 'RUGBY_ROOSTER_TEST_MONGO_PORT'),
    },
  };
};

export const assertIsolatedMongoConnectionIdentity = ({
  expected,
  observed,
}: {
  readonly expected: ExpectedMongoConnectionIdentity;
  readonly observed: ObservedMongoConnectionIdentity | null;
}): ObservedMongoConnectionIdentity => {
  if (!observed) {
    throw new Error(
      'Auth test helpers require active MongoDB connection metadata.',
    );
  }

  if (
    observed.topology === 'srv' ||
    observed.topology === 'load-balanced' ||
    observed.topology === 'unknown'
  ) {
    throw new Error(
      'Auth test helpers require a supported local MongoDB topology.',
    );
  }

  if (!observed.endpoints || observed.endpoints.length < 1) {
    throw new Error(
      'Auth test helpers require an active MongoDB endpoint.',
    );
  }

  if (!observed.databaseName) {
    throw new Error(
      'Auth test helpers require the active MongoDB database name.',
    );
  }

  if (observed.databaseName !== expected.databaseName) {
    throw new Error(
      'Auth test helpers refused to run against the active database.',
    );
  }

  const normalizedEndpoints = observed.endpoints.map((endpoint) => ({
    host: normalizeSupportedLoopbackHost(endpoint.host),
    port: endpoint.port,
  }));

  if (normalizedEndpoints.some((endpoint) => !endpoint.host)) {
    throw new Error(
      'Auth test helpers require the active MongoDB endpoint to be loopback.',
    );
  }

  if (
    normalizedEndpoints.some(
      (endpoint) => endpoint.port !== expected.endpoint.port,
    ) ||
    normalizedEndpoints.every(
      (endpoint) => endpoint.host !== expected.endpoint.host,
    )
  ) {
    throw new Error(
      'Auth test helpers refused to run against the active MongoDB endpoint.',
    );
  }

  return observed;
};
