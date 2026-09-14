const DEFAULT_TEST_PORT = 3200;
const LOCAL_TEST_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

type PlaywrightTargetEnv = {
  PLAYWRIGHT_BASE_URL?: string;
  PORT?: string;
};

export type PlaywrightTarget = {
  baseURL: string;
  shouldStartWebServer: boolean;
  testPort: number;
};

const normalizeBaseURL = (value: string) => value.replace(/\/$/, '');

const parseTestPort = (value: string | undefined) => {
  const port = Number(value ?? DEFAULT_TEST_PORT);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid Playwright test port "${value ?? DEFAULT_TEST_PORT}". Use a port from 1 to 65535.`,
    );
  }

  return port;
};

const parseBaseURL = (rawBaseURL: string) => {
  try {
    return new URL(rawBaseURL);
  } catch {
    throw new Error(`Invalid PLAYWRIGHT_BASE_URL "${rawBaseURL}".`);
  }
};

export const resolvePlaywrightTarget = (
  env: PlaywrightTargetEnv = process.env,
): PlaywrightTarget => {
  const testPort = parseTestPort(env.PORT);
  const shouldStartWebServer = !env.PLAYWRIGHT_BASE_URL;
  const rawBaseURL = env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${testPort}`;
  const parsedBaseURL = parseBaseURL(rawBaseURL);

  if (!['http:', 'https:'].includes(parsedBaseURL.protocol)) {
    throw new Error('Playwright tests require an HTTP or HTTPS base URL.');
  }

  if (!LOCAL_TEST_HOSTS.has(parsedBaseURL.hostname)) {
    throw new Error(
      `Refusing to run Playwright tests against non-local host "${parsedBaseURL.hostname}". Use a loopback URL such as http://127.0.0.1:${testPort}.`,
    );
  }

  return {
    baseURL: normalizeBaseURL(parsedBaseURL.toString()),
    shouldStartWebServer,
    testPort,
  };
};
