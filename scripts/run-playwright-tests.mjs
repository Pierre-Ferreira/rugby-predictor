import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  cleanupOwnedTestProcesses,
  createOwnedTestProcessTracker,
  createIsolatedTestEnvironment,
  ownedTestProcessRecords,
  parseProcessTable,
  parseLoopbackPort,
  readLinuxProcessIdentity,
  recordOwnedTestProcessTree,
} from './test-environment.mjs';

const port = parseLoopbackPort(process.env.PORT, 3200, 'Playwright test port');
const env = createIsolatedTestEnvironment({
  kind: 'e2e',
  localDir: '.meteor/local-playwright',
  port,
});
const evidenceDir = process.env.RUGBY_ROOSTER_E2E_EVIDENCE_DIR
  ? resolve(process.env.RUGBY_ROOSTER_E2E_EVIDENCE_DIR)
  : null;
const playwrightArgs = ['test', ...process.argv.slice(2)];

if (!evidenceDir) {
  const result = spawnSync('playwright', playwrightArgs, {
    env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
}

env.RUGBY_ROOSTER_E2E_EVIDENCE_DIR = evidenceDir;
mkdirSync(evidenceDir, { recursive: true });

const writeJson = (name, value) => {
  writeFileSync(
    `${evidenceDir}/${name}`,
    `${JSON.stringify(value, null, 2)}\n`,
  );
};

const appendJsonLine = (name, value) => {
  appendFileSync(`${evidenceDir}/${name}`, `${JSON.stringify(value)}\n`);
};

const utcNow = () => new Date().toISOString();

const relevantProcessPattern = new RegExp(
  [
    process.cwd().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    'local-playwright',
    'meteor',
    'mongod',
    'playwright',
    'rspack',
    String(port),
    String(port + 1),
    String(port + 2),
  ].join('|'),
);

const filteredProcessOutput = (stdout) =>
  stdout
    .split('\n')
    .filter((line, index) => index === 0 || relevantProcessPattern.test(line))
    .join('\n');

const commandOutput = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: process.env,
  });

  return {
    command: [command, ...args],
    error: result.error?.message,
    signal: result.signal,
    status: result.status,
    stderr: result.stderr,
    stdout: options.filterStdout
      ? filteredProcessOutput(result.stdout)
      : result.stdout,
  };
};

const sleep = (durationMs) =>
  new Promise((resolveSleep) => {
    setTimeout(resolveSleep, durationMs);
  });

const captureOwnershipSnapshot = (label) => {
  appendJsonLine('process-snapshots.jsonl', {
    label,
    ps: commandOutput('ps', ['-ef'], { filterStdout: true }),
    ss: commandOutput('ss', ['-ltnp']),
    time: utcNow(),
  });
};

const summarizeOwnedRecords = (tracker) =>
  ownedTestProcessRecords(tracker).map((record) => ({
    origin: record.origin,
    pid: record.pid,
    ppid: record.ppid,
    runId: record.runId,
    verifiedAt: record.verifiedAt,
  }));

let ownedProcessTracker = null;
let runIsActive = false;

const recordOwnedProcessTree = (label) => {
  if (!ownedProcessTracker || !runIsActive) {
    return;
  }

  const ps = commandOutput('ps', ['-eo', 'pid=,ppid=,command=']);

  appendJsonLine('process-events.jsonl', {
    event: 'owned-process-record-scan',
    label,
    status: ps.status,
    stderr: ps.stderr,
    time: utcNow(),
  });

  if (ps.status !== 0 || ps.error) {
    return;
  }

  const result = recordOwnedTestProcessTree({
    identityLookup: readLinuxProcessIdentity,
    processRows: parseProcessTable(ps.stdout),
    tracker: ownedProcessTracker,
  });

  appendJsonLine('process-events.jsonl', {
    event: 'owned-process-records',
    label,
    result,
    time: utcNow(),
  });
};

const captureAndRecordOwnershipSnapshot = (label) => {
  captureOwnershipSnapshot(label);
  recordOwnedProcessTree(label);
};

const cleanupOwnedProcesses = async () => {
  if (!ownedProcessTracker) {
    appendJsonLine('process-events.jsonl', {
      event: 'owned-process-cleanup-skipped',
      reason: 'no-owned-tracker',
      time: utcNow(),
    });

    return;
  }

  const records = summarizeOwnedRecords(ownedProcessTracker);

  appendJsonLine('process-events.jsonl', {
    event: 'owned-process-cleanup-start',
    records,
    time: utcNow(),
  });

  const result = await cleanupOwnedTestProcesses({
    identityLookup: readLinuxProcessIdentity,
    signalProcess: process.kill,
    sleep,
    tracker: ownedProcessTracker,
  });

  appendJsonLine('process-events.jsonl', {
    event: 'owned-process-cleanup-result',
    result,
    time: utcNow(),
  });
};

writeJson('launch-manifest.json', {
  command: ['playwright', ...playwrightArgs],
  cwd: process.cwd(),
  evidenceDir,
  launcherPid: process.pid,
  ports: {
    app: env.PORT,
    meteorManagedMongo: env.RUGBY_ROOSTER_TEST_MONGO_PORT,
    rspackDevServer: env.RSPACK_DEVSERVER_PORT,
  },
  runId: env.RUGBY_ROOSTER_TEST_RUN_ID,
  safeEnvironment: {
    METEOR_LOCAL_DIR: env.METEOR_LOCAL_DIR,
    NODE_ENV: env.NODE_ENV,
    PORT: env.PORT,
    ROOT_URL: env.ROOT_URL,
    RSPACK_DEVSERVER_PORT: env.RSPACK_DEVSERVER_PORT,
    RUGBY_ROOSTER_TEST_DATABASE_ID: env.RUGBY_ROOSTER_TEST_DATABASE_ID,
    RUGBY_ROOSTER_TEST_DATABASE_NAME: env.RUGBY_ROOSTER_TEST_DATABASE_NAME,
    RUGBY_ROOSTER_TEST_MODE: env.RUGBY_ROOSTER_TEST_MODE,
    RUGBY_ROOSTER_TEST_MONGO_HOST: env.RUGBY_ROOSTER_TEST_MONGO_HOST,
    RUGBY_ROOSTER_TEST_MONGO_PORT: env.RUGBY_ROOSTER_TEST_MONGO_PORT,
    RUGBY_ROOSTER_TEST_RUN_ID: env.RUGBY_ROOSTER_TEST_RUN_ID,
  },
  startTime: utcNow(),
});
captureAndRecordOwnershipSnapshot('before-playwright-spawn');

const startedAt = Date.now();
const child = spawn('playwright', playwrightArgs, {
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
runIsActive = true;

ownedProcessTracker = createOwnedTestProcessTracker({
  rootIdentity: child.pid ? readLinuxProcessIdentity(child.pid) : null,
  rootPid: child.pid,
  runId: env.RUGBY_ROOSTER_TEST_RUN_ID,
});

appendJsonLine('process-events.jsonl', {
  event: 'playwright-spawned',
  pid: child.pid,
  recordedOwnership: ownedProcessTracker
    ? summarizeOwnedRecords(ownedProcessTracker)
    : [],
  time: utcNow(),
});
captureAndRecordOwnershipSnapshot('after-playwright-spawn');

const recordOutput = (source, chunk) => {
  const text = chunk.toString();

  appendFileSync(`${evidenceDir}/playwright-${source}.log`, text);
  appendJsonLine('runner-output.jsonl', {
    source,
    text,
    time: utcNow(),
  });
};

child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  recordOutput('stdout', chunk);
});

child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
  recordOutput('stderr', chunk);
});

child.on('error', (error) => {
  appendJsonLine('process-events.jsonl', {
    event: 'playwright-error',
    message: error.message,
    time: utcNow(),
  });
});

const ownershipInterval = setInterval(() => {
  captureAndRecordOwnershipSnapshot('during-playwright-run');
}, 2_000);

child.on('close', async (code, signal) => {
  clearInterval(ownershipInterval);
  runIsActive = false;
  captureOwnershipSnapshot('after-playwright-close');
  writeJson('exit.json', {
    code,
    durationMs: Date.now() - startedAt,
    signal,
    time: utcNow(),
  });
  appendJsonLine('process-events.jsonl', {
    code,
    event: 'playwright-closed',
    signal,
    time: utcNow(),
  });

  await cleanupOwnedProcesses();
  captureOwnershipSnapshot('after-owned-process-cleanup');

  process.exit(code ?? 1);
});
