import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { TEST_AUTH_METHODS } from '../../imports/shared/auth/methods';
import { TEST_FIXTURE_METHODS } from '../../imports/shared/fixtures';
import { TEST_PREDICTION_METHODS } from '../../imports/shared/predictions';

const NAVIGATION_ATTEMPT_TIMEOUT_MS = 15_000;
const animationPreferenceStorageKey = 'rugby-rooster:prediction-animations';
const evidenceDir = process.env.RUGBY_ROOSTER_E2E_EVIDENCE_DIR;

const uniqueEmail = (label: string) =>
  `ccpp010a-e2e-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;

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
  await page.evaluate(
    (key) => window.localStorage.removeItem(key),
    animationPreferenceStorageKey,
  );
  await gotoLocal(page, '/');
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

const loginWithTestToken = async (page: Page, email: string) => {
  const session = await callMeteor<{
    readonly token: string;
    readonly userId: string;
  }>(page, TEST_AUTH_METHODS.loginTokenForEmail, email);

  const evaluateLogin = () =>
    page.evaluate(
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

  try {
    await evaluateLogin();
  } catch (error) {
    if (!isTransientLocalNavigationError(error)) {
      throw error;
    }

    await waitForMeteorClient(page);
    await evaluateLogin();
  }
};

const loginAsPlayer = async (page: Page, label: string) => {
  const email = uniqueEmail(label);

  await callMeteor(page, TEST_AUTH_METHODS.createVerifiedUser, email);
  await loginWithTestToken(page, email);
};

const farFutureKickoff = () =>
  new Date(Date.UTC(2098, 5, 1, 12, 0, 0)).toISOString();

const predictionPath = (fixtureId: string) => `/games/${fixtureId}/predict`;

const startPrediction = async (page: Page) => {
  await page.getByRole('button', { name: "Let's predict" }).click();
};

const continueButton = (page: Page) =>
  page.getByRole('button', { name: 'Continue' });

const backButton = (page: Page) => page.getByRole('button', { name: 'Back' });

const teamNumberInput = (page: Page, teamName: string, fieldName: string) =>
  page.getByRole('spinbutton', { name: `${teamName} ${fieldName}` });

const screenshotPath = (name: string) => {
  if (!evidenceDir) {
    return null;
  }

  const screenshotDir = join(evidenceDir, 'browser-screenshots');
  mkdirSync(screenshotDir, { recursive: true });

  return join(screenshotDir, name);
};

const videoPath = (name: string) => {
  if (!evidenceDir) {
    return null;
  }

  const videoDir = join(evidenceDir, 'browser-videos');
  mkdirSync(videoDir, { recursive: true });

  return join(videoDir, name);
};

const captureScreenshot = async (
  page: Page,
  name: string,
  options: { readonly fullPage?: boolean } = {},
) => {
  const path = screenshotPath(name);

  if (!path) {
    return;
  }

  await page.screenshot({
    animations: 'allow',
    fullPage: options.fullPage ?? true,
    path,
  });
};

const saveVideo = async (page: Page, name: string) => {
  const path = videoPath(name);
  const video = page.video();

  if (!path || !video) {
    return;
  }

  await page.close();
  await video.saveAs(path);
};

const createFixtureAndOpenPrediction = async (
  page: Page,
  label: string,
  teams = {
    team1: uniqueLabel('Cape Town Very Long Club Name XV'),
    team2: uniqueLabel('Johannesburg Equally Long Club Name XV'),
  },
) => {
  const fixtureId = (
    await createPublishedFixture(page, {
      competitionDisplayName: `${label} Cup`,
      scheduledKickoffAt: farFutureKickoff(),
      team1DisplayName: teams.team1,
      team2DisplayName: teams.team2,
    })
  ).fixtureId;

  await loginAsPlayer(page, label);
  await gotoLocal(page, predictionPath(fixtureId));
  await startPrediction(page);

  return {
    fixtureId,
    teams,
  };
};

declare global {
  interface Window {
    Meteor: {
      call: (
        method: string,
        ...args: readonly [
          ...unknown[],
          (
            error: { error?: string; message?: string; reason?: string } | null,
            result: unknown,
          ) => void,
        ]
      ) => void;
      loginWithToken: (
        token: string,
        callback: (error?: { readonly error?: string }) => void,
      ) => void;
      user: () => unknown;
      userId: () => string | null;
      users: {
        update: (
          selector: string | null,
          modifier: Record<string, unknown>,
          callback: (error?: { readonly error?: string }) => void,
        ) => void;
      };
    };
  }
}

test.use({ video: 'on' });

test.describe('React prediction presentation', () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await resetTestData(page);
  });

  test('Match Result animated React controls continue into Tries without Kaplay', async ({
    page,
  }) => {
    const requestedUrls: string[] = [];
    page.on('request', (request) => requestedUrls.push(request.url()));
    const { teams } = await createFixtureAndOpenPrediction(page, 'animated');

    await expect(page.getByTestId('react-match-result-step')).toBeVisible();
    await expect(page.getByTestId('kaplay-match-result-canvas')).toHaveCount(0);
    await expect(page.getByRole('radio', { name: teams.team1 })).toBeVisible();
    await expect(page.getByRole('radio', { name: teams.team2 })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Draw' })).toBeVisible();
    await captureScreenshot(page, '010a-desktop-match-result-before.png');

    await page.getByRole('radio', { name: teams.team1 }).check();
    await expect(page.getByRole('radio', { name: teams.team1 })).toBeChecked();
    await expect(page.getByTestId('match-result-shove-layer')).toBeVisible();
    await captureScreenshot(page, '010a-desktop-match-result-selected.png');

    await page.waitForTimeout(120);
    await continueButton(page).click();

    await expect(page.getByTestId('react-tries-step')).toBeVisible();
    await expect(teamNumberInput(page, teams.team1, 'tries')).toBeVisible();
    await captureScreenshot(page, '010a-tries-desktop.png');

    await backButton(page).click();
    await expect(page.getByRole('radio', { name: teams.team1 })).toBeChecked();
    await expect(page.getByTestId('match-result-shove-layer')).toHaveCount(0);
    expect(
      requestedUrls.some((url) =>
        /imports_ui_predictions_kaplay|\/kaplay\/|kaplay/i.test(url),
      ),
    ).toBe(false);
  });

  test('Animations Off, resize interruption, and mobile layouts keep React state', async ({
    page,
  }) => {
    const { teams } = await createFixtureAndOpenPrediction(page, 'off-resize');

    await page.getByRole('button', { exact: true, name: 'Off' }).click();
    await page.getByRole('radio', { name: teams.team2 }).check();
    await expect(page.getByRole('radio', { name: teams.team2 })).toBeChecked();
    await expect(page.getByTestId('match-result-shove-layer')).toHaveCount(0);
    await captureScreenshot(page, '010a-match-result-animations-off.png');
    await continueButton(page).click();
    await expect(page.getByTestId('react-tries-step')).toBeVisible();

    await backButton(page).click();
    await page.getByRole('button', { exact: true, name: 'On' }).click();
    await page.getByRole('button', { name: 'Change my selection' }).click();
    await page.getByRole('radio', { name: 'Draw' }).check();
    await expect(page.getByTestId('match-result-shove-layer')).toBeVisible();
    await page.setViewportSize({ height: 844, width: 390 });
    await expect(page.getByTestId('match-result-shove-layer')).toHaveCount(0);
    await expect(page.getByRole('radio', { name: 'Draw' })).toBeChecked();
    await captureScreenshot(page, '010a-match-result-390-interrupted.png');

    await page.setViewportSize({ height: 740, width: 360 });
    await captureScreenshot(page, '010a-match-result-360.png');
  });

  test('captures the refined Match Result rise, shove, and selected hero', async ({
    page,
  }) => {
    const { teams } = await createFixtureAndOpenPrediction(
      page,
      'complete-shove',
      {
        team1: uniqueLabel('Springboks'),
        team2: uniqueLabel('Wallabies'),
      },
    );
    const matchResultStep = page.getByTestId('react-match-result-step');

    await expect(matchResultStep).toBeVisible();
    await expect(
      page.getByRole('button', { exact: true, name: 'On' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(matchResultStep.getByRole('radio')).toHaveCount(3);
    await captureScreenshot(page, '010a2-match-result-before-selection.png');

    await page.getByRole('radio', { name: teams.team1 }).check();

    await expect(page.getByTestId('match-result-shove-layer')).toBeVisible();
    await expect(page.getByRole('radio', { name: teams.team1 })).toBeChecked();
    await expect(page.getByTestId('match-result-choice-team1')).toHaveClass(
      /rr-match-result-choice-card--selected-rise/,
    );
    await page.waitForTimeout(160);
    await captureScreenshot(page, '010a2-match-result-selected-rise.png', {
      fullPage: false,
    });

    await expect(page.getByTestId('match-result-rooster')).toBeVisible();
    await page.waitForTimeout(470);
    await expect(page.getByRole('radio', { name: teams.team1 })).toBeChecked();
    await captureScreenshot(page, '010a2-match-result-contact-push.png', {
      fullPage: false,
    });

    await expect(page.getByTestId('match-result-shove-layer')).toHaveCount(0, {
      timeout: 2_500,
    });
    await expect(
      page.getByText('YOU SELECTED:', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Change my selection' }),
    ).toBeVisible();
    await expect(matchResultStep.getByRole('radio')).toHaveCount(1);
    await expect(
      matchResultStep.getByRole('radio', { name: teams.team1 }),
    ).toBeChecked();
    await expect(
      matchResultStep.getByRole('radio', { name: teams.team2 }),
    ).toHaveCount(0);
    await expect(
      matchResultStep.getByRole('radio', { name: 'Draw' }),
    ).toHaveCount(0);
    await captureScreenshot(
      page,
      '010a2-match-result-settled-hero-desktop.png',
    );

    await page.setViewportSize({ height: 844, width: 390 });
    await expect(
      page.getByText('YOU SELECTED:', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Change my selection' }),
    ).toBeVisible();
    await captureScreenshot(page, '010a2-match-result-settled-hero-390.png');

    await page.setViewportSize({ height: 740, width: 360 });
    await expect(
      page.getByText('YOU SELECTED:', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Change my selection' }),
    ).toBeVisible();
    await captureScreenshot(page, '010a2-match-result-settled-hero-360.png');

    await saveVideo(
      page,
      '010a2-match-result-rise-shove-hero-normal-speed.webm',
    );
  });

  test('Tries numeric controls support phone input, Back/Continue retention, and toggles', async ({
    page,
  }) => {
    const { teams } = await createFixtureAndOpenPrediction(
      page,
      'tries-toggle',
    );

    await page.getByRole('radio', { name: teams.team1 }).check();
    await continueButton(page).click();
    await page.setViewportSize({ height: 844, width: 390 });
    await captureScreenshot(page, '010a-tries-390.png');

    await page
      .getByRole('button', { name: `Increase ${teams.team1} tries` })
      .click();
    await page
      .getByRole('button', { name: `Increase ${teams.team1} tries` })
      .click();
    await page
      .getByRole('button', { name: `Increase ${teams.team2} tries` })
      .click();
    await page
      .getByRole('button', { name: `Decrease ${teams.team2} tries` })
      .click();
    await teamNumberInput(page, teams.team2, 'tries').fill('3');
    await expect(teamNumberInput(page, teams.team1, 'tries')).toHaveValue('2');
    await expect(teamNumberInput(page, teams.team2, 'tries')).toHaveValue('3');

    await page.getByRole('button', { exact: true, name: 'Off' }).click();
    await captureScreenshot(page, '010a-tries-390-animations-off.png');
    await page.getByRole('button', { exact: true, name: 'On' }).click();
    await expect(teamNumberInput(page, teams.team1, 'tries')).toHaveValue('2');
    await expect(teamNumberInput(page, teams.team2, 'tries')).toHaveValue('3');

    await backButton(page).click();
    await expect(page.getByRole('radio', { name: teams.team1 })).toBeChecked();
    await continueButton(page).click();
    await expect(teamNumberInput(page, teams.team1, 'tries')).toHaveValue('2');
    await expect(teamNumberInput(page, teams.team2, 'tries')).toHaveValue('3');

    await continueButton(page).click();
    await expect(
      teamNumberInput(page, teams.team1, 'conversions'),
    ).toHaveAttribute('max', '2');
    await teamNumberInput(page, teams.team1, 'conversions').fill('2');
    await backButton(page).click();
    await teamNumberInput(page, teams.team1, 'tries').fill('1');
    await continueButton(page).click();
    await expect(teamNumberInput(page, teams.team1, 'conversions')).toHaveValue(
      '1',
    );
  });
});
