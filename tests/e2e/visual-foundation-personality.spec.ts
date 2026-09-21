import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';

import { TEST_AUTH_METHODS } from '../../imports/shared/auth/methods';
import {
  FIXTURE_LEADERBOARD_METHODS,
  TEST_FIXTURE_LEADERBOARD_METHODS,
} from '../../imports/shared/fixtureLeaderboards';
import { TEST_FIXTURE_METHODS } from '../../imports/shared/fixtures';
import { TEST_MATCH_RESULT_METHODS } from '../../imports/shared/matchResults';
import { TEST_PLAYER_PROFILE_METHODS } from '../../imports/shared/playerProfiles';
import { TEST_PREDICTION_METHODS } from '../../imports/shared/predictions';

const uniqueEmail = (label: string) =>
  `ccpp012b2-e2e-${label}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}@example.test`;

const NAVIGATION_ATTEMPT_TIMEOUT_MS = 15_000;
const evidenceDir = path.resolve(
  process.env.RUGBY_ROOSTER_E2E_EVIDENCE_DIR ??
    'test-results/ccpp012b2-global-green-surface-alignment',
);

const expectedMoodAssetSrc = {
  celebrating: '/assets/rooster/personality/rooster-celebrating.png',
  confident: '/assets/rooster/personality/rooster-confident.png',
  cooked: '/assets/rooster/personality/rooster-cooked.png',
  crying: '/assets/rooster/personality/rooster-crying.png',
  disappointed: '/assets/rooster/personality/rooster-disappointed.png',
  nervous: '/assets/rooster/personality/rooster-nervous.png',
  running: '/assets/rooster/match-result/frames/rooster-run-1.png',
  shocked: '/assets/rooster/personality/rooster-shocked.png',
  superCooked: '/assets/rooster/personality/rooster-super-cooked.png',
  tantrum: '/assets/rooster/personality/rooster-tantrum.png',
  thinking: '/assets/rooster/personality/rooster-thinking.png',
} as const;

type BrowserPersonalityMood = keyof typeof expectedMoodAssetSrc;

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
  await callMeteor(page, TEST_PLAYER_PROFILE_METHODS.reset);
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

const createAndLoginPlayer = async (page: Page) => {
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

const screenshotPath = (name: string): string => {
  mkdirSync(evidenceDir, { recursive: true });

  return path.join(evidenceDir, `${name}.png`);
};

const screenshot = async (page: Page, name: string) => {
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    fullPage: true,
    path: screenshotPath(name),
  });
};

const expectVisibleMood = async (page: Page, mood: BrowserPersonalityMood) => {
  const personality = page.locator(`[data-mood="${mood}"]`).first();
  const image = personality.locator('img').first();

  await expect(personality).toBeVisible();
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('src', expectedMoodAssetSrc[mood]);
  await expect
    .poll(() =>
      image.evaluate((node) => {
        const loadedImage = node as HTMLImageElement;

        return loadedImage.complete && loadedImage.naturalWidth > 0;
      }),
    )
    .toBe(true);
};

const expectGreenPageHeader = async (page: Page) => {
  const header = page.locator('.rr-page-header').first();

  await expect(header).toBeVisible();
  await expect
    .poll(() =>
      header.evaluate((node) => {
        const styles = window.getComputedStyle(node);

        return {
          backgroundColor: styles.backgroundColor,
          color: styles.color,
        };
      }),
    )
    .toEqual({
      backgroundColor: 'rgb(0, 109, 67)',
      color: 'rgb(255, 248, 230)',
    });
};

const expectNoGenericRunningMoodLeak = async (page: Page) => {
  await expect(
    page.locator(
      '[data-mood]:not([data-mood="running"]) img[src*="/match-result/frames/"]',
    ),
  ).toHaveCount(0);
};

const expectAlternatingLeaderboardRows = async (
  page: Page,
  rowSelector: 'article.rr-leaderboard-row' | 'tr.rr-leaderboard-row',
) => {
  const rows = page.locator(rowSelector);

  await expect(rows.first()).toBeVisible();
  await expect(rows.nth(0)).toHaveClass(/rr-leaderboard-row--green/);
  await expect(rows.nth(1)).toHaveClass(/rr-leaderboard-row--gold/);
  await expect(page.getByText('YOU').first()).toBeVisible();
};

const navigateInApp = async (page: Page, pathName: string) => {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath);
    window.dispatchEvent(new Event('rugby-rooster:navigate'));
  }, pathName);
};

declare global {
  interface Window {
    __restoreLeaderboardCall?: () => void;
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

test.describe('CCPP-012B2 global green surface alignment', () => {
  test('captures the focused player-facing journey', async ({ page }) => {
    test.setTimeout(120_000);

    await resetTestData(page);

    await expect(
      page.getByRole('heading', { level: 1, name: 'Rugby Rooster' }),
    ).toBeVisible();
    await expectGreenPageHeader(page);
    await expectVisibleMood(page, 'confident');
    await expectNoGenericRunningMoodLeak(page);
    await screenshot(page, 'desktop-home');

    await gotoLocal(page, '/games/ccpp012bMissingFixture');
    await expect(page.getByText('Fixture not found')).toBeVisible();
    await expectVisibleMood(page, 'thinking');
    await expectNoGenericRunningMoodLeak(page);
    await screenshot(page, 'desktop-empty-fixture-not-found');

    await createAndLoginPlayer(page);

    await gotoLocal(page, '/account');
    await expect(
      page.getByRole('heading', { name: 'Your Rugby Rooster account' }),
    ).toBeVisible();
    await expectGreenPageHeader(page);
    await expectVisibleMood(page, 'confident');
    const input = page.getByRole('textbox', { name: 'Public player name' });

    await input.fill('Pierre Visual');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Public player name saved.')).toBeVisible();
    await expectNoGenericRunningMoodLeak(page);
    await screenshot(page, 'desktop-account');

    const seeded = await callMeteor<{
      readonly fixtureId: string;
    }>(page, TEST_FIXTURE_LEADERBOARD_METHODS.seedScenario);

    await callMeteor(page, TEST_FIXTURE_METHODS.createPublished, {
      details: {
        competitionDisplayName: 'Archive Shield',
        scheduledKickoffAt: '2024-06-15T13:00:00.000Z',
        team1DisplayName: 'Old Greens',
        team2DisplayName: 'Gold Veterans',
        venueDisplayName: 'History Park',
      },
    });

    await gotoLocal(page, '/games');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Upcoming fixtures' }),
    ).toBeVisible();
    await expectGreenPageHeader(page);
    await expectVisibleMood(page, 'running');
    await screenshot(page, 'desktop-games-upcoming');

    await page.getByRole('button', { name: 'Past' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Past scheduled fixtures' }),
    ).toBeVisible();
    await expectGreenPageHeader(page);
    await expectVisibleMood(page, 'thinking');
    await screenshot(page, 'desktop-games-past');

    await gotoLocal(page, `/games/${seeded.fixtureId}`);
    await expect(
      page.getByRole('heading', { name: /Red Roosters.*Blue Boots/ }),
    ).toBeVisible();
    await expectGreenPageHeader(page);
    await expectVisibleMood(page, 'thinking');
    await expectNoGenericRunningMoodLeak(page);
    await screenshot(page, 'desktop-game-detail');

    await gotoLocal(page, `/games/${seeded.fixtureId}/predict`);
    await expect(
      page.getByRole('heading', { name: /Red Roosters.*Blue Boots/ }),
    ).toBeVisible();
    await expectGreenPageHeader(page);
    await expectVisibleMood(page, 'confident');
    await expectNoGenericRunningMoodLeak(page);
    await screenshot(page, 'desktop-prediction');

    await gotoLocal(page, `/games/${seeded.fixtureId}/leaderboard`);
    await expect(page.getByText('If it ended now')).toBeVisible();
    await expectGreenPageHeader(page);
    await expectAlternatingLeaderboardRows(page, 'tr.rr-leaderboard-row');
    await expectVisibleMood(page, 'nervous');
    await expectNoGenericRunningMoodLeak(page);
    await screenshot(page, 'desktop-leaderboard-provisional');

    const errorFixture = await callMeteor<{
      readonly fixtureId: string;
    }>(page, TEST_FIXTURE_METHODS.createPublished, {
      details: {
        competitionDisplayName: 'Error State Cup',
        scheduledKickoffAt: '2098-10-20T13:00:00.000Z',
        team1DisplayName: 'Retry Rangers',
        team2DisplayName: 'Broken Boots',
        venueDisplayName: 'Loopback Stadium',
      },
    });

    await page.evaluate((methodName) => {
      const originalCall = window.Meteor.call.bind(window.Meteor);

      window.__restoreLeaderboardCall = () => {
        window.Meteor.call = originalCall;
        delete window.__restoreLeaderboardCall;
      };
      window.Meteor.call = (method, ...args) => {
        const callback = args[args.length - 1];

        if (method === methodName && typeof callback === 'function') {
          window.setTimeout(() => {
            callback(
              {
                error: 'visual-test-error',
                message: 'Injected leaderboard failure.',
                reason: 'Injected leaderboard failure.',
              },
              null,
            );
          }, 0);
          return;
        }

        originalCall(method, ...args);
      };
    }, FIXTURE_LEADERBOARD_METHODS.getFixtureLeaderboard);

    await navigateInApp(page, `/games/${errorFixture.fixtureId}/leaderboard`);
    await expect(page.getByText('Leaderboard unavailable')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    await expectVisibleMood(page, 'tantrum');
    await expectNoGenericRunningMoodLeak(page);
    await screenshot(page, 'desktop-error-retry');
    await page.evaluate(() => window.__restoreLeaderboardCall?.());

    await gotoLocal(page, `/games/${seeded.fixtureId}/leaderboard`);
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
    await expectGreenPageHeader(page);
    await expectAlternatingLeaderboardRows(page, 'tr.rr-leaderboard-row');
    await expectNoGenericRunningMoodLeak(page);
    await screenshot(page, 'desktop-leaderboard-final');

    await gotoLocal(page, `/games/${seeded.fixtureId}/my-score`);
    await expect(page.getByText('Final Score')).toBeVisible();
    await expectGreenPageHeader(page);
    await expectNoGenericRunningMoodLeak(page);
    await screenshot(page, 'desktop-my-score');

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoLocal(page, '/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Rugby Rooster' }),
    ).toBeVisible();
    await expectGreenPageHeader(page);
    await expectVisibleMood(page, 'confident');
    await expectNoGenericRunningMoodLeak(page);
    await screenshot(page, 'mobile-390-home');

    await gotoLocal(page, '/games');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Upcoming fixtures' }),
    ).toBeVisible();
    await expectGreenPageHeader(page);
    await expectVisibleMood(page, 'running');
    await screenshot(page, 'mobile-390-games');

    await gotoLocal(page, `/games/${seeded.fixtureId}`);
    await expect(
      page.getByRole('heading', { name: /Red Roosters.*Blue Boots/ }),
    ).toBeVisible();
    await expectGreenPageHeader(page);
    await expectVisibleMood(page, 'thinking');
    await expectNoGenericRunningMoodLeak(page);
    await screenshot(page, 'mobile-390-game-detail');

    await page.setViewportSize({ width: 360, height: 900 });
    await gotoLocal(page, `/games/${seeded.fixtureId}/leaderboard`);
    await expect(page.getByText('Final leaderboard')).toBeVisible();
    await expectGreenPageHeader(page);
    await expectAlternatingLeaderboardRows(page, 'article.rr-leaderboard-row');
    await expectNoGenericRunningMoodLeak(page);
    await screenshot(page, 'mobile-360-leaderboard');

    await gotoLocal(page, `/games/${seeded.fixtureId}/my-score`);
    await expect(page.getByText('Final Score')).toBeVisible();
    await expectGreenPageHeader(page);
    await expectNoGenericRunningMoodLeak(page);
    await screenshot(page, 'mobile-360-my-score');

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoLocal(page, '/account');
    await expect(
      page.getByRole('heading', { name: 'Your Rugby Rooster account' }),
    ).toBeVisible();
    await expectGreenPageHeader(page);
    await expectVisibleMood(page, 'confident');
    await expectNoGenericRunningMoodLeak(page);
    await screenshot(page, 'mobile-390-account');
  });
});
