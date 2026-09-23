import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';

import { TEST_AUTH_METHODS } from '../../imports/shared/auth/methods';
import { TEST_FIXTURE_METHODS } from '../../imports/shared/fixtures';
import { TEST_MATCH_RESULT_METHODS } from '../../imports/shared/matchResults';
import {
  PREDICTION_METHODS,
  TEST_PREDICTION_METHODS,
  type PredictionMutationResult,
} from '../../imports/shared/predictions';
import type { FixturePrediction } from '../../imports/shared/scoring';

const uniqueEmail = (label: string) =>
  `ccpp011d1-e2e-${label}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}@example.test`;

const NAVIGATION_ATTEMPT_TIMEOUT_MS = 15_000;
const evidenceDir = path.resolve(
  process.env.RUGBY_ROOSTER_E2E_EVIDENCE_DIR ??
    'test-results/ccpp011d1-prediction-access-control',
);

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
    ({ methodArgs, methodName }) =>
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

const callMeteorOutcome = async (
  page: Page,
  method: string,
  ...args: readonly unknown[]
): Promise<{ readonly error?: string; readonly ok: boolean }> =>
  page.evaluate(
    ({ methodArgs, methodName }) =>
      new Promise((resolve) => {
        window.Meteor.call(methodName, ...methodArgs, (error) => {
          resolve(error ? { error: error.error, ok: false } : { ok: true });
        });
      }),
    { methodArgs: args, methodName: method },
  ) as Promise<{ readonly error?: string; readonly ok: boolean }>;

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
  await callMeteor(page, TEST_MATCH_RESULT_METHODS.reset);
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
  await page.waitForFunction(() => window.Meteor.userId() !== null);
};

const createVerifiedUser = async (page: Page, label: string) => {
  const email = uniqueEmail(label);

  await callMeteor(page, TEST_AUTH_METHODS.createVerifiedUser, email);

  return email;
};

const createFixture = async (page: Page) =>
  callMeteor<{ readonly fixtureId: string }>(
    page,
    TEST_FIXTURE_METHODS.createPublished,
    {
      details: {
        competitionDisplayName: 'Prediction Access Cup',
        scheduledKickoffAt: '2098-12-01T12:00:00.000Z',
        team1DisplayName: 'Springboks',
        team2DisplayName: 'All Blacks',
        venueDisplayName: 'Loopback Stadium',
      },
    },
  );

const prediction = (
  overrides: Partial<FixturePrediction> = {},
): FixturePrediction => ({
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
  ...overrides,
});

const submitPrediction = async (
  page: Page,
  fixtureId: string,
  input: {
    readonly expectedRevision?: number;
    readonly prediction?: FixturePrediction;
  } = {},
) =>
  callMeteor<PredictionMutationResult>(page, PREDICTION_METHODS.submit, {
    ...(input.expectedRevision === undefined
      ? {}
      : { expectedRevision: input.expectedRevision }),
    fixtureId,
    prediction: input.prediction ?? prediction(),
  });

const screenshotPath = (name: string): string => {
  mkdirSync(evidenceDir, { recursive: true });

  return path.join(evidenceDir, `${name}.png`);
};

const adminResultsPath = (fixtureId: string) =>
  `/admin/fixtures/${fixtureId}/results`;

const playerPredictionPath = (fixtureId: string) =>
  `/games/${fixtureId}/predict`;

const lockPredictionsFromAdmin = async (page: Page) => {
  await page.getByRole('button', { name: 'Lock predictions' }).click();
  await expect(
    page.getByRole('heading', { name: 'Lock predictions?' }),
  ).toBeVisible();
  await page
    .getByRole('alertdialog', { name: 'Lock predictions?' })
    .getByRole('button', { name: 'Lock predictions' })
    .click();
  await expect(page.getByText('Predictions are locked.')).toBeVisible();
};

const reopenPredictionsFromAdmin = async (page: Page) => {
  await page.getByRole('button', { name: 'Reopen predictions' }).click();
  await expect(
    page.getByRole('heading', { name: 'Reopen predictions?' }),
  ).toBeVisible();
  await page
    .getByRole('alertdialog', { name: 'Reopen predictions?' })
    .getByRole('button', { name: 'Reopen predictions' })
    .click();
  await expect(page.getByText('Reopened by admin')).toBeVisible();
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

test.describe('prediction access controls', () => {
  test.describe.configure({ timeout: 90_000 });

  test('locks, reopens, preserves explicit reopen across result start, and relocks', async ({
    browser,
    page,
  }) => {
    await resetTestData(page);

    const playerEmail = await createVerifiedUser(page, 'player');
    const adminEmail = await createVerifiedUser(page, 'admin');

    await callMeteor(
      page,
      TEST_AUTH_METHODS.setAdminForEmail,
      adminEmail,
      true,
    );
    await loginWithTestToken(page, playerEmail);

    const { fixtureId } = await createFixture(page);
    const created = await submitPrediction(page, fixtureId);

    await gotoLocal(page, playerPredictionPath(fixtureId));
    await expect(
      page.getByRole('button', { name: 'Save revised prediction' }),
    ).toBeVisible();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    try {
      await gotoLocal(adminPage, '/');
      await loginWithTestToken(adminPage, adminEmail);
      await gotoLocal(adminPage, adminResultsPath(fixtureId));

      await expect(
        adminPage.getByText('Prediction access', { exact: true }),
      ).toBeVisible();
      await expect(adminPage.getByText('OPEN', { exact: true })).toBeVisible();

      await lockPredictionsFromAdmin(adminPage);

      await expect(
        page.getByText('Predictions are locked for this fixture.'),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Save revised prediction' }),
      ).toHaveCount(0);

      const staleSave = await callMeteorOutcome(
        page,
        PREDICTION_METHODS.submit,
        {
          expectedRevision: created.revision,
          fixtureId,
          prediction: prediction({ highestScoringHalf: 'equal' }),
        },
      );

      expect(staleSave).toMatchObject({
        error: 'prediction-access-locked',
        ok: false,
      });

      await page.screenshot({
        fullPage: true,
        path: screenshotPath('player-locked-after-admin-lock'),
      });

      await reopenPredictionsFromAdmin(adminPage);

      await gotoLocal(page, playerPredictionPath(fixtureId));
      await expect(
        page.getByRole('button', { name: 'Save revised prediction' }),
      ).toBeVisible();

      const reopenedEdit = await submitPrediction(page, fixtureId, {
        expectedRevision: created.revision,
        prediction: prediction({ highestScoringHalf: 'equal' }),
      });

      await expect(
        page.getByRole('button', { name: 'Save revised prediction' }),
      ).toBeVisible();

      await adminPage
        .getByRole('button', { name: 'Start result tracking' })
        .click();
      await expect(
        adminPage.getByText('Live result tracking started.'),
      ).toBeVisible();
      await expect(
        adminPage.getByRole('spinbutton', { name: 'Springboks tries' }),
      ).toHaveValue('0');
      await expect(adminPage.getByText('Reopened by admin')).toBeVisible();

      await submitPrediction(page, fixtureId, {
        expectedRevision: reopenedEdit.revision,
        prediction: prediction({ highestScoringHalf: 'first' }),
      });

      await adminPage.screenshot({
        fullPage: true,
        path: screenshotPath('admin-reopened-after-result-start'),
      });

      await lockPredictionsFromAdmin(adminPage);
      await expect(
        page.getByText('Predictions are locked for this fixture.'),
      ).toBeVisible();

      await adminPage.screenshot({
        fullPage: true,
        path: screenshotPath('admin-relocked'),
      });
    } finally {
      await adminContext.close();
    }
  });
});
