import { spawnSync } from 'node:child_process';
import {
  createIsolatedTestEnvironment,
  parseLoopbackPort,
} from './test-environment.mjs';

const port = parseLoopbackPort(process.env.PORT, 3200, 'Playwright test port');
const env = createIsolatedTestEnvironment({
  kind: 'e2e',
  localDir: '.meteor/local-playwright',
  port,
});

const result = spawnSync('playwright', ['test', ...process.argv.slice(2)], {
  env,
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
