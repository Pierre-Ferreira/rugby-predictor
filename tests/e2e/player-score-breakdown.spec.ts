import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';

import { TEST_AUTH_METHODS } from '../../imports/shared/auth/methods';
import { TEST_FIXTURE_METHODS } from '../../imports/shared/fixtures';
import {
  MATCH_RESULT_METHODS,
  TEST_MATCH_RESULT_METHODS,
} from '../../imports/shared/matchResults';
import {
  PREDICTION_METHODS,
  TEST_PREDICTION_METHODS,
} from '../../imports/shared/predictions';
import { defaultFixturePredictionQuestionConfig } from '../../imports/shared/predictionQuestions';

const uniqueEmail = (label: string) =>
  `ccpp011c-e2e-${label}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}@example.test`;

const NAVIGATION_ATTEMPT_TIMEOUT_MS = 15_000;
const evidenceDir = path.resolve(
  process.env.RUGBY_ROOSTER_E2E_EVIDENCE_DIR ??
    'test-results/ccpp011c-player-score-breakdown',
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

const createPublishedScoreFixture = async (page: Page) =>
  callMeteor<{ readonly fixtureId: string }>(
    page,
    TEST_FIXTURE_METHODS.createPublished,
    {
      details: {
        competitionDisplayName: 'Score Breakdown Cup',
        scheduledKickoffAt: '2098-09-20T13:00:00.000Z',
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
            banter: 'Maul Watch',
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

const submitPlayerPrediction = async (page: Page, fixtureId: string) => {
  await callMeteor(page, PREDICTION_METHODS.submit, {
    fixtureId,
    prediction: {
      customAnswers: {
        'maul-first': 'maul-boks',
        'scrum-pressure': 4,
      },
      firstTry: 'team1',
      halfTimeLeader: 'team1',
      highestScoringHalf: 'second',
      matchResult: 'team1',
      team1: {
        conversions: 3,
        dropGoals: 0,
        penaltyKicks: 1,
        redCards: 0,
        tries: 4,
        yellowCards: 0,
      },
      team2: {
        conversions: 3,
        dropGoals: 0,
        penaltyKicks: 0,
        redCards: 0,
        tries: 3,
        yellowCards: 0,
      },
    },
  });
};

const observed = <T>(value: T, status = 'provisional') => ({
  status,
  value,
});

const pending = () => ({ status: 'pending' });

const provisionalObservations = () => ({
  customAnswers: {
    'maul-first': pending(),
    'scrum-pressure': observed(6),
  },
  firstTry: observed('team1'),
  halfTimeLeader: observed('draw'),
  highestScoringHalf: pending(),
  matchStatus: 'provisional',
  team1: {
    conversions: observed(3),
    dropGoals: observed(0),
    penaltyKicks: observed(1),
    redCards: observed(0),
    tries: observed(5),
    yellowCards: observed(1),
  },
  team2: {
    conversions: observed(3),
    dropGoals: observed(0),
    penaltyKicks: observed(0),
    redCards: pending(),
    tries: pending(),
    yellowCards: observed(0),
  },
});

const correctedObservations = (matchStatus = 'provisional') => ({
  customAnswers: {
    'maul-first': pending(),
    'scrum-pressure': observed(6, matchStatus),
  },
  firstTry: observed('team1', matchStatus),
  halfTimeLeader: observed('draw', matchStatus),
  highestScoringHalf: observed('equal', matchStatus),
  matchStatus,
  team1: {
    conversions: observed(3, matchStatus),
    dropGoals: observed(0, matchStatus),
    penaltyKicks: observed(1, matchStatus),
    redCards: observed(0, matchStatus),
    tries: observed(4, matchStatus),
    yellowCards: observed(1, matchStatus),
  },
  team2: {
    conversions: observed(3, matchStatus),
    dropGoals: observed(0, matchStatus),
    penaltyKicks: observed(0, matchStatus),
    redCards: observed(0, matchStatus),
    tries: observed(3, matchStatus),
    yellowCards: observed(0, matchStatus),
  },
});

const finalObservations = () => ({
  ...correctedObservations('confirmed'),
  customAnswers: {
    'maul-first': { status: 'void' },
    'scrum-pressure': observed(6, 'confirmed'),
  },
});

const expectNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));

  expect(overflow.documentScrollWidth).toBeLessThanOrEqual(
    overflow.viewportWidth,
  );
  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.viewportWidth);
};

const screenshotPath = (name: string): string => {
  mkdirSync(evidenceDir, { recursive: true });

  return path.join(evidenceDir, `${name}.png`);
};

const sectionByHeading = (page: Page, heading: string) =>
  page
    .getByRole('heading', { name: heading })
    .locator('xpath=ancestor::section[1]');

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

test.describe('player score breakdown', () => {
  test.describe.configure({ timeout: 90_000 });

  test('renders provisional, correction, final, Void, and mobile states', async ({
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

    const { fixtureId } = await createPublishedScoreFixture(page);

    await submitPlayerPrediction(page, fixtureId);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    try {
      await gotoLocal(adminPage, '/');
      await loginWithTestToken(adminPage, adminEmail);
      const started = await callMeteor<{ readonly revision: number }>(
        adminPage,
        MATCH_RESULT_METHODS.startResultTracking,
        {
          fixtureId,
        },
      );
      const provisional = await callMeteor<{ readonly revision: number }>(
        adminPage,
        MATCH_RESULT_METHODS.saveProvisional,
        {
          expectedRevision: started.revision,
          fixtureId,
          observations: provisionalObservations(),
        },
      );

      await gotoLocal(page, `/games/${fixtureId}/my-score`);

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Springboks vs All Blacks',
        }),
      ).toBeVisible();
      await expect(page.getByText('If it ended now')).toBeVisible();
      await expect(page.getByText('9,100 pts')).toBeVisible();
      await expect(page.getByText('Starting points')).toBeVisible();
      await expect(page.getByText('-900')).toBeVisible();
      await expect(
        page.getByText('Some predictions are still pending.'),
      ).toBeVisible();
      await expect(page.getByText('No deduction').first()).toBeVisible();
      await expect(page.getByText('-50')).toBeVisible();

      const triesSection = sectionByHeading(page, 'Tries');

      await expect(triesSection).toContainText('1 pending');
      await expect(triesSection).toContainText('Springboks');
      await expect(triesSection).toContainText('-50');
      await expect(triesSection).toContainText('All Blacks');
      await expect(triesSection).toContainText('Pending');

      await page.screenshot({
        fullPage: true,
        path: screenshotPath('provisional-desktop-score-breakdown'),
      });
      await triesSection.screenshot({
        path: screenshotPath('partially-pending-tries-section'),
      });
      await page
        .locator('article', { hasText: '-50' })
        .first()
        .screenshot({
          path: screenshotPath('deduction-row'),
        });

      await callMeteor(adminPage, MATCH_RESULT_METHODS.saveProvisional, {
        expectedRevision: provisional.revision,
        fixtureId,
        observations: correctedObservations(),
      });
      await page.getByRole('button', { name: 'Refresh' }).click();
      await expect(page.getByText('9,000 pts')).toBeVisible();
      await expect(triesSection).toContainText('No deduction');
      await expect(triesSection.getByText('-50')).toHaveCount(0);
      await expect(page.getByText('1 pending')).toBeVisible();

      await callMeteor(adminPage, MATCH_RESULT_METHODS.confirmFinal, {
        expectedRevision: provisional.revision + 1,
        fixtureId,
        observations: finalObservations(),
      });
      await page.getByRole('button', { name: 'Refresh' }).click();
      await expect(page.getByText('Final Score')).toBeVisible();
      await expect(page.getByText('Pending')).toHaveCount(0);
      await expect(page.getByText('Total deductions')).toBeVisible();

      const voidSection = sectionByHeading(page, 'Maul Watch');

      await expect(voidSection).toContainText('Void');
      await expect(voidSection).toContainText('No deduction');
      await voidSection.screenshot({
        path: screenshotPath('custom-void-section'),
      });
      await page.screenshot({
        fullPage: true,
        path: screenshotPath('final-desktop-score-breakdown'),
      });

      await page.setViewportSize({ width: 390, height: 900 });
      await expect(page.getByText('Final Score')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        fullPage: true,
        path: screenshotPath('mobile-390'),
      });

      await page.setViewportSize({ width: 360, height: 900 });
      await expect(page.getByText('Final Score')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        fullPage: true,
        path: screenshotPath('mobile-360'),
      });
    } finally {
      await adminContext.close();
    }
  });
});
