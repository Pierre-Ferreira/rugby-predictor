import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, type Page, test, type TestInfo } from '@playwright/test';

import { TEST_AUTH_METHODS } from '../../imports/shared/auth/methods';
import { TEST_FIXTURE_METHODS } from '../../imports/shared/fixtures';
import { defaultFixturePredictionQuestionConfig } from '../../imports/shared/predictionQuestions';
import {
  TEST_PREDICTION_METHODS,
  type PredictionEntryDocument,
} from '../../imports/shared/predictions';
import type { KaplayMatchResultDebugLayout } from '../../imports/ui/predictions/kaplay/matchResultRuntime';
import { readKaplayMatchResultSelectedValue } from '../support/kaplay-layout-evidence';

const NAVIGATION_ATTEMPT_TIMEOUT_MS = 15_000;
const SCREENSHOT_CAPTURE_TIMEOUT_MS = 5_000;
const animationPreferenceStorageKey = 'rugby-rooster:prediction-animations';
const evidenceDir = process.env.RUGBY_ROOSTER_E2E_EVIDENCE_DIR;
const evidenceCollectors = new WeakMap<Page, BrowserEvidenceCollector>();

type BrowserEvidenceEntry = Record<string, unknown>;

interface BrowserEvidenceCollector {
  readonly mark: (label: string, details?: BrowserEvidenceEntry) => void;
  readonly write: () => Promise<void>;
}

const utcNow = () => new Date().toISOString();

const truncateText = (value: string, maxLength = 1_000) =>
  value.length > maxLength
    ? `${value.slice(0, maxLength)}...[truncated]`
    : value;

const sanitizeUrl = (rawUrl: string | null | undefined) => {
  if (!rawUrl) {
    return null;
  }

  try {
    const url = new URL(rawUrl);
    const path = url.pathname.replace(
      /\/sockjs\/[^/]+\/[^/]+/g,
      '/sockjs/[server]/[session]',
    );
    const query = url.search ? '?[query]' : '';

    return `${url.protocol}//${url.host}${path}${query}`;
  } catch {
    return rawUrl.replace(
      /\/sockjs\/[^/\s]+\/[^/\s]+/g,
      '/sockjs/[server]/[session]',
    );
  }
};

const sanitizeText = (value: string) =>
  truncateText(
    value
      .replace(/https?:\/\/[^\s'")]+/g, (match) => sanitizeUrl(match) ?? match)
      .replace(/wss?:\/\/[^\s'")]+/g, (match) => sanitizeUrl(match) ?? match),
  );

const safeFileSegment = (value: string) =>
  value
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 120);

const isRelevantErrorResponse = (url: string, status: number) =>
  status >= 400 &&
  (url.includes('/__rspack__/') ||
    url.includes('/build-chunks') ||
    url.includes('/sockjs/'));

const installBrowserEvidence = (
  page: Page,
  testInfo: TestInfo,
): BrowserEvidenceCollector => {
  const requests: BrowserEvidenceEntry[] = [];
  const responses: BrowserEvidenceEntry[] = [];
  const failedRequests: BrowserEvidenceEntry[] = [];
  const consoleMessages: BrowserEvidenceEntry[] = [];
  const pageErrors: BrowserEvidenceEntry[] = [];
  const navigations: BrowserEvidenceEntry[] = [];
  const stages: BrowserEvidenceEntry[] = [];
  const responseBodyExcerpts: BrowserEvidenceEntry[] = [];
  const pendingResponseReads: Promise<void>[] = [];

  const collector: BrowserEvidenceCollector = {
    mark: (label, details = {}) => {
      stages.push({
        details,
        label,
        time: utcNow(),
      });
    },
    write: async () => {
      await Promise.allSettled(pendingResponseReads);

      if (!evidenceDir) {
        return;
      }

      const browserDir = join(evidenceDir, 'browser');
      mkdirSync(browserDir, { recursive: true });
      writeFileSync(
        join(
          browserDir,
          `${safeFileSegment(testInfo.titlePath.join(' '))}-retry-${testInfo.retry}.json`,
        ),
        `${JSON.stringify(
          {
            consoleMessages,
            failedRequests,
            navigations,
            pageErrors,
            requests,
            responseBodyExcerpts,
            responses,
            stages,
            status: testInfo.status,
            test: testInfo.titlePath,
          },
          null,
          2,
        )}\n`,
      );
    },
  };

  page.on('request', (request) => {
    requests.push({
      method: request.method(),
      redirectedFrom: sanitizeUrl(request.redirectedFrom()?.url()),
      resourceType: request.resourceType(),
      time: utcNow(),
      url: sanitizeUrl(request.url()),
    });
  });

  page.on('response', (response) => {
    const request = response.request();
    const entry = {
      method: request.method(),
      redirectedFrom: sanitizeUrl(request.redirectedFrom()?.url()),
      redirectedTo: sanitizeUrl(request.redirectedTo()?.url()),
      resourceType: request.resourceType(),
      status: response.status(),
      statusText: response.statusText(),
      time: utcNow(),
      url: sanitizeUrl(response.url()),
    };

    responses.push(entry);

    if (isRelevantErrorResponse(response.url(), response.status())) {
      pendingResponseReads.push(
        response
          .text()
          .then((body) => {
            responseBodyExcerpts.push({
              body: truncateText(body, 500),
              status: response.status(),
              time: utcNow(),
              url: sanitizeUrl(response.url()),
            });
          })
          .catch((error: unknown) => {
            responseBodyExcerpts.push({
              error: errorMessage(error),
              status: response.status(),
              time: utcNow(),
              url: sanitizeUrl(response.url()),
            });
          }),
      );
    }
  });

  page.on('requestfailed', (request) => {
    failedRequests.push({
      failure: request.failure()?.errorText ?? null,
      method: request.method(),
      resourceType: request.resourceType(),
      time: utcNow(),
      url: sanitizeUrl(request.url()),
    });
  });

  page.on('console', (message) => {
    consoleMessages.push({
      location: {
        column: message.location().columnNumber,
        line: message.location().lineNumber,
        url: sanitizeUrl(message.location().url),
      },
      text: sanitizeText(message.text()),
      time: utcNow(),
      type: message.type(),
    });
  });

  page.on('pageerror', (error) => {
    pageErrors.push({
      message: sanitizeText(error.message),
      time: utcNow(),
    });
  });

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      navigations.push({
        time: utcNow(),
        url: sanitizeUrl(frame.url()),
      });
    }
  });

  return collector;
};

const markStage = (
  page: Page,
  label: string,
  details?: BrowserEvidenceEntry,
) => {
  evidenceCollectors.get(page)?.mark(label, details);
};

const evidenceScreenshotPath = (name: string) => {
  if (!evidenceDir) {
    return `test-results/ccpp009c3/${name}`;
  }

  const screenshotDir = join(evidenceDir, 'browser-screenshots');
  mkdirSync(screenshotDir, { recursive: true });

  return join(screenshotDir, name);
};

const evidenceArtifactPath = (name: string) => {
  if (!evidenceDir) {
    mkdirSync('test-results/ccpp009c3', { recursive: true });
    return `test-results/ccpp009c3/${name}`;
  }

  const artifactDir = join(evidenceDir, 'browser-artifacts');
  mkdirSync(artifactDir, { recursive: true });

  return join(artifactDir, name);
};

const uniqueEmail = (label: string) =>
  `ccpp009c3-e2e-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;

const uniqueLabel = (label: string) =>
  `${label} ${Date.now().toString(36)}${Math.random().toString(16).slice(2, 6)}`;

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const message = (error as { readonly message?: unknown }).message;

    if (typeof message === 'string') {
      return message;
    }
  }

  return String(error);
};

const isTransientLocalNavigationError = (error: unknown) => {
  const message = errorMessage(error);

  return (
    message.includes('net::ERR_ABORTED') ||
    message.includes('interrupted by another navigation') ||
    message.includes('Timeout') ||
    message.includes('Execution context was destroyed') ||
    message.includes("Cannot read properties of undefined (reading 'call')")
  );
};

const waitForMeteorClient = async (page: Page) => {
  await page.waitForFunction(
    () => typeof window.Meteor?.call === 'function',
    undefined,
    {
      timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS,
    },
  );
};

const waitForReactAppMount = async (page: Page) => {
  await page.waitForFunction(
    () => (document.querySelector('#react-target')?.childElementCount ?? 0) > 0,
    undefined,
    {
      timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS,
    },
  );
};

const blockMeteorHmrHotCodePush = async (page: Page) => {
  await page.routeWebSocket(
    (url) => url.pathname === '/__meteor__hmr__/websocket',
    async (webSocket) => {
      await webSocket.close({
        code: 1000,
        reason: 'Meteor HMR disabled for deterministic isolated E2E.',
      });
    },
  );
};

const evaluateMeteorCall = async <TResult>(
  page: Page,
  method: string,
  ...args: readonly unknown[]
): Promise<TResult> =>
  page.evaluate(
    ({ methodName, methodArgs }) =>
      new Promise((resolve, reject) => {
        window.Meteor.call(methodName, ...methodArgs, (error, result) => {
          if (error) {
            reject({
              error: error.error,
              message: error.message,
              reason: error.reason,
            });
            return;
          }

          resolve(result as TResult);
        });
      }),
    { methodArgs: args, methodName: method },
  ) as Promise<TResult>;

const callMeteor = async <TResult>(
  page: Page,
  method: string,
  ...args: readonly unknown[]
): Promise<TResult> => {
  try {
    return await evaluateMeteorCall<TResult>(page, method, ...args);
  } catch (error) {
    if (isTransientLocalNavigationError(error)) {
      await waitForMeteorClient(page);
      return evaluateMeteorCall<TResult>(page, method, ...args);
    }

    throw error;
  }
};

const gotoLocal = async (page: Page, url: string) => {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(url, {
        timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS,
        waitUntil: 'domcontentloaded',
      });
      await waitForMeteorClient(page);
      await waitForReactAppMount(page);
      return;
    } catch (error) {
      lastError = error;

      if (!isTransientLocalNavigationError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
};

const resetTestData = async (page: Page) => {
  await gotoLocal(page, '/');
  const environment = await callMeteor<{
    readonly appUrl: string;
    readonly runId: string;
  }>(page, TEST_AUTH_METHODS.environment);

  expect(environment.appUrl).toMatch(/^http:\/\/127\.0\.0\.1:/);
  expect(environment.runId).toBe(process.env.RUGBY_ROOSTER_TEST_RUN_ID);
  await callMeteor(page, TEST_PREDICTION_METHODS.reset);
  await callMeteor(page, TEST_FIXTURE_METHODS.reset);
  await callMeteor(page, TEST_AUTH_METHODS.reset);
  await gotoLocal(page, '/');
};

const loginWithTestToken = async (page: Page, email: string) => {
  const session = await callMeteor<{
    readonly token: string;
    readonly userId: string;
  }>(page, TEST_AUTH_METHODS.loginTokenForEmail, email);

  await page.evaluate(
    (token) =>
      new Promise<void>((resolve, reject) => {
        window.Meteor.loginWithToken(token, (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
    session.token,
  );
};

const loginAsPlayer = async (page: Page, label: string) => {
  const email = uniqueEmail(label);

  await callMeteor(page, TEST_AUTH_METHODS.createVerifiedUser, email);
  await loginWithTestToken(page, email);
};

const createPublishedFixture = async (
  page: Page,
  details: {
    readonly competitionDisplayName: string;
    readonly scheduledKickoffAt: string;
    readonly team1DisplayName: string;
    readonly team2DisplayName: string;
  },
) =>
  callMeteor<{ readonly fixtureId: string }>(
    page,
    TEST_FIXTURE_METHODS.createPublished,
    {
      details,
    },
  );

const createPublishedCustomFixture = async (
  setupPage: Page,
  details: {
    readonly competitionDisplayName: string;
    readonly scheduledKickoffAt: string;
    readonly team1DisplayName: string;
    readonly team2DisplayName: string;
  },
) => {
  const defaultConfig = defaultFixturePredictionQuestionConfig();

  return callMeteor<{ readonly fixtureId: string }>(
    setupPage,
    TEST_FIXTURE_METHODS.createPublished,
    {
      details,
      questionConfig: {
        ...defaultConfig,
        optionalStandardQuestions: defaultConfig.optionalStandardQuestions.map(
          (question) =>
            question.id === 'first-try'
              ? {
                  ...question,
                  enabled: false,
                }
              : question,
        ),
        customQuestions: [
          {
            answerType: 'number' as const,
            banter: 'Set-piece heat check.',
            countingDefinition:
              'Scrum penalties awarded against Team 2 during regulation match time.',
            deductionPerUnit: 25,
            id: 'scrum-pressure',
            max: 12,
            min: 0,
            order: 1,
            prompt: 'How many scrum penalties will Team 2 concede?',
          },
          {
            answerType: 'choice' as const,
            countingDefinition:
              'The official player of the match positional group announced after full-time.',
            id: 'player-band',
            incorrectDeduction: 75,
            options: [
              { id: 'backs', label: 'Backs' },
              { id: 'forwards', label: 'Forwards' },
            ],
            order: 2,
            prompt: 'Which group produces the player of the match?',
          },
        ],
      },
    },
  );
};

const farFutureKickoff = () =>
  new Date(Date.UTC(2098, 5, 1, 12, 0, 0)).toISOString();

const predictionPath = (fixtureId: string) => `/games/${fixtureId}/predict`;

const startPrediction = async (page: Page) => {
  await page.getByRole('button', { name: "Let's predict" }).click();
};

const continueButton = (page: Page) =>
  page.getByRole('button', { exact: true, name: 'Continue' });

const chooseVisibleRadio = async (page: Page, name: string) => {
  const radio = page.getByRole('radio', { exact: true, name });

  await expect(radio).toBeVisible();
  await radio.check();
};

const teamNumberInput = (page: Page, teamName: string, fieldName: string) =>
  page.getByRole('spinbutton', { name: `${teamName} ${fieldName}` });

const reviewSection = (page: Page, label: string) =>
  page.getByRole('group', { name: `Review ${label}` });

const expectStep = async (page: Page, current: number, total = 9) => {
  await expect(page.getByText(`Step ${current} of ${total}`)).toBeVisible({
    timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS,
  });
};

const saveRevisedPredictionButton = (page: Page) =>
  page.getByRole('button', { name: 'Save revised prediction' });

const animationsButton = (page: Page, name: 'Off' | 'On') =>
  page.getByRole('button', { exact: true, name });

const waitForKaplayReady = async (page: Page) => {
  markStage(page, 'kaplay-ready:wait-start');
  await expect(page.getByTestId('kaplay-match-result-stage')).toBeVisible({
    timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS,
  });
  await expect(page.getByText('Loading animation preview.')).toHaveCount(0);
  await expect(page.getByTestId('kaplay-match-result-canvas')).toBeVisible();
  markStage(page, 'kaplay-ready:success');
};

const waitForKaplayDebugLayout = async (page: Page) => {
  await page.waitForFunction(
    () => {
      const layout = window.__RUGBY_ROOSTER_KAPLAY_LAST_LAYOUT__;

      return (
        Boolean(layout) &&
        Array.isArray(layout?.choices) &&
        layout.choices.length > 0 &&
        layout.synchronized === true &&
        layout.viewport.renderedContentBounds !== null &&
        layout.viewport.engine.width === layout.stage.width &&
        layout.viewport.engine.height === layout.stage.height
      );
    },
    undefined,
    { timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS },
  );
};

const waitForHitTestableChoices = async (page: Page) => {
  await waitForKaplayDebugLayout(page);
  await page.waitForFunction(
    () => {
      const layout = window.__RUGBY_ROOSTER_KAPLAY_LAST_LAYOUT__;

      return (
        layout?.synchronized === true &&
        layout.selectedChoice === null &&
        layout.choices.length === 3 &&
        layout.choices.every((choice) => choice.hitTestable)
      );
    },
    undefined,
    { timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS },
  );
};

const retryIfAnimationFailureIsVisible = async (page: Page) => {
  const retryButton = page.getByRole('button', { name: 'Retry animations' });

  if (
    await retryButton
      .isVisible({
        timeout: 1_000,
      })
      .catch(() => false)
  ) {
    await retryButton.click();
  }
};

const clickCanvasChoice = async (page: Page, choiceIndex: 0 | 1 | 2) => {
  const canvas = page.getByTestId('kaplay-match-result-canvas');
  const box = await canvas.boundingBox();

  if (!box) {
    throw new Error('Kaplay canvas is not visible.');
  }

  await waitForKaplayDebugLayout(page);
  const choice = await page.evaluate((index) => {
    const layout = window.__RUGBY_ROOSTER_KAPLAY_LAST_LAYOUT__;
    const projectedChoice = layout?.choices[index];

    if (!layout || !projectedChoice) {
      throw new Error('Kaplay choice layout is not available.');
    }

    if (!projectedChoice.hitTestable) {
      throw new Error('Kaplay choice layout is not currently hit-testable.');
    }

    return {
      centerX: projectedChoice.rect.x + projectedChoice.rect.width / 2,
      centerY: projectedChoice.rect.y + projectedChoice.rect.height / 2,
      content: layout.viewport.renderedContentBounds,
      stageHeight: layout.stage.height,
      stageWidth: layout.stage.width,
    };
  }, choiceIndex);

  if (!choice.content) {
    throw new Error('Kaplay rendered content bounds are not available.');
  }

  await canvas.click({
    position: {
      x:
        choice.content.x +
        (choice.centerX / choice.stageWidth) * choice.content.width,
      y:
        choice.content.y +
        (choice.centerY / choice.stageHeight) * choice.content.height,
    },
  });
};

const collectKaplayLayoutEvidence = async (page: Page, label: string) => {
  markStage(page, 'kaplay-layout-evidence:scene-readiness-start', { label });
  await waitForKaplayDebugLayout(page);
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        '[data-testid="kaplay-match-result-canvas"]',
      );
      const layout = window.__RUGBY_ROOSTER_KAPLAY_LAST_LAYOUT__;

      if (!canvas || !layout) {
        return false;
      }

      return (
        layout.synchronized === true &&
        layout.viewport.renderedContentBounds !== null &&
        layout.viewport.engine.width === layout.stage.width &&
        layout.viewport.engine.height === layout.stage.height &&
        Math.abs(
          layout.displayScale -
            layout.viewport.renderedContentBounds.width / layout.stage.width,
        ) < 0.01
      );
    },
    undefined,
    { timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS },
  );
  markStage(page, 'kaplay-layout-evidence:scene-readiness-success', { label });
  const canvas = page.getByTestId('kaplay-match-result-canvas');
  const box = await canvas.boundingBox();

  if (!box) {
    throw new Error('Kaplay canvas is not visible for layout evidence.');
  }

  const layout = await page.evaluate(() => {
    const currentLayout = window.__RUGBY_ROOSTER_KAPLAY_LAST_LAYOUT__;

    if (!currentLayout) {
      throw new Error('Kaplay layout evidence is not available.');
    }

    return currentLayout;
  });
  markStage(page, 'kaplay-layout-evidence:optional-selection-read-start', {
    label,
  });
  const selectedValue = await readKaplayMatchResultSelectedValue(page, {
    timeoutMs: NAVIGATION_ATTEMPT_TIMEOUT_MS,
  });
  markStage(page, 'kaplay-layout-evidence:optional-selection-read-success', {
    label,
    selectedValue,
  });

  return {
    canvasCss: {
      height: box.height,
      width: box.width,
    },
    label,
    layout,
    measuredAt: utcNow(),
    selectedValue,
    viewport: page.viewportSize(),
  };
};

const writeEvidenceJson = (name: string, value: unknown) => {
  writeFileSync(
    evidenceArtifactPath(name),
    `${JSON.stringify(value, null, 2)}\n`,
  );
};

const writePngDataUrl = (name: string, dataUrl: string) => {
  const encoded = dataUrl.replace(/^data:image\/png;base64,/, '');

  writeFileSync(evidenceScreenshotPath(name), Buffer.from(encoded, 'base64'));
};

const captureCanvasBitmap = async (page: Page, name: string) => {
  markStage(page, 'canvas-bitmap-capture:start', { name });
  const canvas = page.getByTestId('kaplay-match-result-canvas');

  try {
    await expect(canvas).toBeVisible({
      timeout: SCREENSHOT_CAPTURE_TIMEOUT_MS,
    });

    const dataUrl = await canvas.evaluate(
      (node: HTMLCanvasElement) => node.toDataURL('image/png'),
      undefined,
      {
        timeout: SCREENSHOT_CAPTURE_TIMEOUT_MS,
      },
    );

    writePngDataUrl(name, dataUrl);
    markStage(page, 'canvas-bitmap-capture:end', { name });
  } catch (error) {
    markStage(page, 'canvas-bitmap-capture:failed', {
      error: errorMessage(error),
      name,
    });
    throw error;
  }
};

const startCanvasRecording = async (page: Page) => {
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-testid="kaplay-match-result-canvas"]',
    );

    if (!canvas) {
      throw new Error('Kaplay canvas is not available for recording.');
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : 'video/webm';
    const stream = canvas.captureStream(60);
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    const started = new Promise<void>((resolve, reject) => {
      recorder.addEventListener(
        'error',
        () => {
          reject(new Error('Kaplay canvas recording failed to start.'));
        },
        { once: true },
      );
      recorder.addEventListener('start', () => resolve(), { once: true });
    });
    const finished = new Promise<{
      readonly base64: string;
      readonly mimeType: string;
    }>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      recorder.onerror = () => {
        reject(new Error('Kaplay canvas recording failed.'));
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const reader = new FileReader();

        reader.onerror = () => reject(new Error('Recording read failed.'));
        reader.onloadend = () => {
          const result = String(reader.result ?? '');
          const base64 = result.includes(',') ? result.split(',')[1] : '';

          resolve({ base64, mimeType });
        };
        reader.readAsDataURL(blob);
      };
    });

    (
      window as unknown as {
        __RUGBY_ROOSTER_CANVAS_RECORDING__?: {
          readonly finished: Promise<{
            readonly base64: string;
            readonly mimeType: string;
          }>;
          readonly recorder: MediaRecorder;
          readonly started: Promise<void>;
          readonly stream: MediaStream;
        };
      }
    ).__RUGBY_ROOSTER_CANVAS_RECORDING__ = {
      finished,
      recorder,
      started,
      stream,
    };

    recorder.start(100);
  });

  await page.evaluate(() => {
    const holder = (
      window as unknown as {
        __RUGBY_ROOSTER_CANVAS_RECORDING__?: {
          readonly recorder: MediaRecorder;
          readonly started: Promise<void>;
        };
      }
    ).__RUGBY_ROOSTER_CANVAS_RECORDING__;

    if (!holder) {
      throw new Error('No Kaplay canvas recording was created.');
    }

    return holder.started.then(() => {
      if (holder.recorder.state !== 'recording') {
        throw new Error('Kaplay canvas recorder is not recording.');
      }
    });
  });
};

const stopCanvasRecording = async (page: Page, name: string) => {
  const result = await page.evaluate(
    () =>
      new Promise<{
        readonly base64: string;
        readonly mimeType: string;
      }>((resolve, reject) => {
        const holder = (
          window as unknown as {
            __RUGBY_ROOSTER_CANVAS_RECORDING__?: {
              readonly finished: Promise<{
                readonly base64: string;
                readonly mimeType: string;
              }>;
              readonly recorder: MediaRecorder;
              readonly started: Promise<void>;
              readonly stream: MediaStream;
            };
          }
        ).__RUGBY_ROOSTER_CANVAS_RECORDING__;

        if (!holder) {
          reject(new Error('No Kaplay canvas recording is active.'));
          return;
        }

        holder.finished.then(resolve, reject).finally(() => {
          holder.stream.getTracks().forEach((track) => track.stop());
          delete (
            window as unknown as {
              __RUGBY_ROOSTER_CANVAS_RECORDING__?: unknown;
            }
          ).__RUGBY_ROOSTER_CANVAS_RECORDING__;
        });

        if (holder.recorder.state === 'recording') {
          holder.recorder.requestData();
          holder.recorder.stop();
        } else {
          reject(new Error('Kaplay canvas recorder was not recording.'));
        }
      }),
  );

  expect(result.mimeType).toContain('video/webm');
  expect(Buffer.from(result.base64, 'base64').byteLength).toBeGreaterThan(0);
  writeFileSync(
    evidenceArtifactPath(name),
    Buffer.from(result.base64, 'base64'),
  );
};

const createEditablePredictionFixture = async (
  page: Page,
  label: string,
  teams?: {
    readonly team1: string;
    readonly team2: string;
  },
) => {
  const team1 = teams?.team1 ?? uniqueLabel('Springboks Preview');
  const team2 = teams?.team2 ?? uniqueLabel('All Blacks Preview');
  const fixtureId = (
    await createPublishedFixture(page, {
      competitionDisplayName: `${label} Cup`,
      scheduledKickoffAt: farFutureKickoff(),
      team1DisplayName: team1,
      team2DisplayName: team2,
    })
  ).fixtureId;

  await loginAsPlayer(page, label);
  await gotoLocal(page, predictionPath(fixtureId));

  return {
    fixtureId,
    team1,
    team2,
  };
};

const createPredictionAtMatchResult = async (
  page: Page,
  label: string,
  teams?: {
    readonly team1: string;
    readonly team2: string;
  },
  options: {
    readonly beforeStart?: () => Promise<void>;
    readonly storedAnimationPreference?: 'off' | 'on';
  } = {},
) => {
  const fixture = await createEditablePredictionFixture(page, label, teams);

  if (options.storedAnimationPreference) {
    await page.evaluate(
      ({ key, preference }) => {
        window.localStorage.setItem(key, preference);
      },
      {
        key: animationPreferenceStorageKey,
        preference: options.storedAnimationPreference,
      },
    );
  }

  await options.beforeStart?.();
  await startPrediction(page);
  await expect(page.getByText('Step 1 of 9')).toBeVisible();

  return fixture;
};

const currentUserPredictionEntry = async (page: Page, fixtureId: string) =>
  callMeteor<PredictionEntryDocument | null>(
    page,
    TEST_PREDICTION_METHODS.currentUserEntry,
    fixtureId,
  );

const fillValidCustomSequentialPrediction = async (
  page: Page,
  teams: {
    readonly team1: string;
    readonly team2: string;
  },
  custom: {
    readonly choiceLabel: string;
    readonly numberPrompt: string;
    readonly numberValue: string;
  },
) => {
  await startPrediction(page);
  await waitForKaplayReady(page);
  await clickCanvasChoice(page, 0);
  await expect(page.getByTestId('kaplay-match-result-picked')).toContainText(
    `You picked ${teams.team1}`,
  );
  await expect(
    page.getByRole('radio', { exact: true, name: teams.team1 }),
  ).toHaveAttribute('aria-checked', 'true');
  await continueButton(page).click();

  await teamNumberInput(page, teams.team1, 'tries').fill('2');
  await teamNumberInput(page, teams.team2, 'tries').fill('1');
  await continueButton(page).click();

  await teamNumberInput(page, teams.team1, 'conversions').fill('2');
  await teamNumberInput(page, teams.team2, 'conversions').fill('1');
  await continueButton(page).click();

  await teamNumberInput(page, teams.team1, 'penalty kicks').fill('1');
  await teamNumberInput(page, teams.team2, 'penalty kicks').fill('1');
  await continueButton(page).click();

  await teamNumberInput(page, teams.team1, 'drop goals').fill('0');
  await teamNumberInput(page, teams.team2, 'drop goals').fill('0');
  await continueButton(page).click();

  await teamNumberInput(page, teams.team1, 'yellow cards').fill('1');
  await teamNumberInput(page, teams.team1, 'red cards').fill('0');
  await teamNumberInput(page, teams.team2, 'yellow cards').fill('0');
  await teamNumberInput(page, teams.team2, 'red cards').fill('0');
  await continueButton(page).click();

  await chooseVisibleRadio(page, 'Second Half');
  await continueButton(page).click();

  await chooseVisibleRadio(page, teams.team1);
  await continueButton(page).click();

  await page
    .getByRole('spinbutton', { name: `${custom.numberPrompt} answer` })
    .fill(custom.numberValue);
  await continueButton(page).click();

  await chooseVisibleRadio(page, custom.choiceLabel);
  await page.getByRole('button', { name: 'Review predictions' }).click();
};

declare global {
  interface Window {
    __rugbyRoosterKaplayPreviewSpecMarker__?: true;
  }
}

const createMainFrameNavigationProbe = (page: Page) => {
  let armed = false;
  const urls: string[] = [];

  page.on('framenavigated', (frame) => {
    if (armed && frame === page.mainFrame()) {
      urls.push(frame.url());
    }
  });

  return {
    arm: () => {
      armed = true;
    },
    urls: () => [...urls],
  };
};

test.describe('Kaplay prediction preview', () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }, testInfo) => {
    if (evidenceDir) {
      evidenceCollectors.set(page, installBrowserEvidence(page, testInfo));
      markStage(page, 'beforeEach:evidence-installed');
    }

    await blockMeteorHmrHotCodePush(page);
    markStage(page, 'beforeEach:hmr-websocket-route-installed');
    await resetTestData(page);
    markStage(page, 'beforeEach:test-data-reset');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    markStage(page, 'beforeEach:reduced-motion-no-preference');
  });

  test.afterEach(async ({ page }) => {
    await evidenceCollectors.get(page)?.write();
  });

  test('opens real Match Result Kaplay automatically in development without preview enablement', async ({
    page,
  }) => {
    const { team1, team2 } = await createEditablePredictionFixture(
      page,
      'kaplay-default-access',
    );

    await expect(
      page.getByText('Standard prediction', { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('kaplay-match-result-stage')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(
          (key) => window.localStorage.getItem(key),
          animationPreferenceStorageKey,
        ),
      )
      .toBeNull();
    await expect
      .poll(() =>
        page.evaluate(() => window.__RUGBY_ROOSTER_KAPLAY_IMPORT_COUNT__ ?? 0),
      )
      .toBe(0);

    markStage(page, 'default-access:start-prediction');
    await startPrediction(page);
    await expect(page.getByText('Step 1 of 9')).toBeVisible();
    await waitForKaplayReady(page);
    await page.screenshot({
      fullPage: true,
      path: evidenceScreenshotPath('desktop-default-match-result-preview.png'),
      timeout: SCREENSHOT_CAPTURE_TIMEOUT_MS,
    });

    markStage(page, 'default-access:canvas-choice-click');
    await startCanvasRecording(page);
    await page.waitForTimeout(300);
    await clickCanvasChoice(page, 1);
    await expect(page.getByTestId('kaplay-match-result-picked')).toContainText(
      `You picked ${team2}`,
    );
    await page.waitForTimeout(2_000);
    await stopCanvasRecording(page, 'match-result-shove-normal-speed.webm');
    await expect(
      page.getByRole('radio', { name: team2, exact: true }),
    ).toHaveAttribute('aria-checked', 'true');
    await page.screenshot({
      fullPage: true,
      path: evidenceScreenshotPath('desktop-default-match-result-selected.png'),
      timeout: SCREENSHOT_CAPTURE_TIMEOUT_MS,
    });

    markStage(page, 'default-access:animations-off');
    await animationsButton(page, 'Off').click();
    await expect(
      page.getByRole('radio', { name: team2, exact: true }),
    ).toBeChecked();

    markStage(page, 'default-access:continue-to-standard-step');
    await continueButton(page).click();
    await expect(page.getByText('Step 2 of 9')).toBeVisible();
    await expect(page.getByTestId('kaplay-match-result-stage')).toHaveCount(0);
    await expect(
      page.getByRole('spinbutton', { name: `${team1} tries` }),
    ).toBeVisible();

    markStage(page, 'default-access:back-to-match-result-off');
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByText('Step 1 of 9')).toBeVisible();
    await expect(page.getByTestId('kaplay-match-result-stage')).toHaveCount(0);
    await expect(
      page.getByRole('radio', { name: team2, exact: true }),
    ).toBeChecked();

    markStage(page, 'default-access:animations-on-again');
    await animationsButton(page, 'On').click();
    await waitForKaplayReady(page);
    await expect(page.getByTestId('kaplay-match-result-picked')).toContainText(
      `You picked ${team2}`,
    );
  });

  test('keeps canvas coordinates synchronized across desktop compact desktop resizing', async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: 1280 });
    const measurements: BrowserEvidenceEntry[] = [];
    const captureResults: BrowserEvidenceEntry[] = [];
    const longTeam1 = `${uniqueLabel('Cape Town Longform Rugby Football Club')} XV`;
    const longTeam2 = `${uniqueLabel('Johannesburg Longform Rugby Football Club')} XV`;
    const { fixtureId, team1, team2 } = await createPredictionAtMatchResult(
      page,
      'kaplay-resize-sync',
      {
        team1: longTeam1,
        team2: longTeam2,
      },
    );

    await waitForKaplayReady(page);

    const writeResizeEvidence = () => {
      writeEvidenceJson('resize-interaction-measurements.json', {
        captureResults,
        measurements,
        recordedAt: utcNow(),
      });
    };

    const captureResizeScreenshot = async (
      kind: 'canvas-crop' | 'viewport',
      name: string,
      capture: () => Promise<void>,
    ) => {
      markStage(page, `resize-sync:capture-${kind}:start`, { name });

      try {
        await capture();
        captureResults.push({
          kind,
          name,
          status: 'passed',
          time: utcNow(),
        });
        markStage(page, `resize-sync:capture-${kind}:end`, {
          name,
          status: 'passed',
        });
      } catch (error) {
        const message = errorMessage(error);

        captureResults.push({
          error: message,
          kind,
          name,
          status: 'failed',
          time: utcNow(),
        });
        markStage(page, `resize-sync:capture-${kind}:end`, {
          error: message,
          name,
          status: 'failed',
        });
      } finally {
        writeResizeEvidence();
      }
    };

    const collectResizeEvidence = async (
      label: string,
      screenshotName: string,
      cropName: string,
      observedPointerResult: string | null,
    ) => {
      const measurement = await collectKaplayLayoutEvidence(page, label);

      measurements.push({
        ...measurement,
        observedPointerResult,
      });
      markStage(page, 'resize-sync:measurement-persistence:start', {
        label,
      });
      writeResizeEvidence();
      markStage(page, 'resize-sync:measurement-persistence:end', {
        label,
      });

      await captureResizeScreenshot('viewport', screenshotName, async () => {
        await captureCanvasBitmap(page, screenshotName);
      });
      await captureResizeScreenshot('canvas-crop', cropName, () =>
        captureCanvasBitmap(page, cropName),
      );

      for (const choice of measurement.layout.choices) {
        expect(choice.labelCssFontSize).toBeGreaterThanOrEqual(15.99);
        expect(choice.targetCssHeight).toBeGreaterThanOrEqual(43.99);
      }

      expect(measurement.layout.viewport.engine).toEqual({
        height: measurement.layout.stage.height,
        width: measurement.layout.stage.width,
      });
      expect(measurement.layout.viewport.renderedContentBounds).not.toBeNull();
      markStage(page, 'resize-sync:interaction-continuation', { label });
    };

    await collectResizeEvidence(
      'initial desktop choices',
      'resize-sync-desktop-initial.png',
      'resize-sync-desktop-initial-crop.png',
      null,
    );

    markStage(page, 'resize-sync:desktop-pointer-team2');
    await clickCanvasChoice(page, 1);
    await expect(page.getByTestId('kaplay-match-result-picked')).toContainText(
      `You picked ${team2}`,
    );
    await page.getByRole('button', { name: 'Change my selection' }).click();
    await waitForHitTestableChoices(page);

    markStage(page, 'resize-sync:to-390');
    await page.setViewportSize({ height: 760, width: 390 });
    await waitForHitTestableChoices(page);
    await collectResizeEvidence(
      'compact 390 choices after desktop resize',
      'resize-sync-compact-390.png',
      'resize-sync-compact-390-crop.png',
      team2,
    );

    markStage(page, 'resize-sync:compact-390-draw-pointer');
    await clickCanvasChoice(page, 2);
    await expect(page.getByTestId('kaplay-match-result-picked')).toContainText(
      'You picked Draw',
    );
    await page.getByRole('button', { name: 'Change my selection' }).click();
    await waitForHitTestableChoices(page);

    markStage(page, 'resize-sync:to-360');
    await page.setViewportSize({ height: 760, width: 360 });
    await waitForHitTestableChoices(page);
    await collectResizeEvidence(
      'compact 360 choices after compact resize',
      'resize-sync-compact-360.png',
      'resize-sync-compact-360-crop.png',
      'draw',
    );

    markStage(page, 'resize-sync:compact-360-team1-pointer');
    await clickCanvasChoice(page, 0);
    await expect(page.getByTestId('kaplay-match-result-picked')).toContainText(
      `You picked ${team1}`,
    );
    await page.getByRole('button', { name: 'Change my selection' }).click();
    await waitForHitTestableChoices(page);

    markStage(page, 'resize-sync:return-desktop');
    await page.setViewportSize({ height: 900, width: 1280 });
    await waitForHitTestableChoices(page);
    await collectResizeEvidence(
      'desktop choices after compact return',
      'resize-sync-desktop-returned.png',
      'resize-sync-desktop-returned-crop.png',
      team1,
    );

    markStage(page, 'resize-sync:desktop-keyboard-team2');
    await page.getByRole('radio', { name: team2, exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('kaplay-match-result-picked')).toContainText(
      `You picked ${team2}`,
    );
    await expect(
      page.getByRole('radio', { name: team2, exact: true }),
    ).toHaveAttribute('aria-checked', 'true');

    await page.getByRole('button', { name: 'Change my selection' }).click();
    await waitForHitTestableChoices(page);
    markStage(page, 'resize-sync:record-resize-during-shove');
    await startCanvasRecording(page);
    await clickCanvasChoice(page, 2);
    await page.setViewportSize({ height: 760, width: 390 });
    await expect(page.getByTestId('kaplay-match-result-picked')).toContainText(
      'You picked Draw',
    );
    await page.waitForTimeout(1_200);
    await stopCanvasRecording(page, 'resize-sync-during-shove.webm');

    const unsavedEntry = await currentUserPredictionEntry(page, fixtureId);

    expect(unsavedEntry).toBeNull();
    expect(measurements).toHaveLength(4);
    writeResizeEvidence();
  });

  test('handles Draw, Change my selection and Continue during an active shove', async ({
    page,
  }) => {
    const { team1 } = await createPredictionAtMatchResult(
      page,
      'kaplay-three-choice',
    );

    await waitForKaplayReady(page);
    markStage(page, 'three-choice:draw-click');
    await clickCanvasChoice(page, 2);
    await expect(page.getByTestId('kaplay-match-result-picked')).toContainText(
      'You picked Draw',
    );
    await expect(
      page.getByRole('radio', { exact: true, name: 'Draw' }),
    ).toHaveAttribute('aria-checked', 'true');

    markStage(page, 'three-choice:change-selection');
    await page.getByRole('button', { name: 'Change my selection' }).click();
    await page.getByRole('radio', { name: team1, exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('kaplay-match-result-picked')).toContainText(
      `You picked ${team1}`,
    );
    await expect(
      page.getByRole('radio', { exact: true, name: team1 }),
    ).toHaveAttribute('aria-checked', 'true');

    markStage(page, 'three-choice:continue-during-shove');
    await continueButton(page).click();
    await expect(page.getByText('Step 2 of 9')).toBeVisible();
  });

  test('preserves the selected answer when switched Off during an active shove', async ({
    page,
  }) => {
    const { team2 } = await createPredictionAtMatchResult(
      page,
      'kaplay-off-during-shove',
    );

    await waitForKaplayReady(page);
    markStage(page, 'off-during-shove:canvas-choice-click');
    await clickCanvasChoice(page, 1);
    await expect(page.getByTestId('kaplay-match-result-picked')).toContainText(
      `You picked ${team2}`,
    );

    markStage(page, 'off-during-shove:animations-off');
    await animationsButton(page, 'Off').click();
    await expect(page.getByTestId('kaplay-match-result-stage')).toHaveCount(0);
    await expect(
      page.getByRole('radio', { exact: true, name: team2 }),
    ).toBeChecked();
    await page.screenshot({
      fullPage: true,
      path: evidenceScreenshotPath('standard-after-interruption.png'),
      timeout: SCREENSHOT_CAPTURE_TIMEOUT_MS,
    });
  });

  test('captures a slowed browser review of the same shove motion', async ({
    page,
  }) => {
    await createPredictionAtMatchResult(page, 'kaplay-slow-review');
    await page.evaluate(() => {
      window.__RUGBY_ROOSTER_KAPLAY_PREVIEW_TEST__ = {
        motionTimeScale: 0.25,
      };
    });
    await animationsButton(page, 'Off').click();
    await animationsButton(page, 'On').click();
    await waitForKaplayReady(page);

    markStage(page, 'slow-review:recording-start');
    await startCanvasRecording(page);
    await page.waitForTimeout(300);
    await clickCanvasChoice(page, 0);
    await expect(page.getByTestId('kaplay-match-result-picked')).toContainText(
      'You picked',
    );
    await page.waitForTimeout(4_200);
    await stopCanvasRecording(page, 'match-result-shove-slow-review.webm');

    await page.evaluate(() => {
      window.__RUGBY_ROOSTER_KAPLAY_PREVIEW_TEST__ = {};
    });
  });

  test('uses Standard when reduced motion blocks automatic activation', async ({
    page,
  }) => {
    const longTeam1 = `${uniqueLabel('Cape Town Very Long Club Name')} XV`;
    const longTeam2 = `${uniqueLabel('Johannesburg Equally Long Club Name')} XV`;
    const measurements: BrowserEvidenceEntry[] = [];

    await page.setViewportSize({ height: 760, width: 390 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await createPredictionAtMatchResult(
      page,
      'kaplay-reduced-motion',
      {
        team1: longTeam1,
        team2: longTeam2,
      },
      {
        beforeStart: async () => {
          await page.evaluate(() => {
            window.__RUGBY_ROOSTER_KAPLAY_PREVIEW_TEST__ = {
              motionTimeScale: 0.25,
            };
          });
        },
      },
    );

    await expect(
      page.getByText('Your device/browser preference keeps animations off.'),
    ).toBeVisible();
    await expect(page.getByTestId('kaplay-match-result-stage')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => window.__RUGBY_ROOSTER_KAPLAY_IMPORT_COUNT__ ?? 0),
      )
      .toBe(0);

    markStage(page, 'reduced-motion:emulate-no-preference');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await waitForKaplayReady(page);
    const mobile390Initial = await collectKaplayLayoutEvidence(
      page,
      '390px viewport initial choices',
    );
    await captureCanvasBitmap(page, 'mobile-390-match-result-preview.png');
    await captureCanvasBitmap(page, 'mobile-390-choice-area-crop.png');
    markStage(page, 'reduced-motion:mobile-390-measured', {
      canvasCss: mobile390Initial.canvasCss,
      choices: mobile390Initial.layout.choices.map((choice) => ({
        label: choice.label,
        labelCssFontSize: choice.labelCssFontSize,
        targetCssHeight: choice.targetCssHeight,
      })),
    });

    markStage(page, 'reduced-motion:mobile-390-draw-click');
    await clickCanvasChoice(page, 2);
    await expect(page.getByTestId('kaplay-match-result-picked')).toContainText(
      'You picked Draw',
    );
    const mobile390DrawRejected = await collectKaplayLayoutEvidence(
      page,
      '390px viewport Draw rejected arrangement',
    );
    await captureCanvasBitmap(page, 'mobile-390-draw-rejected.png');
    await captureCanvasBitmap(page, 'mobile-390-draw-rejected-crop.png');
    await page.waitForTimeout(3_400);
    const mobile390Settled = await collectKaplayLayoutEvidence(
      page,
      '390px viewport settled Draw',
    );
    await captureCanvasBitmap(page, 'mobile-390-draw-settled.png');
    measurements.push({
      initial: mobile390Initial,
      rejected: mobile390DrawRejected,
      settled: mobile390Settled,
      viewportWidth: 390,
    });

    await page.getByRole('button', { name: 'Change my selection' }).click();
    await page.setViewportSize({ height: 760, width: 360 });
    await waitForHitTestableChoices(page);
    const mobile360Initial = await collectKaplayLayoutEvidence(
      page,
      '360px viewport initial choices',
    );
    await captureCanvasBitmap(page, 'mobile-360-match-result-preview.png');
    await captureCanvasBitmap(page, 'mobile-360-choice-area-crop.png');
    markStage(page, 'reduced-motion:mobile-360-measured', {
      canvasCss: mobile360Initial.canvasCss,
      choices: mobile360Initial.layout.choices.map((choice) => ({
        label: choice.label,
        labelCssFontSize: choice.labelCssFontSize,
        targetCssHeight: choice.targetCssHeight,
      })),
    });

    markStage(page, 'reduced-motion:mobile-360-team1-click');
    await clickCanvasChoice(page, 0);
    await expect(page.getByTestId('kaplay-match-result-picked')).toContainText(
      `You picked ${longTeam1}`,
    );
    await page.getByRole('button', { name: 'Change my selection' }).click();
    await waitForHitTestableChoices(page);
    markStage(page, 'reduced-motion:mobile-360-draw-click');
    await clickCanvasChoice(page, 2);
    await expect(page.getByTestId('kaplay-match-result-picked')).toContainText(
      'You picked Draw',
    );
    const mobile360DrawRejected = await collectKaplayLayoutEvidence(
      page,
      '360px viewport Draw rejected arrangement',
    );
    await captureCanvasBitmap(page, 'mobile-360-draw-rejected.png');
    await captureCanvasBitmap(page, 'mobile-360-draw-rejected-crop.png');
    await page.waitForTimeout(3_400);
    const mobile360Settled = await collectKaplayLayoutEvidence(
      page,
      '360px viewport settled Draw',
    );
    await captureCanvasBitmap(page, 'mobile-360-draw-settled.png');
    measurements.push({
      initial: mobile360Initial,
      rejected: mobile360DrawRejected,
      settled: mobile360Settled,
      viewportWidth: 360,
    });
    writeEvidenceJson('mobile-layout-measurements.json', {
      measurements,
    });

    for (const measurement of measurements) {
      for (const phase of ['initial', 'rejected', 'settled'] as const) {
        const phaseMeasurement = measurement[phase] as {
          readonly layout: KaplayMatchResultDebugLayout;
        };

        for (const choice of phaseMeasurement.layout.choices) {
          expect(choice.labelCssFontSize).toBeGreaterThanOrEqual(15.99);
          expect(choice.targetCssHeight).toBeGreaterThanOrEqual(43.99);
        }
      }
    }

    markStage(page, 'reduced-motion:emulate-reduce');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(
      page.getByText('Your device/browser preference keeps animations off.'),
    ).toBeVisible();
    await expect(page.getByTestId('kaplay-match-result-stage')).toHaveCount(0);
    await expect(
      page.getByRole('radio', { name: 'Draw', exact: true }),
    ).toBeChecked();
    await page.evaluate(() => {
      window.__RUGBY_ROOSTER_KAPLAY_PREVIEW_TEST__ = {};
    });
  });

  test('recovers from delayed initialization, controlled failure and context loss', async ({
    page,
  }) => {
    const { fixtureId, team1 } = await createPredictionAtMatchResult(
      page,
      'kaplay-failure',
      undefined,
      {
        storedAnimationPreference: 'off',
      },
    );

    await page.evaluate(() => {
      window.__RUGBY_ROOSTER_KAPLAY_PREVIEW_TEST__ = {
        delayInitializationMs: 250,
      };
    });
    markStage(page, 'controlled-failure:delayed-initialization-armed');
    await animationsButton(page, 'On').click();
    await expect(
      page.getByText('Loading animation preview.').first(),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Continue without animations' })
      .first()
      .click();
    markStage(page, 'controlled-failure:continue-without-animations');
    await expect(
      page.getByRole('radio', { name: team1, exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(350);
    await expect(page.getByTestId('kaplay-match-result-stage')).toHaveCount(0);

    await gotoLocal(page, predictionPath(fixtureId));
    await startPrediction(page);
    await expect(page.getByText('Step 1 of 9')).toBeVisible();
    markStage(page, 'controlled-failure:revisited-match-result');

    await page.evaluate(() => {
      window.__RUGBY_ROOSTER_KAPLAY_PREVIEW_TEST__ = {
        failRequiredSpriteLoad: true,
      };
    });
    markStage(page, 'controlled-failure:required-sprite-load-failure');
    await animationsButton(page, 'On').click();
    await expect(
      page.getByText(
        "Animations couldn't continue. Your answers have been kept.",
      ),
    ).toBeVisible();
    await expect(page.getByTestId('kaplay-match-result-stage')).toHaveCount(0);

    await page.evaluate(() => {
      window.__RUGBY_ROOSTER_KAPLAY_PREVIEW_TEST__ = {
        failOnNextPointer: true,
      };
    });
    markStage(page, 'controlled-failure:pointer-failure-armed');
    await page.getByRole('button', { name: 'Retry animations' }).click();
    await retryIfAnimationFailureIsVisible(page);
    await waitForKaplayReady(page);
    markStage(page, 'controlled-failure:canvas-choice-click');
    await clickCanvasChoice(page, 0);
    await expect(
      page.getByText(
        "Animations couldn't continue. Your answers have been kept.",
      ),
    ).toBeVisible();
    await page.screenshot({
      fullPage: true,
      path: evidenceScreenshotPath('standard-after-fallback.png'),
      timeout: SCREENSHOT_CAPTURE_TIMEOUT_MS,
    });

    await page.evaluate(() => {
      window.__RUGBY_ROOSTER_KAPLAY_PREVIEW_TEST__ = {};
    });
    markStage(page, 'controlled-failure:retry-animations');
    await page.getByRole('button', { name: 'Retry animations' }).click();
    await waitForKaplayReady(page);
    markStage(page, 'controlled-failure:dispatch-webglcontextlost');
    await page
      .getByTestId('kaplay-match-result-canvas')
      .dispatchEvent('webglcontextlost', {
        bubbles: false,
        cancelable: true,
      });
    await expect(
      page.getByText(
        "Animations couldn't continue. Your answers have been kept.",
      ),
    ).toBeVisible();
  });

  test('preserves a dirty saved custom prediction through same-session runtime failure', async ({
    page,
  }) => {
    const team1 = uniqueLabel('Springboks Dirty');
    const team2 = uniqueLabel('All Blacks Dirty');
    const numberPrompt = 'How many scrum penalties will Team 2 concede?';
    const { fixtureId } = await createPublishedCustomFixture(page, {
      competitionDisplayName: 'Dirty Preview Cup',
      scheduledKickoffAt: farFutureKickoff(),
      team1DisplayName: team1,
      team2DisplayName: team2,
    });

    await loginAsPlayer(page, 'kaplay-dirty-session');
    await gotoLocal(page, predictionPath(fixtureId));
    await fillValidCustomSequentialPrediction(
      page,
      {
        team1,
        team2,
      },
      {
        choiceLabel: 'Forwards',
        numberPrompt,
        numberValue: '4',
      },
    );
    await page.getByRole('button', { name: 'Submit prediction' }).click();
    await expect(page.getByRole('status')).toContainText('Prediction saved.');

    const savedEntry = await currentUserPredictionEntry(page, fixtureId);
    const savedRevision = savedEntry?.revision;

    expect(savedRevision).toBeGreaterThan(0);
    expect(savedEntry?.prediction.highestScoringHalf).toBe('second');
    expect(savedEntry?.prediction.customAnswers).toMatchObject({
      'player-band': 'forwards',
      'scrum-pressure': 4,
    });
    markStage(page, 'dirty-session:saved-entry-created', {
      savedRevision,
    });

    await gotoLocal(page, predictionPath(fixtureId));
    await expect(saveRevisedPredictionButton(page)).toBeVisible({
      timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS,
    });

    await reviewSection(page, 'OTHER PREDICTIONS')
      .getByRole('button', { name: 'Edit highest-scoring half' })
      .click();
    await expectStep(page, 7, 10);
    await chooseVisibleRadio(page, 'First Half');
    await page.getByRole('button', { name: 'Return to Review' }).click();

    await reviewSection(page, 'CUSTOM QUESTIONS')
      .getByRole('button', { name: 'Edit custom question' })
      .first()
      .click();
    await expectStep(page, 9, 10);
    await page
      .getByRole('spinbutton', { name: `${numberPrompt} answer` })
      .fill('6');
    await page.getByRole('button', { name: 'Return to Review' }).click();

    await reviewSection(page, 'CUSTOM QUESTIONS')
      .getByRole('button', { name: 'Edit custom question' })
      .nth(1)
      .click();
    await expectStep(page, 10, 10);
    await chooseVisibleRadio(page, 'Backs');
    await page.getByRole('button', { name: 'Return to Review' }).click();

    await expect(reviewSection(page, 'OTHER PREDICTIONS')).toContainText(
      'First half',
    );
    await expect(reviewSection(page, 'CUSTOM QUESTIONS')).toContainText('6');
    await expect(reviewSection(page, 'CUSTOM QUESTIONS')).toContainText(
      'Backs',
    );
    markStage(page, 'dirty-session:unsaved-review-edits-ready');

    await reviewSection(page, 'MATCH RESULT')
      .getByRole('button', { name: 'Edit' })
      .click();
    await expectStep(page, 1, 10);
    await expect(
      page.getByRole('button', { name: 'Return to Review' }),
    ).toBeVisible();
    await expect(
      page.getByRole('radio', { exact: true, name: team1 }),
    ).toBeChecked();

    const navigationProbe = createMainFrameNavigationProbe(page);

    navigationProbe.arm();
    markStage(page, 'dirty-session:protected-segment-armed');
    await expect(
      page.getByRole('button', { name: 'Return to Review' }),
    ).toBeVisible();
    await waitForKaplayReady(page);
    markStage(page, 'dirty-session:change-selection');
    await page.getByRole('button', { name: 'Change my selection' }).click();
    await waitForHitTestableChoices(page);
    markStage(page, 'dirty-session:canvas-choice-click');
    await clickCanvasChoice(page, 0);
    await expect(page.getByTestId('kaplay-match-result-picked')).toContainText(
      `You picked ${team1}`,
    );

    markStage(page, 'dirty-session:dispatch-webglcontextlost');
    await page
      .getByTestId('kaplay-match-result-canvas')
      .dispatchEvent('webglcontextlost', {
        bubbles: false,
        cancelable: true,
      });
    await expect(
      page.getByText(
        "Animations couldn't continue. Your answers have been kept.",
      ),
    ).toBeVisible();
    await expect(page.getByTestId('kaplay-match-result-stage')).toHaveCount(0);
    await expectStep(page, 1, 10);
    await expect(
      page.getByRole('button', { name: 'Return to Review' }),
    ).toBeVisible();
    await expect(
      page.getByRole('radio', { exact: true, name: team1 }),
    ).toBeChecked();
    expect(
      navigationProbe.urls(),
      'Kaplay dirty-session preservation segment should not trigger a page reload.',
    ).toEqual([]);

    const entryAfterFailure = await currentUserPredictionEntry(page, fixtureId);

    expect(entryAfterFailure?.revision).toBe(savedRevision);
    expect(entryAfterFailure?.prediction.highestScoringHalf).toBe('second');
    expect(entryAfterFailure?.prediction.customAnswers).toMatchObject({
      'player-band': 'forwards',
      'scrum-pressure': 4,
    });
    markStage(page, 'dirty-session:persisted-entry-unchanged-after-failure');

    await animationsButton(page, 'Off').click();
    await page.getByRole('button', { name: 'Return to Review' }).click();
    await expect(reviewSection(page, 'OTHER PREDICTIONS')).toContainText(
      'First half',
    );
    await expect(reviewSection(page, 'CUSTOM QUESTIONS')).toContainText('6');
    await expect(reviewSection(page, 'CUSTOM QUESTIONS')).toContainText(
      'Backs',
    );

    markStage(page, 'dirty-session:explicit-save-revised-prediction');
    await saveRevisedPredictionButton(page).click();
    await expect(page.getByRole('status')).toContainText('Prediction updated.');

    const revisedEntry = await currentUserPredictionEntry(page, fixtureId);

    expect(revisedEntry?.revision).toBe((savedRevision ?? 0) + 1);
    expect(revisedEntry?.prediction.highestScoringHalf).toBe('first');
    expect(revisedEntry?.prediction.customAnswers).toMatchObject({
      'player-band': 'backs',
      'scrum-pressure': 6,
    });
  });

  test('supports keyboard selection while legacy enabled false no longer blocks development access', async ({
    page,
  }) => {
    const { team2 } = await createEditablePredictionFixture(
      page,
      'kaplay-keyboard',
    );

    await page.evaluate((key) => {
      window.localStorage.setItem(key, 'on');
      const rugbyRoosterSettings = (
        window.Meteor as unknown as {
          readonly settings: {
            readonly public?: {
              readonly rugbyRooster?: {
                kaplayPredictionPreview?: {
                  enabled?: boolean;
                };
              };
            };
          };
        }
      ).settings.public?.rugbyRooster;

      if (rugbyRoosterSettings) {
        rugbyRoosterSettings.kaplayPredictionPreview = {
          enabled: false,
        };
      }
    }, animationPreferenceStorageKey);

    await startPrediction(page);
    await expect(page.getByText('Step 1 of 9')).toBeVisible();
    markStage(page, 'keyboard:legacy-enabled-false');
    await retryIfAnimationFailureIsVisible(page);
    await waitForKaplayReady(page);
    markStage(page, 'keyboard:dom-radio-space');
    await page.getByRole('radio', { name: team2, exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('kaplay-match-result-picked')).toContainText(
      `You picked ${team2}`,
    );
  });
});
