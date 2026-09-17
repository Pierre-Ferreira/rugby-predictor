import { expect, type Page, test } from '@playwright/test';

import { TEST_AUTH_METHODS } from '../../imports/shared/auth/methods';
import {
  FIXTURE_METHODS,
  TEST_FIXTURE_METHODS,
} from '../../imports/shared/fixtures';
import {
  MATCH_RESULT_METHODS,
  TEST_MATCH_RESULT_METHODS,
} from '../../imports/shared/matchResults';
import { defaultFixturePredictionQuestionConfig } from '../../imports/shared/predictionQuestions';

const uniqueEmail = (label: string) =>
  `ccpp008b-e2e-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;

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
  await callMeteor(page, TEST_MATCH_RESULT_METHODS.reset);
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

const loginAsResultAdmin = async (page: Page, label: string) => {
  const email = uniqueEmail(label);

  await callMeteor(page, TEST_AUTH_METHODS.createVerifiedUser, email);
  await callMeteor(page, TEST_AUTH_METHODS.setAdminForEmail, email, true);
  await loginWithTestToken(page, email);

  return email;
};

const farFutureKickoff = () =>
  new Date(Date.UTC(2098, 8, 17, 12, 0, 0)).toISOString();

const createPublishedCustomFixtureWithRevision = async (
  page: Page,
  details: {
    readonly competitionDisplayName: string;
    readonly scheduledKickoffAt: string;
    readonly team1DisplayName: string;
    readonly team2DisplayName: string;
    readonly venueDisplayName?: string;
  },
) => {
  const created = await callMeteor<{
    readonly fixtureId: string;
    readonly status: string;
  }>(page, FIXTURE_METHODS.createDraft, {
    details,
  });
  const config = {
    ...defaultFixturePredictionQuestionConfig(),
    customQuestions: [
      {
        answerType: 'number' as const,
        banter: 'Set-piece heat check.',
        countingDefinition:
          'Scrum penalties awarded against the All Blacks during regulation match time. Free kicks do not count.',
        deductionPerUnit: 25,
        id: 'scrum-pressure',
        max: 10,
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
    page,
    FIXTURE_METHODS.saveQuestionConfig,
    {
      config,
      expectedRevision: 1,
      fixtureId: created.fixtureId,
    },
  );

  await callMeteor(page, FIXTURE_METHODS.publish, {
    expectedRevision: saved.revision,
    fixtureId: created.fixtureId,
  });

  return {
    fixtureId: created.fixtureId,
    publishedRevision: saved.revision + 1,
  };
};

const createPublishedCustomFixture = async (
  page: Page,
  details: {
    readonly competitionDisplayName: string;
    readonly scheduledKickoffAt: string;
    readonly team1DisplayName: string;
    readonly team2DisplayName: string;
    readonly venueDisplayName?: string;
  },
) => (await createPublishedCustomFixtureWithRevision(page, details)).fixtureId;

const resultPath = (fixtureId: string) =>
  `/admin/fixtures/${fixtureId}/results`;

const numberInput = (page: Page, label: string) =>
  page.getByRole('spinbutton', { name: label });

const selectOption = async (page: Page, label: string, value: string) => {
  await page.getByLabel(label).selectOption(value);
};

const fillCompleteResult = async (
  page: Page,
  teams: { readonly team1: string; readonly team2: string },
) => {
  await numberInput(page, `${teams.team1} tries`).fill('4');
  await numberInput(page, `${teams.team1} conversions`).fill('3');
  await numberInput(page, `${teams.team1} successful penalty kicks`).fill('1');
  await numberInput(page, `${teams.team1} drop goals`).fill('0');
  await numberInput(page, `${teams.team1} yellow cards`).fill('1');
  await numberInput(page, `${teams.team1} red cards`).fill('0');

  await numberInput(page, `${teams.team2} tries`).fill('2');
  await numberInput(page, `${teams.team2} conversions`).fill('1');
  await numberInput(page, `${teams.team2} successful penalty kicks`).fill('3');
  await numberInput(page, `${teams.team2} drop goals`).fill('0');
  await numberInput(page, `${teams.team2} yellow cards`).fill('0');
  await numberInput(page, `${teams.team2} red cards`).fill('0');

  await selectOption(page, 'First try', 'team1');
  await selectOption(page, 'Highest-scoring half', 'second');
  await selectOption(page, 'Half-time leader', 'team1');

  await page.getByLabel('Official observed result').fill('11');
  await page
    .getByRole('group', {
      name: 'Which group produces the player of the match?',
    })
    .getByLabel('Void question')
    .check();
};

const completeObservationPayload = () => ({
  firstTry: { status: 'provisional', value: 'team1' },
  halfTimeLeader: { status: 'provisional', value: 'team1' },
  highestScoringHalf: { status: 'provisional', value: 'second' },
  matchStatus: 'provisional',
  team1: {
    conversions: { status: 'provisional', value: 3 },
    dropGoals: { status: 'provisional', value: 0 },
    penaltyKicks: { status: 'provisional', value: 1 },
    redCards: { status: 'provisional', value: 0 },
    tries: { status: 'provisional', value: 4 },
    yellowCards: { status: 'provisional', value: 1 },
  },
  team2: {
    conversions: { status: 'provisional', value: 1 },
    dropGoals: { status: 'provisional', value: 0 },
    penaltyKicks: { status: 'provisional', value: 3 },
    redCards: { status: 'provisional', value: 0 },
    tries: { status: 'provisional', value: 2 },
    yellowCards: { status: 'provisional', value: 0 },
  },
  customAnswers: {
    'player-band': { status: 'void' },
    'scrum-pressure': { status: 'provisional', value: 11 },
  },
});

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

test.describe('result administration', () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    await resetTestData(page);
  });

  test('saves provisional observations, preserves blanks, and confirms a final summary with custom void', async ({
    page,
  }) => {
    const team1 = uniqueLabel('Springboks');
    const team2 = uniqueLabel('All Blacks');
    await loginAsResultAdmin(page, 'result-flow');
    const fixtureId = await createPublishedCustomFixture(page, {
      competitionDisplayName: 'Result Admin Cup',
      scheduledKickoffAt: farFutureKickoff(),
      team1DisplayName: team1,
      team2DisplayName: team2,
    });

    await gotoLocal(page, '/admin');

    const row = page
      .getByRole('listitem')
      .filter({ hasText: `${team1} vs ${team2}` });

    await expect(row.getByText('Result: No result')).toBeVisible();
    await row.getByRole('link', { name: 'Results' }).click();

    await expect(
      page.getByRole('heading', { level: 1, name: `${team1} vs ${team2}` }),
    ).toBeVisible();

    await numberInput(page, `${team1} tries`).fill('0');
    await numberInput(page, `${team1} conversions`).fill('0');
    await page.getByRole('button', { name: 'Save provisional result' }).click();
    await expect(page.getByText('Provisional result saved.')).toBeVisible();

    await gotoLocal(page, resultPath(fixtureId));
    await expect(numberInput(page, `${team1} tries`)).toHaveValue('0');
    await expect(numberInput(page, `${team2} tries`)).toHaveValue('');

    await fillCompleteResult(page, { team1, team2 });

    await expect(page.getByText('29', { exact: true })).toBeVisible();
    await expect(page.getByText('21', { exact: true })).toBeVisible();
    await expect(page.getByText(team1).first()).toBeVisible();

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Confirm final result' }).click();

    await expect(page.getByText('Final result confirmed.')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Confirmed result summary' }),
    ).toBeVisible();
    await expect(
      page.getByText('Void. This question will deduct no points.'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Save provisional result' }),
    ).toHaveCount(0);
  });

  test('rejects stale result saves, preserves local values, and reloads latest', async ({
    page,
  }) => {
    const team1 = uniqueLabel('Conflict Springboks');
    const team2 = uniqueLabel('Conflict All Blacks');
    await loginAsResultAdmin(page, 'result-conflict');
    const fixtureId = await createPublishedCustomFixture(page, {
      competitionDisplayName: 'Result Conflict Cup',
      scheduledKickoffAt: farFutureKickoff(),
      team1DisplayName: team1,
      team2DisplayName: team2,
    });

    await gotoLocal(page, resultPath(fixtureId));

    await fillCompleteResult(page, { team1, team2 });
    await page.getByRole('button', { name: 'Save provisional result' }).click();
    await expect(page.getByText('Provisional result saved.')).toBeVisible();

    await numberInput(page, `${team1} tries`).fill('5');

    await callMeteor(page, MATCH_RESULT_METHODS.saveProvisional, {
      expectedRevision: 1,
      fixtureId,
      observations: {
        ...completeObservationPayload(),
        team1: {
          ...completeObservationPayload().team1,
          conversions: { status: 'provisional', value: 2 },
          tries: { status: 'provisional', value: 2 },
        },
      },
    });

    await page.getByRole('button', { name: 'Save provisional result' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'This result changed before your update could be saved.',
    );
    await expect(numberInput(page, `${team1} tries`)).toHaveValue('5');

    await page.getByRole('button', { name: 'Reload latest result' }).click();
    await expect(numberInput(page, `${team1} tries`)).toHaveValue('2');
  });

  test('shows a cancelled provisional result as read-only without confirmed wording', async ({
    page,
  }) => {
    const team1 = uniqueLabel('Cancelled Springboks');
    const team2 = uniqueLabel('Cancelled All Blacks');
    await loginAsResultAdmin(page, 'cancelled-provisional');
    const { fixtureId, publishedRevision } =
      await createPublishedCustomFixtureWithRevision(page, {
        competitionDisplayName: 'Cancelled Result Cup',
        scheduledKickoffAt: farFutureKickoff(),
        team1DisplayName: team1,
        team2DisplayName: team2,
      });

    await callMeteor(page, MATCH_RESULT_METHODS.saveProvisional, {
      expectedRevision: 0,
      fixtureId,
      observations: completeObservationPayload(),
    });
    await callMeteor(page, FIXTURE_METHODS.cancel, {
      expectedRevision: publishedRevision,
      fixtureId,
    });
    await gotoLocal(page, resultPath(fixtureId));

    await expect(
      page.getByRole('heading', { level: 1, name: `${team1} vs ${team2}` }),
    ).toBeVisible({ timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS });
    await expect(
      page.getByText(
        'This fixture is cancelled. Existing result history is read-only.',
      ),
    ).toBeVisible();
    await expect(
      page.getByText('Result state').locator('xpath=..'),
    ).toContainText('Provisional', {
      timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS,
    });
    await expect(
      page.getByRole('heading', { name: 'Provisional result summary' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Confirmed result summary' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Save provisional result' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Confirm final result' }),
    ).toHaveCount(0);
    await expect(page.getByRole('spinbutton')).toHaveCount(0);
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await expect(page.getByText('29', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('21', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('11', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Void. This question will deduct no points.'),
    ).toBeVisible();
  });
});
