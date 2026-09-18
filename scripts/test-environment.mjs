import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

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
 *   readonly command?: string;
 *   readonly pid: number;
 *   readonly startId: string;
 * }} ProcessIdentity
 */

/**
 * @typedef {{
 *   readonly command: string;
 *   readonly origin: 'spawned-root' | 'verified-descendant';
 *   readonly pid: number;
 *   readonly ppid: number | null;
 *   readonly runId: string;
 *   readonly startId: string;
 *   readonly verifiedAt: string;
 * }} OwnedProcessRecord
 */

/**
 * @typedef {{
 *   cleanupStarted: boolean;
 *   readonly records: Map<number, OwnedProcessRecord>;
 *   readonly rootIdentityVerified: boolean;
 *   readonly rootPid: number | null;
 *   readonly runId: string;
 * }} OwnedProcessTracker
 */

const normalizeProcessIdentity = (identity) => {
  if (!identity || typeof identity !== 'object') {
    return null;
  }

  const pid = Number(identity.pid);
  const startId = identity.startId;

  if (!Number.isInteger(pid) || typeof startId !== 'string' || !startId) {
    return null;
  }

  return {
    command:
      typeof identity.command === 'string' ? identity.command : undefined,
    pid,
    startId,
  };
};

const processIdentityMatches = (record, identity) => {
  const normalized = normalizeProcessIdentity(identity);

  return (
    normalized !== null &&
    normalized.pid === record.pid &&
    normalized.startId === record.startId
  );
};

const toErrorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

const toErrorCode = (error) =>
  error && typeof error === 'object' && 'code' in error
    ? String(error.code)
    : undefined;

const parseLinuxStatStartId = (stat) => {
  const commandEnd = stat.lastIndexOf(') ');

  if (commandEnd === -1) {
    return null;
  }

  const fieldsAfterCommand = stat
    .slice(commandEnd + 2)
    .trim()
    .split(/\s+/);

  return fieldsAfterCommand[19] ?? null;
};

export const readLinuxProcessIdentity = (pid) => {
  const numericPid = Number(pid);

  if (!Number.isInteger(numericPid)) {
    return null;
  }

  try {
    const stat = readFileSync(`/proc/${numericPid}/stat`, 'utf8');
    const startId = parseLinuxStatStartId(stat);

    return startId ? { pid: numericPid, startId } : null;
  } catch (error) {
    if (toErrorCode(error) === 'ENOENT') {
      return null;
    }

    throw error;
  }
};

const upsertOwnedProcessRecord = ({
  command,
  origin,
  pid,
  ppid,
  runId,
  startId,
  tracker,
  verifiedAt,
}) => {
  const existing = tracker.records.get(pid);

  if (existing && existing.startId !== startId) {
    return false;
  }

  tracker.records.set(pid, {
    command,
    origin: existing?.origin ?? origin,
    pid,
    ppid,
    runId,
    startId,
    verifiedAt,
  });

  return true;
};

/**
 * @param {{
 *   readonly rootIdentity?: ProcessIdentity | null;
 *   readonly rootPid?: number | null;
 *   readonly runId: string;
 *   readonly now?: () => string;
 * }} input
 * @returns {OwnedProcessTracker}
 */
export const createOwnedTestProcessTracker = ({
  rootIdentity = null,
  rootPid = null,
  runId,
  now = () => new Date().toISOString(),
}) => {
  const tracker = {
    cleanupStarted: false,
    records: new Map(),
    rootIdentityVerified: false,
    rootPid: Number.isInteger(Number(rootPid)) ? Number(rootPid) : null,
    runId,
  };
  const normalizedRootIdentity = normalizeProcessIdentity(rootIdentity);

  if (
    tracker.rootPid !== null &&
    normalizedRootIdentity &&
    normalizedRootIdentity.pid === tracker.rootPid
  ) {
    tracker.rootIdentityVerified = upsertOwnedProcessRecord({
      command: normalizedRootIdentity.command ?? '',
      origin: 'spawned-root',
      pid: tracker.rootPid,
      ppid: null,
      runId,
      startId: normalizedRootIdentity.startId,
      tracker,
      verifiedAt: now(),
    });
  }

  return tracker;
};

export const ownedTestProcessRecords = (tracker) =>
  [...tracker.records.values()].sort((a, b) => b.pid - a.pid);

/**
 * @param {{
 *   readonly identityLookup: (pid: number) => ProcessIdentity | null;
 *   readonly processRows: readonly ProcessTableRow[];
 *   readonly tracker: OwnedProcessTracker;
 *   readonly now?: () => string;
 * }} input
 * @returns {{
 *   readonly discovered: number[];
 *   readonly recorded: number[];
 *   readonly skipped: Array<{ readonly pid: number; readonly reason: string }>;
 * }}
 */
export const recordOwnedTestProcessTree = ({
  identityLookup,
  processRows,
  tracker,
  now = () => new Date().toISOString(),
}) => {
  if (tracker.cleanupStarted) {
    return {
      discovered: [],
      recorded: ownedTestProcessRecords(tracker).map((record) => record.pid),
      skipped: [],
    };
  }

  const byParent = new Map();
  const rowsByPid = new Map();
  const discovered = [];
  const skipped = [];

  for (const row of processRows) {
    if (!byParent.has(row.ppid)) {
      byParent.set(row.ppid, []);
    }

    byParent.get(row.ppid).push(row);
    rowsByPid.set(row.pid, row);
  }

  const rootPid = tracker.rootPid;

  if (rootPid !== null && !tracker.rootIdentityVerified) {
    skipped.push({
      pid: rootPid,
      reason: 'root-identity-unverified',
    });
  }

  const rootRecord =
    rootPid === null ? null : (tracker.records.get(rootPid) ?? null);
  let rootIsCurrent = false;

  if (rootRecord) {
    try {
      rootIsCurrent = processIdentityMatches(
        rootRecord,
        identityLookup(rootPid),
      );
    } catch (error) {
      skipped.push({
        pid: rootPid,
        reason: `identity-unavailable:${toErrorMessage(error)}`,
      });
    }
  }
  const queue = rootIsCurrent ? [rootPid] : [];
  const verifiedParents = new Set(queue);

  while (queue.length > 0) {
    const parentPid = queue.shift();
    const children = byParent.get(parentPid) ?? [];

    for (const child of children) {
      if (verifiedParents.has(child.pid)) {
        continue;
      }

      let childIdentity = null;

      try {
        childIdentity = normalizeProcessIdentity(identityLookup(child.pid));
      } catch (error) {
        skipped.push({
          pid: child.pid,
          reason: `identity-unavailable:${toErrorMessage(error)}`,
        });
        continue;
      }

      if (!childIdentity || childIdentity.pid !== child.pid) {
        skipped.push({
          pid: child.pid,
          reason: 'identity-unverified',
        });
        continue;
      }

      const wasRecorded = tracker.records.has(child.pid);

      if (
        upsertOwnedProcessRecord({
          command: child.command,
          origin: 'verified-descendant',
          pid: child.pid,
          ppid: child.ppid,
          runId: tracker.runId,
          startId: childIdentity.startId,
          tracker,
          verifiedAt: now(),
        })
      ) {
        if (!wasRecorded) {
          discovered.push(child.pid);
        }

        verifiedParents.add(child.pid);
        queue.push(child.pid);
      }
    }
  }

  return {
    discovered: discovered.sort((a, b) => b - a),
    recorded: ownedTestProcessRecords(tracker).map((record) => record.pid),
    skipped,
  };
};

const emptySignalResults = () => ({
  exited: [],
  failed: [],
  sent: [],
  skipped: [],
});

const signalVerifiedProcessRecords = ({
  identityLookup,
  records,
  signal,
  signalProcess,
}) => {
  const results = emptySignalResults();
  const sentRecords = [];

  for (const record of records) {
    let currentIdentity = null;

    try {
      currentIdentity = normalizeProcessIdentity(identityLookup(record.pid));
    } catch (error) {
      results.skipped.push({
        error: toErrorMessage(error),
        pid: record.pid,
        reason: 'identity-unavailable',
        signal,
      });
      continue;
    }

    if (!currentIdentity) {
      results.exited.push({
        pid: record.pid,
        reason: 'not-running',
        signal,
      });
      continue;
    }

    if (!processIdentityMatches(record, currentIdentity)) {
      results.skipped.push({
        pid: record.pid,
        reason: 'identity-changed',
        signal,
      });
      continue;
    }

    try {
      signalProcess(record.pid, signal);
      results.sent.push({
        pid: record.pid,
        signal,
        status: 'sent',
      });
      sentRecords.push(record);
    } catch (error) {
      if (toErrorCode(error) === 'ESRCH') {
        results.exited.push({
          pid: record.pid,
          reason: 'not-running',
          signal,
        });
      } else {
        results.failed.push({
          error: toErrorMessage(error),
          pid: record.pid,
          signal,
        });
      }
    }
  }

  return {
    results,
    sentRecords,
  };
};

/**
 * @param {{
 *   readonly graceMs?: number;
 *   readonly identityLookup: (pid: number) => ProcessIdentity | null;
 *   readonly signalProcess?: (pid: number, signal: NodeJS.Signals | string) => void;
 *   readonly sleep?: (durationMs: number) => Promise<void>;
 *   readonly tracker: OwnedProcessTracker;
 * }} input
 */
export const cleanupOwnedTestProcesses = async ({
  graceMs = 750,
  identityLookup,
  signalProcess = process.kill,
  sleep = (durationMs) =>
    new Promise((resolveSleep) => {
      setTimeout(resolveSleep, durationMs);
    }),
  tracker,
}) => {
  if (tracker.cleanupStarted) {
    return {
      alreadyStarted: true,
      kill: emptySignalResults(),
      term: emptySignalResults(),
    };
  }

  tracker.cleanupStarted = true;

  if (tracker.rootPid !== null && !tracker.rootIdentityVerified) {
    const term = emptySignalResults();

    term.skipped.push({
      pid: tracker.rootPid,
      reason: 'root-identity-unverified',
      signal: 'SIGTERM',
    });

    return {
      alreadyStarted: false,
      kill: emptySignalResults(),
      term,
    };
  }

  const termAttempt = signalVerifiedProcessRecords({
    identityLookup,
    records: ownedTestProcessRecords(tracker),
    signal: 'SIGTERM',
    signalProcess,
  });

  if (termAttempt.sentRecords.length > 0) {
    await sleep(graceMs);
  }

  const killAttempt = signalVerifiedProcessRecords({
    identityLookup,
    records: termAttempt.sentRecords,
    signal: 'SIGKILL',
    signalProcess,
  });

  return {
    alreadyStarted: false,
    kill: killAttempt.results,
    term: termAttempt.results,
  };
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
