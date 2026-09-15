import { expect, type Page, test } from '@playwright/test';

import { TEST_AUTH_METHODS } from '../../imports/shared/auth/methods';
import { TEST_FIXTURE_METHODS } from '../../imports/shared/fixtures';

const uniqueEmail = (label: string) =>
  `ccpp005-e2e-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;

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
  await callMeteor(page, TEST_AUTH_METHODS.reset);
  await callMeteor(page, TEST_FIXTURE_METHODS.reset);
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

const isoDaysFromNow = (days: number): string =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

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
      userId: () => string | null;
      loginWithToken: (
        token: string,
        callback: (error?: { readonly error?: string }) => void,
      ) => void;
    };
  }
}

test.describe('fixture management and browsing', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestData(page);
  });

  test('lets anonymous visitors browse upcoming, past, and detail fixture views', async ({
    page,
  }) => {
    const upcomingTeam1 = uniqueLabel('Stormers');
    const upcomingTeam2 = uniqueLabel('Bulls');
    const pastTeam1 = uniqueLabel('Sharks');
    const pastTeam2 = uniqueLabel('Lions');
    const upcomingFixtureName = `${upcomingTeam1} vs ${upcomingTeam2}`;
    const pastFixtureName = `${pastTeam1} vs ${pastTeam2}`;

    await createPublishedFixture(page, {
      competitionDisplayName: 'United Rugby Championship',
      scheduledKickoffAt: isoDaysFromNow(14),
      team1DisplayName: upcomingTeam1,
      team2DisplayName: upcomingTeam2,
      venueDisplayName: 'Cape Town Stadium',
    });
    await createPublishedFixture(page, {
      competitionDisplayName: 'Champions Cup',
      scheduledKickoffAt: isoDaysFromNow(-14),
      team1DisplayName: pastTeam1,
      team2DisplayName: pastTeam2,
    });

    await gotoLocal(page, '/games');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Upcoming fixtures' }),
    ).toBeVisible();
    await expect(page.getByText(upcomingFixtureName)).toBeVisible();
    await expect(page.getByText(pastFixtureName)).toHaveCount(0);

    await page.getByRole('button', { name: 'Past' }).click();

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Past scheduled fixtures',
      }),
    ).toBeVisible();
    await expect(page.getByText(pastFixtureName)).toBeVisible();
    await expect(page.getByText(upcomingFixtureName)).toHaveCount(0);

    await page.getByRole('button', { name: 'Upcoming' }).click();
    await page
      .getByRole('listitem')
      .filter({ hasText: upcomingFixtureName })
      .getByRole('link', { name: 'View fixture' })
      .click();

    await expect(page).toHaveURL(/\/games\/[a-zA-Z0-9]+/);
    await expect(
      page.getByRole('heading', { level: 1, name: upcomingFixtureName }),
    ).toBeVisible();
    await expect(page.getByText('Cape Town Stadium')).toBeVisible();
    await expect(page.getByText('Predictions are not open yet.')).toBeVisible();
  });

  test('lets platform admins create, publish, and cancel a fixture through the admin workflow', async ({
    page,
  }) => {
    const email = uniqueEmail('admin');
    const team1 = uniqueLabel('Springboks');
    const team2 = uniqueLabel('All Blacks');
    const fixtureName = `${team1} vs ${team2}`;

    await callMeteor(page, TEST_AUTH_METHODS.createVerifiedUser, email);
    await callMeteor(page, TEST_AUTH_METHODS.setAdminForEmail, email, true);

    await loginWithTestToken(page, email);
    await gotoLocal(page, '/admin');
    await expect(
      page.getByRole('heading', { name: 'Admin access summary' }),
    ).toBeVisible();

    await page.getByLabel('Team 1 display name').fill(team1);
    await page.getByLabel('Team 2 display name').fill(team2);
    await page
      .getByLabel('Competition display name')
      .fill('International Tests');
    await page
      .getByLabel('Kickoff, South African time (Africa/Johannesburg)')
      .fill('2030-02-03T18:45');
    await page.getByLabel('Venue').fill('Ellis Park');
    await page.getByRole('button', { name: 'Create draft' }).click();

    const row = page.getByRole('listitem').filter({ hasText: fixtureName });

    await expect(row.getByText('Draft')).toBeVisible();

    await row.getByRole('button', { name: 'Publish' }).click();

    await expect(row.getByText('Published')).toBeVisible();

    page.once('dialog', (dialog) => void dialog.accept());
    await row.getByRole('button', { name: 'Cancel' }).click();

    await expect(row.getByText('Cancelled')).toBeVisible();

    await gotoLocal(page, '/games');
    await expect(page.getByText(fixtureName)).toBeVisible();
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: fixtureName })
        .getByText('Cancelled'),
    ).toBeVisible();
  });
});
