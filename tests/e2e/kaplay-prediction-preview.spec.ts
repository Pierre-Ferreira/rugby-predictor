import { expect, type Page, test } from '@playwright/test';

import { TEST_AUTH_METHODS } from '../../imports/shared/auth/methods';
import { TEST_FIXTURE_METHODS } from '../../imports/shared/fixtures';
import { defaultFixturePredictionQuestionConfig } from '../../imports/shared/predictionQuestions';
import {
  TEST_PREDICTION_METHODS,
  type PredictionEntryDocument,
} from '../../imports/shared/predictions';

const NAVIGATION_ATTEMPT_TIMEOUT_MS = 15_000;
const animationPreferenceStorageKey = 'rugby-rooster:prediction-animations';

const uniqueEmail = (label: string) =>
  `ccpp009b-e2e-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;

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

const chooseRadio = async (page: Page, name: string) => {
  await page.getByRole('radio', { exact: true, name }).check();
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
  await expect(page.getByTestId('kaplay-match-result-stage')).toBeVisible({
    timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS,
  });
  await expect(page.getByText('Loading animation preview.')).toHaveCount(0);
  await expect(page.getByTestId('kaplay-match-result-canvas')).toBeVisible();
};

const clickCanvasChoice = async (page: Page, choiceIndex: 0 | 1 | 2) => {
  const canvas = page.getByTestId('kaplay-match-result-canvas');
  const box = await canvas.boundingBox();

  if (!box) {
    throw new Error('Kaplay canvas is not visible.');
  }

  const gameHeight = 560;
  const choiceStartY = 250;
  const choiceHeight = 82;
  const choiceGap = 20;
  const choiceCenterY =
    choiceStartY + choiceHeight / 2 + choiceIndex * (choiceHeight + choiceGap);

  await canvas.click({
    position: {
      x: box.width / 2,
      y: (choiceCenterY / gameHeight) * box.height,
    },
  });
};

const createPredictionAtMatchResult = async (
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
  await startPrediction(page);
  await expect(page.getByText('Step 1 of 9')).toBeVisible();

  return {
    fixtureId,
    team1,
    team2,
  };
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

  await chooseRadio(page, 'Second Half');
  await continueButton(page).click();

  await chooseRadio(page, teams.team1);
  await continueButton(page).click();

  await page
    .getByRole('spinbutton', { name: `${custom.numberPrompt} answer` })
    .fill(custom.numberValue);
  await continueButton(page).click();

  await chooseRadio(page, custom.choiceLabel);
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

  test.beforeEach(async ({ page }) => {
    await blockMeteorHmrHotCodePush(page);
    await resetTestData(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });

  test('renders a real Match Result canvas choice and hands off to Standard', async ({
    page,
  }) => {
    const { team1, team2 } = await createPredictionAtMatchResult(
      page,
      'kaplay-real',
    );

    await expect
      .poll(() =>
        page.evaluate(() => window.__RUGBY_ROOSTER_KAPLAY_IMPORT_COUNT__ ?? 0),
      )
      .toBe(0);

    await animationsButton(page, 'On').click();
    await waitForKaplayReady(page);
    await page.screenshot({
      fullPage: true,
      path: 'test-results/ccpp009b/desktop-match-result-preview.png',
    });

    await clickCanvasChoice(page, 1);
    await expect(page.getByTestId('kaplay-match-result-picked')).toContainText(
      `You picked ${team2}`,
    );
    await expect(
      page.getByRole('radio', { name: team2, exact: true }),
    ).toHaveAttribute('aria-checked', 'true');
    await page.screenshot({
      fullPage: true,
      path: 'test-results/ccpp009b/desktop-match-result-selected.png',
    });

    await animationsButton(page, 'Off').click();
    await expect(
      page.getByRole('radio', { name: team2, exact: true }),
    ).toBeChecked();

    await animationsButton(page, 'On').click();
    await waitForKaplayReady(page);
    await expect(page.getByTestId('kaplay-match-result-picked')).toContainText(
      `You picked ${team2}`,
    );

    await continueButton(page).click();
    await expect(page.getByText('Step 2 of 9')).toBeVisible();
    await expect(page.getByTestId('kaplay-match-result-stage')).toHaveCount(0);
    await expect(
      page.getByRole('spinbutton', { name: `${team1} tries` }),
    ).toBeVisible();
  });

  test('uses Standard while Off and when reduced motion changes during preview', async ({
    page,
  }) => {
    const longTeam1 = `${uniqueLabel('Cape Town Very Long Club Name')} XV`;
    const longTeam2 = `${uniqueLabel('Johannesburg Equally Long Club Name')} XV`;

    await page.setViewportSize({ height: 760, width: 390 });
    const { team1 } = await createPredictionAtMatchResult(
      page,
      'kaplay-reduced-motion',
      {
        team1: longTeam1,
        team2: longTeam2,
      },
    );

    await expect(page.getByTestId('kaplay-match-result-stage')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => window.__RUGBY_ROOSTER_KAPLAY_IMPORT_COUNT__ ?? 0),
      )
      .toBe(0);

    await animationsButton(page, 'On').click();
    await waitForKaplayReady(page);
    await page.screenshot({
      fullPage: true,
      path: 'test-results/ccpp009b/narrow-match-result-preview.png',
    });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(
      page.getByText('Your device/browser preference keeps animations off.'),
    ).toBeVisible();
    await expect(page.getByTestId('kaplay-match-result-stage')).toHaveCount(0);
    await expect(
      page.getByRole('radio', { name: team1, exact: true }),
    ).toBeVisible();
  });

  test('recovers from delayed initialization, controlled failure and context loss', async ({
    page,
  }) => {
    const { fixtureId, team1 } = await createPredictionAtMatchResult(
      page,
      'kaplay-failure',
    );

    await page.evaluate(() => {
      window.__RUGBY_ROOSTER_KAPLAY_PREVIEW_TEST__ = {
        delayInitializationMs: 250,
      };
    });
    await animationsButton(page, 'On').click();
    await expect(
      page.getByText('Loading animation preview.').first(),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Continue without animations' })
      .first()
      .click();
    await expect(
      page.getByRole('radio', { name: team1, exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(350);
    await expect(page.getByTestId('kaplay-match-result-stage')).toHaveCount(0);

    await gotoLocal(page, predictionPath(fixtureId));
    await startPrediction(page);
    await expect(page.getByText('Step 1 of 9')).toBeVisible();

    await page.evaluate(() => {
      window.__RUGBY_ROOSTER_KAPLAY_PREVIEW_TEST__ = {
        failOnNextPointer: true,
      };
    });
    await animationsButton(page, 'On').click();
    await waitForKaplayReady(page);
    await clickCanvasChoice(page, 0);
    await expect(
      page.getByText(
        "Animations couldn't continue. Your answers have been kept.",
      ),
    ).toBeVisible();
    await page.screenshot({
      fullPage: true,
      path: 'test-results/ccpp009b/standard-after-fallback.png',
    });

    await page.evaluate(() => {
      window.__RUGBY_ROOSTER_KAPLAY_PREVIEW_TEST__ = {};
    });
    await page.getByRole('button', { name: 'Retry animations' }).click();
    await waitForKaplayReady(page);
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

    await gotoLocal(page, predictionPath(fixtureId));
    await expect(saveRevisedPredictionButton(page)).toBeVisible({
      timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS,
    });

    await reviewSection(page, 'OTHER PREDICTIONS')
      .getByRole('button', { name: 'Edit highest-scoring half' })
      .click();
    await expectStep(page, 7, 10);
    await chooseRadio(page, 'First Half');
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
    await chooseRadio(page, 'Backs');
    await page.getByRole('button', { name: 'Return to Review' }).click();

    await expect(reviewSection(page, 'OTHER PREDICTIONS')).toContainText(
      'First half',
    );
    await expect(reviewSection(page, 'CUSTOM QUESTIONS')).toContainText('6');
    await expect(reviewSection(page, 'CUSTOM QUESTIONS')).toContainText(
      'Backs',
    );

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
    await animationsButton(page, 'On').click();
    await expect(
      page.getByRole('button', { name: 'Return to Review' }),
    ).toBeVisible();
    await waitForKaplayReady(page);
    await clickCanvasChoice(page, 0);
    await expect(page.getByTestId('kaplay-match-result-picked')).toContainText(
      `You picked ${team1}`,
    );

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

    await animationsButton(page, 'Off').click();
    await page.getByRole('button', { name: 'Return to Review' }).click();
    await expect(reviewSection(page, 'OTHER PREDICTIONS')).toContainText(
      'First half',
    );
    await expect(reviewSection(page, 'CUSTOM QUESTIONS')).toContainText('6');
    await expect(reviewSection(page, 'CUSTOM QUESTIONS')).toContainText(
      'Backs',
    );

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

  test('supports keyboard selection and preserves preference gate behavior locally', async ({
    page,
  }) => {
    const { fixtureId, team1, team2 } = await createPredictionAtMatchResult(
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
    await continueButton(page).click();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByTestId('kaplay-match-result-stage')).toHaveCount(0);
    await expect(
      page.getByRole('radio', { name: team1, exact: true }),
    ).toBeVisible();

    await gotoLocal(page, predictionPath(fixtureId));
    await startPrediction(page);
    await expect(page.getByText('Step 1 of 9')).toBeVisible();
    await waitForKaplayReady(page);
    await page.getByRole('radio', { name: team2, exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('kaplay-match-result-picked')).toContainText(
      `You picked ${team2}`,
    );
  });
});
