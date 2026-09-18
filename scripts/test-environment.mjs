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

/**
 * @typedef {{
 *   readonly command: string;
 *   readonly pid: number;
 *   readonly ppid: number;
 * }} ProcessTableRow
 */

/**
 * @param {string} stdout
 * @returns {ProcessTableRow[]}
 */
export const parseProcessTable = (stdout) =>
  stdout
    .split('\n')
    .map((line) => {
      const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);

      if (!match) {
        return null;
      }

      return {
        command: match[3],
        pid: Number(match[1]),
        ppid: Number(match[2]),
      };
    })
    .filter(Boolean);

/**
 * @param {{
 *   readonly appPort: number | string;
 *   readonly cwd: string;
 *   readonly excludedPids?: readonly number[];
 *   readonly localDir: string;
 *   readonly mongoPort: number | string;
 *   readonly processRows: readonly ProcessTableRow[];
 *   readonly rspackDevServerPort: number | string;
 * }} input
 * @returns {number[]}
 */
export const collectOwnedTestProcessIds = ({
  appPort,
  cwd,
  excludedPids = [],
  localDir,
  mongoPort,
  processRows,
  rspackDevServerPort,
}) => {
  const excluded = new Set(excludedPids);
  const byParent = new Map();
  const seedPids = new Set();

  for (const row of processRows) {
    if (!byParent.has(row.ppid)) {
      byParent.set(row.ppid, []);
    }

    byParent.get(row.ppid).push(row);

    const command = row.command;
    const isOwnedSeed =
      command.includes(localDir) ||
      (command.includes(cwd) &&
        command.includes(`devServerPort=${rspackDevServerPort}`)) ||
      (command.includes(`127.0.0.1:${appPort}`) &&
        command.includes('tests/settings/playwright-settings.json')) ||
      (command.includes(`--port ${mongoPort}`) && command.includes(localDir));

    if (isOwnedSeed && !excluded.has(row.pid)) {
      seedPids.add(row.pid);
    }
  }

  const owned = new Set(seedPids);
  const queue = [...seedPids];

  while (queue.length > 0) {
    const parentPid = queue.shift();
    const children = byParent.get(parentPid) ?? [];

    for (const child of children) {
      if (!owned.has(child.pid) && !excluded.has(child.pid)) {
        owned.add(child.pid);
        queue.push(child.pid);
      }
    }
  }

  return [...owned].sort((a, b) => b - a);
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
