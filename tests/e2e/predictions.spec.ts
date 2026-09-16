import { expect, type Browser, type Page, test } from '@playwright/test';

import { TEST_AUTH_METHODS } from '../../imports/shared/auth/methods';
import {
  FIXTURE_METHODS,
  TEST_FIXTURE_METHODS,
} from '../../imports/shared/fixtures';
import { defaultFixturePredictionQuestionConfig } from '../../imports/shared/predictionQuestions';
import {
  PREDICTION_METHODS,
  TEST_PREDICTION_METHODS,
} from '../../imports/shared/predictions';
import type {
  BuiltInQuestionId,
  FixturePrediction,
} from '../../imports/shared/scoring';

const uniqueEmail = (label: string) =>
  `ccpp007-e2e-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;

const uniqueLabel = (label: string) =>
  `${label} ${Date.now().toString(36)}${Math.random().toString(16).slice(2, 6)}`;

const NAVIGATION_ATTEMPT_TIMEOUT_MS = 15_000;

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
    readonly disabledBuiltInQuestionIds?: readonly BuiltInQuestionId[];
  },
) => {
  const { disabledBuiltInQuestionIds, ...fixtureDetails } = details;

  return callMeteor<{ readonly fixtureId: string }>(
    page,
    TEST_FIXTURE_METHODS.createPublished,
    {
      ...(disabledBuiltInQuestionIds ? { disabledBuiltInQuestionIds } : {}),
      details: fixtureDetails,
    },
  );
};

const createPublishedCustomFixture = async (
  browser: Browser,
  setupPage: Page,
  details: {
    readonly competitionDisplayName: string;
    readonly scheduledKickoffAt: string;
    readonly team1DisplayName: string;
    readonly team2DisplayName: string;
    readonly venueDisplayName?: string;
  },
) => {
  const admin = await loginAsAdminPage(browser, setupPage);

  try {
    const created = await callMeteor<{ readonly fixtureId: string }>(
      admin.page,
      FIXTURE_METHODS.createDraft,
      {
        details,
      },
    );
    const config = {
      ...defaultFixturePredictionQuestionConfig(),
      optionalStandardQuestions:
        defaultFixturePredictionQuestionConfig().optionalStandardQuestions.map(
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
            'Scrum penalties awarded against the All Blacks during regulation match time. Free kicks do not count.',
          deductionPerUnit: 25,
          id: 'scrum-pressure',
          max: 12,
          min: 0,
          order: 1,
          prompt: 'How many scrum penalties will the All Blacks concede?',
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
    };
    const saved = await callMeteor<{ readonly revision: number }>(
      admin.page,
      FIXTURE_METHODS.saveQuestionConfig,
      {
        config,
        expectedRevision: 1,
        fixtureId: created.fixtureId,
      },
    );

    await callMeteor(admin.page, FIXTURE_METHODS.publish, {
      expectedRevision: saved.revision,
      fixtureId: created.fixtureId,
    });

    return {
      fixtureId: created.fixtureId,
      revision: saved.revision + 1,
    };
  } finally {
    await admin.close();
  }
};

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

const teamNumberInput = (page: Page, teamName: string, fieldName: string) =>
  page.getByRole('spinbutton', { name: `${teamName} ${fieldName}` });

const reviewSection = (page: Page, label: string) =>
  page.getByRole('group', { name: `Review ${label}` });

const saveRevisedPredictionButton = (page: Page) =>
  page.getByRole('button', { name: 'Save revised prediction' });

const continueButton = (page: Page) =>
  page.getByRole('button', { name: 'Continue' });

const backButton = (page: Page) => page.getByRole('button', { name: 'Back' });

const expectStep = async (page: Page, current: number, total = 9) => {
  await expect(page.getByText(`Step ${current} of ${total}`)).toBeVisible({
    timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS,
  });
};

const startPrediction = async (page: Page) => {
  await page.getByRole('button', { name: "Let's predict" }).click();
};

const chooseRadio = async (page: Page, name: string) => {
  await page.getByRole('radio', { name, exact: true }).check();
};

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

const fillValidSequentialPrediction = async (
  page: Page,
  teams: {
    readonly team1: string;
    readonly team2: string;
  },
) => {
  await startPrediction(page);
  await chooseRadio(page, teams.team1);
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

  await chooseRadio(page, teams.team1);
  await continueButton(page).click();

  await chooseRadio(page, 'Second Half');
  await continueButton(page).click();

  await chooseRadio(page, teams.team1);
  await page.getByRole('button', { name: 'Review predictions' }).click();
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
  test.describe.configure({ timeout: 60_000 });

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

  test('guides Intro, progress, navigation, and answer preservation', async ({
    page,
  }) => {
    const team1 = uniqueLabel('Springbokke');
    const team2 = uniqueLabel('Wallabies');
    const fixtureId = (
      await createPublishedFixture(page, {
        competitionDisplayName: 'Sequence Cup',
        scheduledKickoffAt: farFutureKickoff(),
        team1DisplayName: team1,
        team2DisplayName: team2,
      })
    ).fixtureId;

    await loginAsPlayer(page, 'sequence');
    await gotoLocal(page, predictionPath(fixtureId));

    await expect(
      page.getByRole('heading', { name: /Welcome to Rugby Rooster/ }),
    ).toBeVisible();
    await expect(page.getByText(/Step 1 of 9/)).toHaveCount(0);

    await startPrediction(page);
    await expectStep(page, 1);
    await chooseRadio(page, team1);
    await expect(page.getByText(`You picked ${team1}`)).toBeVisible();

    await continueButton(page).click();
    await expectStep(page, 2);
    const triesHeading = await page
      .getByRole('heading', { level: 2 })
      .innerText();
    await teamNumberInput(page, team1, 'tries').fill('4');

    await backButton(page).click();
    await expectStep(page, 1);
    await expect(page.getByRole('radio', { name: team1 })).toBeChecked();

    await continueButton(page).click();
    await expectStep(page, 2);
    await expect(teamNumberInput(page, team1, 'tries')).toHaveValue('4');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(
      triesHeading,
    );
  });

  test('updates running rugby scores and constrains conversion inputs', async ({
    page,
  }) => {
    const team1 = uniqueLabel('Boks');
    const team2 = uniqueLabel('Wallabies');
    const fixtureId = (
      await createPublishedFixture(page, {
        competitionDisplayName: 'Scoring Steps Cup',
        scheduledKickoffAt: farFutureKickoff(),
        team1DisplayName: team1,
        team2DisplayName: team2,
      })
    ).fixtureId;

    await loginAsPlayer(page, 'scoring');
    await gotoLocal(page, predictionPath(fixtureId));
    await startPrediction(page);
    await chooseRadio(page, team2);
    await continueButton(page).click();

    await teamNumberInput(page, team1, 'tries').fill('4');
    await expect(page.getByText('20', { exact: true })).toBeVisible();
    await teamNumberInput(page, team2, 'tries').fill('0');
    await continueButton(page).click();

    await expect(teamNumberInput(page, team2, 'conversions')).toBeDisabled();
    await expect(page.getByText('No tries to convert')).toBeVisible();
    await backButton(page).click();
    await teamNumberInput(page, team2, 'tries').fill('2');
    await continueButton(page).click();

    await teamNumberInput(page, team1, 'conversions').fill('3');
    await teamNumberInput(page, team2, 'conversions').fill('1');
    await expect(teamNumberInput(page, team1, 'conversions')).toHaveAttribute(
      'max',
      '4',
    );
    await expect(page.getByText('26', { exact: true })).toBeVisible();

    await backButton(page).click();
    await teamNumberInput(page, team1, 'tries').fill('2');
    await continueButton(page).click();
    await expect(teamNumberInput(page, team1, 'conversions')).toHaveValue('2');
    await expect(
      page.getByText('Conversions adjusted to match your predicted tries.'),
    ).toBeVisible();

    await continueButton(page).click();
    await teamNumberInput(page, team1, 'penalty kicks').fill('1');
    await teamNumberInput(page, team2, 'penalty kicks').fill('3');
    await expect(page.getByText('17', { exact: true })).toBeVisible();
    await expect(page.getByText('21', { exact: true })).toBeVisible();

    await continueButton(page).click();
    await teamNumberInput(page, team1, 'drop goals').fill('1');
    await expect(page.getByText('20', { exact: true })).toBeVisible();
  });

  test('warns after score-building steps when result and scores disagree', async ({
    page,
  }) => {
    const team1 = uniqueLabel('Sharks');
    const team2 = uniqueLabel('Lions');
    const fixtureId = (
      await createPublishedFixture(page, {
        competitionDisplayName: 'Consistency Cup',
        scheduledKickoffAt: farFutureKickoff(),
        team1DisplayName: team1,
        team2DisplayName: team2,
      })
    ).fixtureId;

    await loginAsPlayer(page, 'consistency');
    await gotoLocal(page, predictionPath(fixtureId));
    await startPrediction(page);
    await chooseRadio(page, team1);
    await continueButton(page).click();

    await teamNumberInput(page, team1, 'tries').fill('1');
    await teamNumberInput(page, team2, 'tries').fill('2');
    await continueButton(page).click();
    await teamNumberInput(page, team1, 'conversions').fill('1');
    await teamNumberInput(page, team2, 'conversions').fill('2');
    await continueButton(page).click();
    await teamNumberInput(page, team1, 'penalty kicks').fill('0');
    await teamNumberInput(page, team2, 'penalty kicks').fill('0');
    await expect(
      page.getByText("YOUR SCORES DON'T MATCH YOUR CHOSEN WINNER"),
    ).toHaveCount(0);

    await continueButton(page).click();
    await teamNumberInput(page, team1, 'drop goals').fill('0');
    await teamNumberInput(page, team2, 'drop goals').fill('0');
    await expect(
      page.getByText("YOUR SCORES DON'T MATCH YOUR CHOSEN WINNER"),
    ).toBeVisible();
    await expect(
      page.getByText(
        `You picked ${team1} to win, but your scores put ${team2} ahead.`,
      ),
    ).toBeVisible();
    await expect(continueButton(page)).toBeDisabled();
    await expect(backButton(page)).toBeEnabled();
    await expect(
      page.getByRole('button', { name: 'Edit match result' }),
    ).toBeEnabled();
    await expect(
      page.getByRole('button', { name: 'Edit scores' }),
    ).toBeEnabled();

    await page.getByRole('button', { name: 'Edit match result' }).click();
    await chooseRadio(page, team2);
    await expect(
      page.getByText("YOUR SCORES DON'T MATCH YOUR CHOSEN WINNER"),
    ).toHaveCount(0);
    await expect(continueButton(page)).toBeEnabled();

    await chooseRadio(page, 'Draw');
    await continueButton(page).click();
    await continueButton(page).click();
    await continueButton(page).click();
    await continueButton(page).click();
    await expect(
      page.getByText(`You picked Draw, but your scores put ${team2} ahead.`),
    ).toBeVisible();
    await expect(continueButton(page)).toBeDisabled();

    await page.getByRole('button', { name: 'Edit scores' }).click();
    await teamNumberInput(page, team1, 'tries').fill('2');
    await continueButton(page).click();
    await teamNumberInput(page, team1, 'conversions').fill('2');
    await continueButton(page).click();
    await continueButton(page).click();
    await expect(
      page.getByText("YOUR SCORES DON'T MATCH YOUR CHOSEN WINNER"),
    ).toHaveCount(0);
    await expect(continueButton(page)).toBeEnabled();
  });

  test('blocks Continue when a selected winner conflicts with a drawn score', async ({
    page,
  }) => {
    const team1 = uniqueLabel('Springboks');
    const team2 = uniqueLabel('Wallabies');
    const fixtureId = (
      await createPublishedFixture(page, {
        competitionDisplayName: 'Draw Consistency Cup',
        scheduledKickoffAt: farFutureKickoff(),
        team1DisplayName: team1,
        team2DisplayName: team2,
      })
    ).fixtureId;

    await loginAsPlayer(page, 'draw-consistency');
    await gotoLocal(page, predictionPath(fixtureId));
    await startPrediction(page);
    await chooseRadio(page, team1);
    await continueButton(page).click();

    await teamNumberInput(page, team1, 'tries').fill('1');
    await teamNumberInput(page, team2, 'tries').fill('1');
    await continueButton(page).click();
    await teamNumberInput(page, team1, 'conversions').fill('1');
    await teamNumberInput(page, team2, 'conversions').fill('1');
    await continueButton(page).click();
    await teamNumberInput(page, team1, 'penalty kicks').fill('0');
    await teamNumberInput(page, team2, 'penalty kicks').fill('0');
    await continueButton(page).click();
    await teamNumberInput(page, team1, 'drop goals').fill('0');
    await teamNumberInput(page, team2, 'drop goals').fill('0');

    await expect(
      page.getByText(
        `You picked ${team1} to win, but your scores predict a draw.`,
      ),
    ).toBeVisible();
    await expect(continueButton(page)).toBeDisabled();

    await page.getByRole('button', { name: 'Edit match result' }).click();
    await chooseRadio(page, 'Draw');
    await expect(
      page.getByText("YOUR SCORES DON'T MATCH YOUR CHOSEN WINNER"),
    ).toHaveCount(0);
    await expect(continueButton(page)).toBeEnabled();
  });

  test('applies first-try constraints from predicted tries', async ({
    page,
  }) => {
    const team1 = uniqueLabel('Scarlets');
    const team2 = uniqueLabel('Ospreys');
    const fixtureId = (
      await createPublishedFixture(page, {
        competitionDisplayName: 'First Try Cup',
        scheduledKickoffAt: farFutureKickoff(),
        team1DisplayName: team1,
        team2DisplayName: team2,
      })
    ).fixtureId;

    await loginAsPlayer(page, 'first-try');
    await gotoLocal(page, predictionPath(fixtureId));
    await startPrediction(page);
    await chooseRadio(page, 'Draw');
    await continueButton(page).click();
    await continueButton(page).click();
    await continueButton(page).click();
    await continueButton(page).click();
    await continueButton(page).click();
    await continueButton(page).click();

    await expect(
      page.getByRole('radio', { name: 'No Tries Today!' }),
    ).toBeChecked();
    await expect(page.getByRole('radio', { name: team1 })).toBeDisabled();
    await expect(page.getByRole('radio', { name: team2 })).toBeDisabled();
    await expect(
      page.getByText('Based on your predicted tries.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Edit tries' }).click();
    await teamNumberInput(page, team1, 'tries').fill('1');
    await continueButton(page).click();
    await continueButton(page).click();
    await continueButton(page).click();
    await expect(
      page.getByText(`You picked Draw, but your scores put ${team1} ahead.`),
    ).toBeVisible();
    await expect(continueButton(page)).toBeDisabled();

    await page.getByRole('button', { name: 'Edit match result' }).click();
    await chooseRadio(page, team1);
    await continueButton(page).click();
    await continueButton(page).click();
    await continueButton(page).click();
    await continueButton(page).click();
    await continueButton(page).click();
    await continueButton(page).click();
    await expect(page.getByRole('radio', { name: team1 })).toBeChecked();
    await expect(
      page.getByRole('radio', { name: 'No Tries Today!' }),
    ).toBeDisabled();
  });

  test('hides inactive Review sections when card and optional questions are disabled', async ({
    page,
  }) => {
    const team1 = uniqueLabel('Cheetahs');
    const team2 = uniqueLabel('Pumas');
    const fixtureId = (
      await createPublishedFixture(page, {
        competitionDisplayName: 'Ruleset Review Cup',
        disabledBuiltInQuestionIds: [
          'yellow-cards',
          'red-cards',
          'first-try',
          'highest-scoring-half',
          'half-time-leader',
        ],
        scheduledKickoffAt: farFutureKickoff(),
        team1DisplayName: team1,
        team2DisplayName: team2,
      })
    ).fixtureId;

    await loginAsPlayer(page, 'ruleset-review-disabled');
    await gotoLocal(page, predictionPath(fixtureId));
    await startPrediction(page);
    await expectStep(page, 1, 5);
    await chooseRadio(page, team1);
    await continueButton(page).click();

    await teamNumberInput(page, team1, 'tries').fill('1');
    await teamNumberInput(page, team2, 'tries').fill('0');
    await continueButton(page).click();
    await teamNumberInput(page, team1, 'conversions').fill('1');
    await continueButton(page).click();
    await teamNumberInput(page, team1, 'penalty kicks').fill('0');
    await teamNumberInput(page, team2, 'penalty kicks').fill('0');
    await continueButton(page).click();
    await expectStep(page, 5, 5);
    await teamNumberInput(page, team1, 'drop goals').fill('0');
    await teamNumberInput(page, team2, 'drop goals').fill('0');
    await page.getByRole('button', { name: 'Review predictions' }).click();

    await expect(reviewSection(page, 'MATCH RESULT')).toContainText(team1);
    await expect(reviewSection(page, 'CARDS')).toHaveCount(0);
    await expect(reviewSection(page, 'OTHER PREDICTIONS')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Edit first try' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Edit highest-scoring half' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Edit half-time leader' }),
    ).toHaveCount(0);
  });

  test('shows only enabled card rows and deduction copy for partial card enablement', async ({
    page,
  }) => {
    const team1 = uniqueLabel('Griquas');
    const team2 = uniqueLabel('Griffons');
    const fixtureId = (
      await createPublishedFixture(page, {
        competitionDisplayName: 'Partial Cards Cup',
        disabledBuiltInQuestionIds: ['yellow-cards'],
        scheduledKickoffAt: farFutureKickoff(),
        team1DisplayName: team1,
        team2DisplayName: team2,
      })
    ).fixtureId;

    await loginAsPlayer(page, 'partial-cards');
    await gotoLocal(page, predictionPath(fixtureId));
    await startPrediction(page);
    await chooseRadio(page, team1);
    await continueButton(page).click();

    await teamNumberInput(page, team1, 'tries').fill('2');
    await teamNumberInput(page, team2, 'tries').fill('1');
    await continueButton(page).click();
    await teamNumberInput(page, team1, 'conversions').fill('2');
    await teamNumberInput(page, team2, 'conversions').fill('1');
    await continueButton(page).click();
    await teamNumberInput(page, team1, 'penalty kicks').fill('0');
    await teamNumberInput(page, team2, 'penalty kicks').fill('0');
    await continueButton(page).click();
    await teamNumberInput(page, team1, 'drop goals').fill('0');
    await teamNumberInput(page, team2, 'drop goals').fill('0');
    await continueButton(page).click();

    await expect(
      page.getByText('Red cards deduct 200 points per difference.'),
    ).toBeVisible();
    await expect(
      page.getByText('Yellow cards deduct 200 points per difference.'),
    ).toHaveCount(0);
    await expect(teamNumberInput(page, team1, 'yellow cards')).toHaveCount(0);
    await expect(teamNumberInput(page, team2, 'yellow cards')).toHaveCount(0);
    await teamNumberInput(page, team1, 'red cards').fill('1');
    await teamNumberInput(page, team2, 'red cards').fill('0');
    await continueButton(page).click();

    await chooseRadio(page, team1);
    await continueButton(page).click();
    await chooseRadio(page, 'Second Half');
    await continueButton(page).click();
    await chooseRadio(page, 'Half-time Draw');
    await page.getByRole('button', { name: 'Review predictions' }).click();

    await expect(reviewSection(page, 'CARDS')).toContainText(team1);
    await expect(reviewSection(page, 'CARDS')).toContainText(team2);
    await expect(reviewSection(page, 'CARDS')).toContainText('Red');
    await expect(reviewSection(page, 'CARDS').getByText('Yellow')).toHaveCount(
      0,
    );
    await expect(reviewSection(page, 'OTHER PREDICTIONS')).toContainText(
      'Half-time Draw',
    );
  });

  test('submits valid predictions and revisits the saved Review', async ({
    page,
  }) => {
    const team1 = uniqueLabel('Munster');
    const team2 = uniqueLabel('Leinster');
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
    await fillValidSequentialPrediction(page, { team1, team2 });
    await submitForm(page, 'Submit prediction');

    await expect(page.getByRole('status')).toContainText('Prediction saved.');
    await expect(saveRevisedPredictionButton(page)).toBeVisible();
    await expect(reviewSection(page, 'PREDICTED SCORE')).toContainText(team1);
    await expect(reviewSection(page, 'PREDICTED SCORE')).toContainText('17');
    await expect(reviewSection(page, 'PREDICTED SCORE')).toContainText('10');

    await gotoLocal(page, predictionPath(fixtureId));
    await expect(saveRevisedPredictionButton(page)).toBeVisible({
      timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS,
    });
    await expect(reviewSection(page, 'MATCH RESULT')).toContainText(team1);
    await reviewSection(page, 'SCORING DETAIL')
      .getByRole('button', { name: 'Edit' })
      .click();
    await expectStep(page, 2);
    await expect(teamNumberInput(page, team1, 'tries')).toHaveValue('2');
  });

  test('answers custom Number and Choice questions in the standard sequence', async ({
    browser,
    page,
  }) => {
    const team1 = uniqueLabel('Springboks');
    const team2 = uniqueLabel('All Blacks');
    const fixtureDetails = {
      competitionDisplayName: 'Custom Question Cup',
      scheduledKickoffAt: farFutureKickoff(),
      team1DisplayName: team1,
      team2DisplayName: team2,
    };
    const { fixtureId, revision } = await createPublishedCustomFixture(
      browser,
      page,
      fixtureDetails,
    );
    const numberPrompt =
      'How many scrum penalties will the All Blacks concede?';
    const choicePrompt = 'Which group produces the player of the match?';
    const customNumberInput = page.getByRole('spinbutton', {
      name: `${numberPrompt} answer`,
    });

    await loginAsPlayer(page, 'custom-sequence');
    await gotoLocal(page, predictionPath(fixtureId));
    await startPrediction(page);
    await expectStep(page, 1, 10);
    await chooseRadio(page, team1);
    await continueButton(page).click();

    await teamNumberInput(page, team1, 'tries').fill('2');
    await teamNumberInput(page, team2, 'tries').fill('1');
    await continueButton(page).click();
    await teamNumberInput(page, team1, 'conversions').fill('2');
    await teamNumberInput(page, team2, 'conversions').fill('1');
    await continueButton(page).click();
    await teamNumberInput(page, team1, 'penalty kicks').fill('1');
    await teamNumberInput(page, team2, 'penalty kicks').fill('1');
    await continueButton(page).click();
    await teamNumberInput(page, team1, 'drop goals').fill('0');
    await teamNumberInput(page, team2, 'drop goals').fill('0');
    await continueButton(page).click();
    await teamNumberInput(page, team1, 'yellow cards').fill('1');
    await teamNumberInput(page, team1, 'red cards').fill('0');
    await teamNumberInput(page, team2, 'yellow cards').fill('0');
    await teamNumberInput(page, team2, 'red cards').fill('0');
    await continueButton(page).click();

    await expectStep(page, 7, 10);
    await chooseRadio(page, 'Second Half');
    await continueButton(page).click();
    await expectStep(page, 8, 10);
    await chooseRadio(page, team1);
    await continueButton(page).click();

    await expectStep(page, 9, 10);
    await expect(
      page.getByRole('heading', { name: numberPrompt }),
    ).toBeVisible();
    await expect(page.getByText('Set-piece heat check.')).toBeVisible();
    await expect(
      page.getByText(
        'You lose 25 points for every unit your prediction is above or below the actual result.',
      ),
    ).toBeVisible();
    await expect(page.getByText('What counts')).toBeVisible();
    await expect(
      page.getByText(
        'Scrum penalties awarded against the All Blacks during regulation match time. Free kicks do not count.',
      ),
    ).toBeVisible();
    await expect(continueButton(page)).toBeDisabled();
    await customNumberInput.fill('4');
    await continueButton(page).click();

    await expectStep(page, 10, 10);
    await expect(
      page.getByRole('heading', { name: choicePrompt }),
    ).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Backs' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Forwards' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Review predictions' }),
    ).toBeDisabled();
    await chooseRadio(page, 'Forwards');
    await page.getByRole('button', { name: 'Review predictions' }).click();

    await expect(reviewSection(page, 'OTHER PREDICTIONS')).not.toContainText(
      'First try',
    );
    await expect(reviewSection(page, 'CUSTOM QUESTIONS')).toContainText(
      numberPrompt,
    );
    await expect(reviewSection(page, 'CUSTOM QUESTIONS')).toContainText('4');
    await expect(reviewSection(page, 'CUSTOM QUESTIONS')).toContainText(
      choicePrompt,
    );
    await expect(reviewSection(page, 'CUSTOM QUESTIONS')).toContainText(
      'Forwards',
    );
    await submitForm(page, 'Submit prediction');
    await expect(page.getByRole('status')).toContainText('Prediction saved.');

    await gotoLocal(page, predictionPath(fixtureId));
    await expect(saveRevisedPredictionButton(page)).toBeVisible({
      timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS,
    });
    await expect(reviewSection(page, 'CUSTOM QUESTIONS')).toContainText('4');
    await expect(reviewSection(page, 'CUSTOM QUESTIONS')).toContainText(
      'Forwards',
    );

    await reviewSection(page, 'CUSTOM QUESTIONS')
      .getByRole('button', { name: 'Edit custom question' })
      .first()
      .click();
    await expectStep(page, 9, 10);
    await customNumberInput.fill('6');
    await page.getByRole('button', { name: 'Return to Review' }).click();
    await expect(reviewSection(page, 'CUSTOM QUESTIONS')).toContainText('6');
    await submitForm(page, 'Save revised prediction');
    await expect(page.getByRole('status')).toContainText('Prediction updated.');

    await reviewSection(page, 'CUSTOM QUESTIONS')
      .getByRole('button', { name: 'Edit custom question' })
      .first()
      .click();
    await customNumberInput.fill('9');
    await page.getByRole('button', { name: 'Return to Review' }).click();
    await expect(reviewSection(page, 'CUSTOM QUESTIONS')).toContainText('9');

    const admin = await loginAsAdminPage(browser, page);

    try {
      await callMeteor(admin.page, FIXTURE_METHODS.editDetails, {
        details: {
          ...fixtureDetails,
          scheduledKickoffAt: nearFutureKickoff(),
        },
        expectedRevision: revision,
        fixtureId,
      });
    } finally {
      await admin.close();
    }

    await expect(page.getByText('Scheduled kickoff has passed')).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      reviewSection(page, 'CUSTOM QUESTIONS').getByRole('button', {
        name: 'Edit custom question',
      }),
    ).toHaveCount(0);
    await expect(reviewSection(page, 'CUSTOM QUESTIONS')).toContainText('6');
    await expect(reviewSection(page, 'CUSTOM QUESTIONS')).toContainText(
      'Forwards',
    );
    await expect(reviewSection(page, 'CUSTOM QUESTIONS')).not.toContainText(
      '9',
    );
  });

  test('edits a saved prediction before kickoff while preserving other answers', async ({
    page,
  }) => {
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
    await fillValidSequentialPrediction(page, { team1, team2 });
    await submitForm(page, 'Submit prediction');
    await expect(
      page.getByText('This revision started from saved entry revision 1.'),
    ).toBeVisible({
      timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS,
    });

    await reviewSection(page, 'SCORING DETAIL')
      .getByRole('button', { name: 'Edit' })
      .click();
    await teamNumberInput(page, team2, 'tries').fill('2');
    await page.getByRole('button', { name: 'Return to Review' }).click();
    await expect(reviewSection(page, 'OTHER PREDICTIONS')).toContainText(
      'Second half',
    );
    await submitForm(page, 'Save revised prediction');

    await expect(page.getByRole('status')).toContainText('Prediction updated.');
    await expect(
      page.getByText('This revision started from saved entry revision 2.'),
    ).toBeVisible({
      timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS,
    });
    await gotoLocal(page, predictionPath(fixtureId));
    await reviewSection(page, 'SCORING DETAIL')
      .getByRole('button', { name: 'Edit' })
      .click();
    await expect(teamNumberInput(page, team2, 'tries')).toHaveValue('2');
  });

  test('shows persisted saved entry after dirty local values lock at kickoff', async ({
    browser,
    page,
  }) => {
    const team1 = uniqueLabel('Cardiff');
    const team2 = uniqueLabel('Dragons');
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
    await fillValidSequentialPrediction(page, { team1, team2 });
    await submitForm(page, 'Submit prediction');
    await expect(page.getByRole('status')).toContainText('Prediction saved.');
    await gotoLocal(page, predictionPath(fixtureId));
    await expect(saveRevisedPredictionButton(page)).toBeVisible({
      timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS,
    });
    await expect(reviewSection(page, 'PREDICTED SCORE')).toContainText('17');

    await reviewSection(page, 'SCORING DETAIL')
      .getByRole('button', { name: 'Edit' })
      .click();
    await teamNumberInput(page, team1, 'tries').fill('3');
    await page.getByRole('button', { name: 'Return to Review' }).click();
    await expect(reviewSection(page, 'PREDICTED SCORE')).toContainText('22');

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
    await expect(saveRevisedPredictionButton(page)).toHaveCount(0);
    await expect(reviewSection(page, 'PREDICTED SCORE')).toContainText('17');
    await expect(page.getByText('22')).toHaveCount(0);
  });

  test('preserves unsaved answers after a stale revision conflict', async ({
    page,
  }) => {
    const team1 = uniqueLabel('Ulster');
    const team2 = uniqueLabel('Connacht');
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
    await fillValidSequentialPrediction(page, { team1, team2 });
    await submitForm(page, 'Submit prediction');

    await reviewSection(page, 'OTHER PREDICTIONS')
      .getByRole('button', { name: 'Edit highest-scoring half' })
      .click();
    await chooseRadio(page, 'First Half');
    await continueButton(page).click();
    await page.getByRole('button', { name: 'Review predictions' }).click();

    await callMeteor(page, PREDICTION_METHODS.submit, {
      expectedRevision: 1,
      fixtureId,
      prediction: {
        ...validPrediction(),
        halfTimeLeader: 'draw',
      },
    });

    await submitForm(page, 'Save revised prediction');

    await expect(page.getByRole('alert')).toContainText(
      'This prediction changed before your update could be saved.',
    );
    await expect(reviewSection(page, 'OTHER PREDICTIONS')).toContainText(
      'First half',
    );
    await expect(
      page.getByText('This form still uses revision 1'),
    ).toBeVisible();
  });
});
