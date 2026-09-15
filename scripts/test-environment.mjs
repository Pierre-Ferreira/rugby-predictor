import { randomBytes } from 'node:crypto';

export const INHERITED_MONGO_CONNECTION_VARIABLES = [
  'MONGO_URL',
  'MONGO_OPLOG_URL',
  'METEOR_MONGO_URL',
  'METEOR_OPLOG_URL',
];

const TEST_DATABASE_NAME = 'meteor';
const TEST_MONGO_HOST = '127.0.0.1';

export const buildMeteorManagedTestDatabaseId = (localDir) =>
  `meteor-managed:${localDir}:db`;

export const assertNoInheritedMongoConnection = (env = process.env) => {
  const presentVariables = INHERITED_MONGO_CONNECTION_VARIABLES.filter(
    (name) => env[name],
  );

  if (presentVariables.length > 0) {
    throw new Error(
      `Refusing to start Rugby Rooster tests with inherited Mongo connection variables: ${presentVariables.join(
        ', ',
      )}. Unset them so tests use the Meteor-managed local database.`,
    );
  }
};

export const parseLoopbackPort = (value, fallback, label) => {
  const port = Number(value ?? fallback);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${label} must be a TCP port from 1 to 65535.`);
  }

  return port;
};

export const deriveRspackDevServerPort = (port) => {
  const devServerPort = port + 2;

  if (devServerPort > 65535) {
    throw new Error(
      'Test port must leave room for Meteor-managed MongoDB and the Rspack dev server.',
    );
  }

  return devServerPort;
};

export const deriveMeteorManagedMongoPort = (port) => {
  const mongoPort = port + 1;

  if (mongoPort > 65535) {
    throw new Error('Test port must leave room for Meteor-managed MongoDB.');
  }

  return mongoPort;
};

export const createIsolatedTestEnvironment = ({
  env = process.env,
  kind,
  localDir,
  port,
}) => {
  assertNoInheritedMongoConnection(env);

  const runId = `rr-${kind}-${Date.now().toString(36)}-${randomBytes(
    4,
  ).toString('hex')}`;
  const rootUrl = `http://127.0.0.1:${port}`;

  return {
    ...env,
    METEOR_LOCAL_DIR: localDir,
    NODE_ENV: 'test',
    PORT: String(port),
    ROOT_URL: rootUrl,
    RSPACK_DEVSERVER_PORT: String(deriveRspackDevServerPort(port)),
    RUGBY_ROOSTER_TEST_DATABASE_ID: buildMeteorManagedTestDatabaseId(localDir),
    RUGBY_ROOSTER_TEST_DATABASE_NAME: TEST_DATABASE_NAME,
    RUGBY_ROOSTER_TEST_MODE: 'isolated',
    RUGBY_ROOSTER_TEST_MONGO_HOST: TEST_MONGO_HOST,
    RUGBY_ROOSTER_TEST_MONGO_PORT: String(deriveMeteorManagedMongoPort(port)),
    RUGBY_ROOSTER_TEST_RUN_ID: runId,
  };
};
