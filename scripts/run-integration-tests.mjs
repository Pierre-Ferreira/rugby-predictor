import { spawnSync } from 'node:child_process';
import {
  createIsolatedTestEnvironment,
  parseLoopbackPort,
} from './test-environment.mjs';

const port = parseLoopbackPort(
  process.env.INTEGRATION_TEST_PORT ?? process.env.PORT,
  3400,
  'Integration test port',
);
const env = createIsolatedTestEnvironment({
  kind: 'integration',
  localDir: '.meteor/local-integration',
  port,
});

const result = spawnSync(
  'meteor',
  [
    'test',
    '--full-app',
    '--once',
    '--driver-package',
    'meteortesting:mocha',
    '--port',
    `127.0.0.1:${port}`,
    '--settings',
    'tests/settings/integration-settings.json',
  ],
  {
    env,
    stdio: 'inherit',
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
