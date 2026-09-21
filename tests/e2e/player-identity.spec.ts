import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';

import { TEST_AUTH_METHODS } from '../../imports/shared/auth/methods';
import { TEST_FIXTURE_LEADERBOARD_METHODS } from '../../imports/shared/fixtureLeaderboards';
import { TEST_FIXTURE_METHODS } from '../../imports/shared/fixtures';
import { TEST_MATCH_RESULT_METHODS } from '../../imports/shared/matchResults';
import {
  PLAYER_PROFILE_METHODS,
  TEST_PLAYER_PROFILE_METHODS,
  type PublicPlayerIdentity,
} from '../../imports/shared/playerProfiles';
import { TEST_PREDICTION_METHODS } from '../../imports/shared/predictions';

const uniqueEmail = (label: string) =>
  `ccpp012a-e2e-${label}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}@example.test`;

const NAVIGATION_ATTEMPT_TIMEOUT_MS = 15_000;
const evidenceDir = path.resolve(
  process.env.RUGBY_ROOSTER_E2E_EVIDENCE_DIR ??
    'test-results/ccpp012a-player-identity',
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

const saveDisplayName = async (page: Page, displayName: string) => {
  const input = page.getByRole('textbox', { name: 'Public player name' });

  await expect(input).toBeEnabled();
  await input.fill(displayName);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Public player name saved.')).toBeVisible();
  await expect(input).toHaveValue(displayName.trim().replace(/\s+/g, ' '));
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
      users: {
        update: (
          selector: string | null,
          modifier: Record<string, unknown>,
          callback: (error?: { readonly error?: string }) => void,
        ) => void;
      };
      user: () => unknown;
      loginWithToken: (
        token: string,
        callback: (error?: { readonly error?: string }) => void,
      ) => void;
      userId: () => string | null;
    };
  }
}

test.describe('public player identity', () => {
  test('edits Account display name and resolves leaderboard labels safely', async ({
    page,
  }) => {
    await resetTestData(page);
    const email = await createAndLoginPlayer(page);

    await gotoLocal(page, '/account');
    await expect(
      page.getByRole('heading', { name: 'Your Rugby Rooster account' }),
    ).toBeVisible();
    await saveDisplayName(page, 'Pierre');

    const profileForm = page.getByRole('form', {
      name: 'Public player name section',
    });

    await profileForm.screenshot({
      path: screenshotPath('account-public-player-name-desktop'),
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await profileForm.screenshot({
      path: screenshotPath('account-public-player-name-390'),
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    const seeded = await callMeteor<{
      readonly fixtureId: string;
    }>(page, TEST_FIXTURE_LEADERBOARD_METHODS.seedIdentityScenario);

    await gotoLocal(page, `/games/${seeded.fixtureId}/leaderboard`);
    await expect(page.getByText('Final leaderboard')).toBeVisible();
    await expect(page.locator('main')).toContainText('Alice');
    await expect(page.locator('main')).toContainText(/Rooster [A-F0-9]{8}/);
    await expect(page.locator('tbody tr', { hasText: 'You' })).toContainText(
      'YOU',
    );
    await expect(page.getByText(email)).toHaveCount(0);
    await page.screenshot({
      fullPage: true,
      path: screenshotPath('leaderboard-display-names-desktop'),
    });

    await page.setViewportSize({ width: 390, height: 900 });
    await expect(page.getByText('Final leaderboard')).toBeVisible();
    await expect(page.locator('main')).toContainText('Alice');
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      fullPage: true,
      path: screenshotPath('leaderboard-display-names-390'),
    });

    await page.setViewportSize({ width: 360, height: 900 });
    await expect(page.getByText('Final leaderboard')).toBeVisible();
    await expect(page.locator('main')).toContainText('Alice');
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      fullPage: true,
      path: screenshotPath('leaderboard-display-names-360'),
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLocal(page, '/account');
    await saveDisplayName(page, 'Pete');

    const safeIdentity = await callMeteor<PublicPlayerIdentity>(
      page,
      PLAYER_PROFILE_METHODS.getMine,
    );
    const serializedSafeIdentity = JSON.stringify(safeIdentity);

    expect(safeIdentity).toEqual({
      displayName: 'Pete',
    });
    expect(serializedSafeIdentity).not.toContain(email);
    expect(serializedSafeIdentity).not.toContain('userId');
    expect(serializedSafeIdentity).not.toContain('roles');
    expect(serializedSafeIdentity).not.toContain('services');

    await gotoLocal(page, `/games/${seeded.fixtureId}/leaderboard`);
    await expect(page.getByText('Final leaderboard')).toBeVisible();
    await expect(page.locator('tbody tr', { hasText: 'You' })).toContainText(
      'YOU',
    );
    await expect(page.locator('main')).toContainText('Alice');
    await expect(page.locator('main')).toContainText(/Rooster [A-F0-9]{8}/);
    await expect(page.getByText(email)).toHaveCount(0);

    await gotoLocal(page, '/account');
    await saveDisplayName(page, 'Thabo Mokoena Scrum Captain');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await profileForm.screenshot({
      path: screenshotPath('account-public-player-name-390-near-max'),
    });
  });
});
