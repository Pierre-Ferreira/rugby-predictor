import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';

import { TEST_AUTH_METHODS } from '../../imports/shared/auth/methods';
import { TEST_FIXTURE_METHODS } from '../../imports/shared/fixtures';
import { TEST_MATCH_RESULT_METHODS } from '../../imports/shared/matchResults';
import {
  PREDICTION_METHODS,
  TEST_PREDICTION_METHODS,
} from '../../imports/shared/predictions';
import { defaultFixturePredictionQuestionConfig } from '../../imports/shared/predictionQuestions';

const uniqueEmail = (label: string) =>
  `ccpp011d-e2e-${label}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}@example.test`;

const NAVIGATION_ATTEMPT_TIMEOUT_MS = 15_000;
const evidenceDir = path.resolve(
  process.env.RUGBY_ROOSTER_E2E_EVIDENCE_DIR ??
    'test-results/ccpp011d-live-result-initialization',
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

  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
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
      return;
    } catch (error) {
      lastError = error;

      if (!isTransientLocalNavigationError(error)) {
        throw error;
      }

      await waitForMeteorClient(page);
    }
  }

  throw lastError;
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
        competitionDisplayName: 'Live Result Cup',
        scheduledKickoffAt: '2098-11-20T13:00:00.000Z',
        team1DisplayName: 'Springboks',
        team2DisplayName: 'All Blacks',
        venueDisplayName: 'Loopback Stadium',
      },
      questionConfig: {
        ...defaultFixturePredictionQuestionConfig(),
        customQuestions: [
          {
            answerType: 'number' as const,
            countingDefinition:
              'Scrum penalties awarded against the All Blacks in regulation time.',
            deductionPerUnit: 150,
            id: 'scrum-pressure',
            max: 12,
            min: 0,
            order: 1,
            prompt: 'How many scrum penalties will the All Blacks concede?',
          },
          {
            answerType: 'choice' as const,
            countingDefinition: 'First maul score source settled by officials.',
            id: 'maul-first',
            incorrectDeduction: 200,
            options: [
              { id: 'maul-boks', label: 'Springboks' },
              { id: 'maul-blacks', label: 'All Blacks' },
            ],
            order: 2,
            prompt: 'Which team scores from a maul first?',
          },
        ],
      },
    },
  );

const submitPrediction = async (page: Page, fixtureId: string) => {
  await callMeteor(page, PREDICTION_METHODS.submit, {
    fixtureId,
    prediction: {
      customAnswers: {
        'maul-first': 'maul-boks',
        'scrum-pressure': 4,
      },
      firstTry: 'team1',
      halfTimeLeader: 'team1',
      highestScoringHalf: 'first',
      matchResult: 'team1',
      team1: {
        conversions: 1,
        dropGoals: 0,
        penaltyKicks: 1,
        redCards: 1,
        tries: 1,
        yellowCards: 1,
      },
      team2: {
        conversions: 0,
        dropGoals: 0,
        penaltyKicks: 0,
        redCards: 0,
        tries: 0,
        yellowCards: 0,
      },
    },
  });
};

const numberInput = (page: Page, label: string) =>
  page.getByRole('spinbutton', { name: label });

const sectionByHeading = (page: Page, heading: string) =>
  page
    .getByRole('heading', { name: heading })
    .locator('xpath=ancestor::section[1]');

const screenshotPath = (name: string): string => {
  mkdirSync(evidenceDir, { recursive: true });

  return path.join(evidenceDir, `${name}.png`);
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

test.describe('live result initialization', () => {
  test.describe.configure({ timeout: 90_000 });

  test('starts live result tracking at zero and updates player scoring views', async ({
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

    await submitPrediction(page, fixtureId);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    try {
      await gotoLocal(adminPage, '/');
      await loginWithTestToken(adminPage, adminEmail);
      await gotoLocal(adminPage, `/admin/fixtures/${fixtureId}/results`);

      await expect(
        adminPage.getByRole('heading', {
          level: 1,
          name: 'Springboks vs All Blacks',
        }),
      ).toBeVisible();
      await expect(
        adminPage.getByRole('heading', {
          name: "Result tracking hasn't started.",
        }),
      ).toBeVisible();
      await expect(adminPage.getByRole('spinbutton')).toHaveCount(0);
      await adminPage.screenshot({
        fullPage: true,
        path: screenshotPath('admin-pre-start'),
      });
      await adminPage.bringToFront();

      const startButton = adminPage.getByRole('button', {
        name: 'Start result tracking',
      });

      await expect(startButton).toBeEnabled();
      await startButton.scrollIntoViewIfNeeded();
      await startButton.click({ force: true });
      await expect(
        adminPage.getByText('Live result tracking started.'),
      ).toBeVisible();
      await expect(
        adminPage.getByRole('heading', { name: 'Derived rugby score' }),
      ).toBeVisible();

      for (const label of [
        'tries',
        'conversions',
        'successful penalty kicks',
        'drop goals',
        'yellow cards',
        'red cards',
      ]) {
        await expect(numberInput(adminPage, `Springboks ${label}`)).toHaveValue(
          '0',
        );
        await expect(numberInput(adminPage, `All Blacks ${label}`)).toHaveValue(
          '0',
        );
      }

      const derivedScorePanel = sectionByHeading(
        adminPage,
        'Derived rugby score',
      );

      await expect(derivedScorePanel).toContainText('Springboks');
      await expect(derivedScorePanel).toContainText('All Blacks');
      await expect(derivedScorePanel).toContainText('0');
      await expect(derivedScorePanel).toContainText('Draw');
      await expect(adminPage.getByLabel('First try')).toHaveValue('');
      await expect(adminPage.getByLabel('Highest-scoring half')).toHaveValue(
        '',
      );
      await expect(adminPage.getByLabel('Half-time leader')).toHaveValue('');
      await expect(
        adminPage.getByLabel('Official observed result'),
      ).toHaveValue('');
      await adminPage.screenshot({
        fullPage: true,
        path: screenshotPath('admin-zero-initialized'),
      });

      await gotoLocal(page, `/games/${fixtureId}/my-score`);

      await expect(page.getByText('If it ended now')).toBeVisible();

      for (const heading of [
        'Tries',
        'Conversions',
        'Penalty Kicks',
        'Drop Goals',
      ]) {
        const section = sectionByHeading(page, heading);

        await expect(section).toContainText('Springboks');
        await expect(section).toContainText('All Blacks');
        await expect(section).toContainText('Actual');
        await expect(section).toContainText('0');
      }

      await expect(sectionByHeading(page, 'Cards')).toContainText('0');
      await expect(sectionByHeading(page, 'First Try')).toContainText(
        'Pending',
      );
      await expect(
        page.getByText('How many scrum penalties will the All Blacks concede?'),
      ).toBeVisible();
      await expect(
        sectionByHeading(page, 'Custom Question').first(),
      ).toContainText('Pending');
      await page.screenshot({
        fullPage: true,
        path: screenshotPath('player-my-score-zero-actuals'),
      });

      await gotoLocal(page, `/games/${fixtureId}/leaderboard`);

      await expect(page.getByText('If it ended now')).toBeVisible();
      await expect(page.locator('tbody tr')).toHaveCount(1);
      await expect(page.locator('tbody tr').first()).toContainText('You');
      await expect(page.locator('tbody tr').first()).toContainText('pending');
      await page.screenshot({
        fullPage: true,
        path: screenshotPath('player-leaderboard-zero-provisional'),
      });

      await numberInput(adminPage, 'Springboks tries').fill('1');
      await numberInput(adminPage, 'Springboks conversions').fill('1');
      await adminPage
        .getByRole('button', { name: 'Save provisional result' })
        .click();
      await expect(
        adminPage.getByText('Provisional result saved.'),
      ).toBeVisible();
      await expect(numberInput(adminPage, 'Springboks tries')).toHaveValue('1');
      await expect(derivedScorePanel).toContainText('7');
      await expect(derivedScorePanel).not.toContainText('Draw');
    } finally {
      await adminContext.close();
    }
  });
});
