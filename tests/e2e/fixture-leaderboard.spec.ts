import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';

import { TEST_AUTH_METHODS } from '../../imports/shared/auth/methods';
import { TEST_FIXTURE_LEADERBOARD_METHODS } from '../../imports/shared/fixtureLeaderboards';
import { TEST_FIXTURE_METHODS } from '../../imports/shared/fixtures';
import { TEST_MATCH_RESULT_METHODS } from '../../imports/shared/matchResults';
import { TEST_PREDICTION_METHODS } from '../../imports/shared/predictions';

const uniqueEmail = (label: string) =>
  `ccpp011b-e2e-${label}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}@example.test`;

const NAVIGATION_ATTEMPT_TIMEOUT_MS = 15_000;
const evidenceDir = path.resolve(
  process.env.RUGBY_ROOSTER_E2E_EVIDENCE_DIR ??
    'test-results/ccpp011b-fixture-leaderboard',
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

const loginAsLeaderboardPlayer = async (page: Page) => {
  const email = uniqueEmail('player');

  await callMeteor(page, TEST_AUTH_METHODS.createVerifiedUser, email);
  await loginWithTestToken(page, email);

  return email;
};

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

const readDesktopRows = async (page: Page) =>
  page
    .locator('tbody tr')
    .evaluateAll((rows) =>
      rows.map((row) =>
        Array.from(row.querySelectorAll('td')).map(
          (cell) => cell.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        ),
      ),
    );

const screenshotPath = (name: string): string => {
  mkdirSync(evidenceDir, { recursive: true });

  return path.join(evidenceDir, `${name}.png`);
};

test.describe('fixture leaderboard', () => {
  test('renders provisional, correction, final, and mobile states', async ({
    page,
  }) => {
    await resetTestData(page);
    await loginAsLeaderboardPlayer(page);

    const seeded = await callMeteor<{
      readonly fixtureId: string;
    }>(page, TEST_FIXTURE_LEADERBOARD_METHODS.seedScenario);

    await gotoLocal(page, `/games/${seeded.fixtureId}/leaderboard`);

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Red Roosters vs Blue Boots',
      }),
    ).toBeVisible();
    await expect(page.getByText('If it ended now')).toBeVisible();
    await expect(
      page.getByText('Scores and positions can still change.'),
    ).toBeVisible();

    const initialRows = await readDesktopRows(page);

    expect(initialRows.map((row) => row[0])).toEqual(['1', '2', '2', '4']);
    expect(initialRows.map((row) => row[2])).toEqual([
      '10,000',
      '9,800',
      '9,800',
      '9,600',
    ]);
    expect(initialRows.map((row) => row[3])).toEqual([
      '1 pending',
      '1 pending',
      '1 pending',
      '1 pending',
    ]);

    const currentUserRow = page.locator('tbody tr', { hasText: 'You' });

    await expect(currentUserRow).toContainText('YOU');
    await page.screenshot({
      fullPage: true,
      path: screenshotPath('provisional-desktop-leaderboard'),
    });
    await page.screenshot({
      fullPage: true,
      path: screenshotPath('tie-shared-place-state'),
    });
    await currentUserRow.screenshot({
      path: screenshotPath('current-user-highlight'),
    });

    await callMeteor(
      page,
      TEST_FIXTURE_LEADERBOARD_METHODS.updateScenarioResult,
      {
        fixtureId: seeded.fixtureId,
        mode: 'correction',
      },
    );
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(page.getByText('Result revision 2')).toBeVisible();

    const correctedRows = await readDesktopRows(page);
    const correctedCurrentRow = page.locator('tbody tr', { hasText: 'You' });

    expect(correctedRows.map((row) => row[0])).toEqual(['1', '1', '3', '3']);
    await expect(correctedCurrentRow).toContainText('10,000');
    await expect(correctedCurrentRow).toContainText('YOU');

    await callMeteor(
      page,
      TEST_FIXTURE_LEADERBOARD_METHODS.updateScenarioResult,
      {
        fixtureId: seeded.fixtureId,
        mode: 'final',
      },
    );
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(page.getByText('Final leaderboard')).toBeVisible();
    await expect(page.getByText('Result revision 3')).toBeVisible();
    await expect(page.getByText('pending')).toHaveCount(0);

    const finalRows = await readDesktopRows(page);

    expect(finalRows.map((row) => row[0])).toEqual(['1', '1', '3', '3']);
    expect(finalRows[0][2]).toBe('10,000');
    await page.screenshot({
      fullPage: true,
      path: screenshotPath('final-desktop-leaderboard'),
    });

    await page.setViewportSize({ width: 390, height: 900 });
    await expect(page.getByText('Final leaderboard')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      fullPage: true,
      path: screenshotPath('mobile-390'),
    });

    await page.setViewportSize({ width: 360, height: 900 });
    await expect(page.getByText('Final leaderboard')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      fullPage: true,
      path: screenshotPath('mobile-360'),
    });

    const emptyFixture = await callMeteor<{
      readonly fixtureId: string;
    }>(page, TEST_FIXTURE_METHODS.createPublished, {
      details: {
        competitionDisplayName: 'Fixture Leaderboard Cup',
        scheduledKickoffAt: '2098-08-29T13:00:00.000Z',
        team1DisplayName: 'Green Grounds',
        team2DisplayName: 'Silver Sidesteps',
        venueDisplayName: 'Loopback Stadium',
      },
    });

    await page.evaluate((fixtureId) => {
      window.history.pushState({}, '', `/games/${fixtureId}/leaderboard`);
      window.dispatchEvent(new Event('rugby-rooster:navigate'));
    }, emptyFixture.fixtureId);

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Green Grounds vs Silver Sidesteps',
      }),
    ).toBeVisible();
    await expect(page.getByText('0 predictions submitted')).toBeVisible();
    await expect(page.getByText('Final leaderboard')).toHaveCount(0);
    await expect(page.getByText('Result revision 3')).toHaveCount(0);
    await expect(page.locator('tbody tr')).toHaveCount(0);
  });
});
