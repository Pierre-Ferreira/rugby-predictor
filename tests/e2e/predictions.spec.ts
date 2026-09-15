import { expect, type Browser, type Page, test } from '@playwright/test';

import { TEST_AUTH_METHODS } from '../../imports/shared/auth/methods';
import {
  FIXTURE_METHODS,
  TEST_FIXTURE_METHODS,
} from '../../imports/shared/fixtures';
import {
  PREDICTION_METHODS,
  TEST_PREDICTION_METHODS,
} from '../../imports/shared/predictions';
import type { FixturePrediction } from '../../imports/shared/scoring';

const uniqueEmail = (label: string) =>
  `ccpp006-e2e-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;

const uniqueLabel = (label: string) =>
  `${label} ${Date.now().toString(36)}${Math.random().toString(16).slice(2, 6)}`;

const NAVIGATION_ATTEMPT_TIMEOUT_MS = 15_000;

const isTransientLocalNavigationError = (error: unknown) =>
  error instanceof Error &&
  (error.message.includes('net::ERR_ABORTED') ||
    error.message.includes('interrupted by another navigation') ||
    error.message.includes('Timeout') ||
    error.message.includes('Execution context was destroyed'));

const waitForMeteorClient = async (page: Page) => {
  await page.waitForFunction(() => Boolean(window.Meteor), undefined, {
    timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS,
  });
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
  await gotoLocal(page, '/');
};

const createPublishedFixture = async (
  page: Page,
  details: {
    readonly competitionDisplayName: string;
    readonly scheduledKickoffAt: string;
    readonly team1DisplayName: string;
    readonly team2DisplayName: string;
    readonly venueDisplayName?: string;
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

  return email;
};

const loginAsAdminPage = async (browser: Browser, setupPage: Page) => {
  const email = uniqueEmail('admin');

  await callMeteor(setupPage, TEST_AUTH_METHODS.createVerifiedUser, email);
  await callMeteor(setupPage, TEST_AUTH_METHODS.setAdminForEmail, email, true);

  const context = await browser.newContext();
  const adminPage = await context.newPage();

  await gotoLocal(adminPage, '/');
  await loginWithTestToken(adminPage, email);

  return {
    close: () => context.close(),
    page: adminPage,
  };
};

const farFutureKickoff = () =>
  new Date(Date.UTC(2098, 5, 1, 12, 0, 0)).toISOString();

const nearFutureKickoff = () => new Date(Date.now() + 2_000).toISOString();

const predictionPath = (fixtureId: string) => `/games/${fixtureId}/predict`;

const validPrediction = (): FixturePrediction => ({
  firstTry: 'team1',
  halfTimeLeader: 'team1',
  highestScoringHalf: 'second',
  matchResult: 'team1',
  team1: {
    conversions: 2,
    dropGoals: 0,
    penaltyKicks: 1,
    redCards: 0,
    tries: 2,
    yellowCards: 1,
  },
  team2: {
    conversions: 1,
    dropGoals: 0,
    penaltyKicks: 1,
    redCards: 0,
    tries: 1,
    yellowCards: 0,
  },
});

const fillValidPredictionForm = async (
  page: Page,
  teams: {
    readonly team1: string;
    readonly team2: string;
  },
) => {
  await page.getByLabel(`Team 1: ${teams.team1} tries`).fill('2');
  await page.getByLabel(`Team 1: ${teams.team1} conversions`).fill('2');
  await page.getByLabel(`Team 1: ${teams.team1} penalty kicks`).fill('1');
  await page.getByLabel(`Team 1: ${teams.team1} drop goals`).fill('0');
  await page.getByLabel(`Team 1: ${teams.team1} yellow cards`).fill('1');
  await page.getByLabel(`Team 1: ${teams.team1} red cards`).fill('0');
  await page.getByLabel(`Team 2: ${teams.team2} tries`).fill('1');
  await page.getByLabel(`Team 2: ${teams.team2} conversions`).fill('1');
  await page.getByLabel(`Team 2: ${teams.team2} penalty kicks`).fill('1');
  await page.getByLabel(`Team 2: ${teams.team2} drop goals`).fill('0');
  await page.getByLabel(`Team 2: ${teams.team2} yellow cards`).fill('0');
  await page.getByLabel(`Team 2: ${teams.team2} red cards`).fill('0');
  await page.getByLabel('Match result').selectOption('team1');
  await page.getByLabel('First try').selectOption('team1');
  await page.getByLabel('Highest-scoring half').selectOption('second');
  await page.getByLabel('Half-time leader').selectOption('team1');
};

const submitForm = async (page: Page, buttonName: string) => {
  await page.getByRole('button', { name: buttonName }).click();
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

test.describe('prediction entry and submission', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestData(page);
  });

  test('uses the sign-in return path from an anonymous prediction page', async ({
    page,
  }) => {
    const team1 = uniqueLabel('Stormers');
    const team2 = uniqueLabel('Bulls');
    const fixtureId = (
      await createPublishedFixture(page, {
        competitionDisplayName: 'Return Path Cup',
        scheduledKickoffAt: farFutureKickoff(),
        team1DisplayName: team1,
        team2DisplayName: team2,
      })
    ).fixtureId;

    await gotoLocal(page, predictionPath(fixtureId));
    await page.getByRole('link', { name: 'Email me a sign-in link' }).click();

    await expect(page).toHaveURL(/\/sign-in\?/);
    const signInUrl = new URL(page.url());
    expect(signInUrl.searchParams.get('returnTo')).toBe(
      predictionPath(fixtureId),
    );
  });

  test('submits valid predictions and revisits the saved entry', async ({
    page,
  }) => {
    const team1 = uniqueLabel('Sharks');
    const team2 = uniqueLabel('Lions');
    const fixtureId = (
      await createPublishedFixture(page, {
        competitionDisplayName: 'Prediction Cup',
        scheduledKickoffAt: farFutureKickoff(),
        team1DisplayName: team1,
        team2DisplayName: team2,
        venueDisplayName: 'Kings Park',
      })
    ).fixtureId;

    await loginAsPlayer(page, 'submit');
    await gotoLocal(page, `/games/${fixtureId}`);
    await page.getByRole('link', { name: 'Enter prediction' }).click();
    await fillValidPredictionForm(page, { team1, team2 });
    await submitForm(page, 'Submit prediction');

    await expect(page.getByRole('status')).toContainText('Prediction saved.');
    await expect(
      page.getByRole('button', { name: 'Save revised prediction' }),
    ).toBeVisible();
    await expect(page.getByText(`${team1}: 17`)).toBeVisible();
    await expect(page.getByText(`${team2}: 10`)).toBeVisible();

    await gotoLocal(page, predictionPath(fixtureId));
    await expect(
      page.getByRole('button', { name: 'Save revised prediction' }),
    ).toBeVisible();
    await expect(page.getByLabel(`Team 1: ${team1} tries`)).toHaveValue('2');
    await expect(page.getByLabel('Match result')).toHaveValue('team1');
  });

  test('edits a saved prediction before kickoff', async ({ page }) => {
    const team1 = uniqueLabel('Boks');
    const team2 = uniqueLabel('Wallabies');
    const fixtureId = (
      await createPublishedFixture(page, {
        competitionDisplayName: 'Revision Cup',
        scheduledKickoffAt: farFutureKickoff(),
        team1DisplayName: team1,
        team2DisplayName: team2,
      })
    ).fixtureId;

    await loginAsPlayer(page, 'edit');
    await gotoLocal(page, predictionPath(fixtureId));
    await fillValidPredictionForm(page, { team1, team2 });
    await submitForm(page, 'Submit prediction');
    await page.getByLabel(`Team 2: ${team2} tries`).fill('2');
    await submitForm(page, 'Save revised prediction');

    await expect(page.getByRole('status')).toContainText('Prediction updated.');
    await gotoLocal(page, predictionPath(fixtureId));
    await expect(page.getByLabel(`Team 2: ${team2} tries`)).toHaveValue('2');
  });

  test('shows persisted saved entry after dirty local values lock at kickoff', async ({
    browser,
    page,
  }) => {
    const team1 = uniqueLabel('Scarlets');
    const team2 = uniqueLabel('Ospreys');
    const fixtureDetails = {
      competitionDisplayName: 'Locked Cup',
      scheduledKickoffAt: farFutureKickoff(),
      team1DisplayName: team1,
      team2DisplayName: team2,
    };
    const fixtureId = (await createPublishedFixture(page, fixtureDetails))
      .fixtureId;

    await loginAsPlayer(page, 'locked');
    await gotoLocal(page, predictionPath(fixtureId));
    await fillValidPredictionForm(page, { team1, team2 });
    await submitForm(page, 'Submit prediction');
    await expect(page.getByRole('status')).toContainText('Prediction saved.');
    await gotoLocal(page, predictionPath(fixtureId));
    await expect(
      page.getByRole('button', { name: 'Save revised prediction' }),
    ).toBeVisible();
    await expect(page.getByText(`${team1}: 17`)).toBeVisible();

    await page.getByLabel(`Team 1: ${team1} tries`).fill('3');
    await page.getByLabel(`Team 1: ${team1} conversions`).fill('3');
    await expect(page.getByText(`${team1}: 24`)).toBeVisible();

    const admin = await loginAsAdminPage(browser, page);

    try {
      await callMeteor(admin.page, FIXTURE_METHODS.editDetails, {
        details: {
          ...fixtureDetails,
          scheduledKickoffAt: nearFutureKickoff(),
        },
        expectedRevision: 1,
        fixtureId,
      });
    } finally {
      await admin.close();
    }

    await expect(page.getByText('Scheduled kickoff has passed')).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole('button', { name: 'Save revised prediction' }),
    ).toHaveCount(0);
    await expect(page.getByText(`${team1}: 17`)).toBeVisible();
    await expect(page.getByText(`${team1}: 24`)).toHaveCount(0);
  });

  test('preserves unsaved answers after a stale revision conflict', async ({
    page,
  }) => {
    const team1 = uniqueLabel('Munster');
    const team2 = uniqueLabel('Leinster');
    const fixtureId = (
      await createPublishedFixture(page, {
        competitionDisplayName: 'Conflict Cup',
        scheduledKickoffAt: farFutureKickoff(),
        team1DisplayName: team1,
        team2DisplayName: team2,
      })
    ).fixtureId;

    await loginAsPlayer(page, 'conflict');
    await gotoLocal(page, predictionPath(fixtureId));
    await fillValidPredictionForm(page, { team1, team2 });
    await submitForm(page, 'Submit prediction');
    await page.getByLabel(`Team 1: ${team1} penalty kicks`).fill('2');

    await callMeteor(page, PREDICTION_METHODS.submit, {
      expectedRevision: 1,
      fixtureId,
      prediction: {
        ...validPrediction(),
        highestScoringHalf: 'first',
      },
    });

    await submitForm(page, 'Save revised prediction');

    await expect(page.getByRole('alert')).toContainText(
      'This prediction changed before your update could be saved.',
    );
    await expect(page.getByLabel(`Team 1: ${team1} penalty kicks`)).toHaveValue(
      '2',
    );
    await expect(
      page.getByText('This form still uses revision 1'),
    ).toBeVisible();
  });
});
