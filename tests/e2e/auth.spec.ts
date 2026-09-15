import { expect, type Page, test } from '@playwright/test';

import { TEST_AUTH_METHODS } from '../../imports/shared/auth/methods';

const uniqueEmail = (label: string) =>
  `ccpp004-e2e-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;

const NAVIGATION_ATTEMPT_TIMEOUT_MS = 15_000;

const isTransientLocalNavigationError = (error: unknown) =>
  error instanceof Error &&
  (error.message.includes('net::ERR_ABORTED') ||
    error.message.includes('Timeout') ||
    error.message.includes('Execution context was destroyed'));

const waitForMeteorClient = async (page: Page) => {
  await page.waitForFunction(() => Boolean(window.Meteor), {
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
  try {
    await page.goto(url, {
      timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS,
      waitUntil: 'domcontentloaded',
    });
    await waitForMeteorClient(page);
  } catch (error) {
    if (isTransientLocalNavigationError(error)) {
      await page.goto(url, {
        timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS,
        waitUntil: 'domcontentloaded',
      });
      await waitForMeteorClient(page);
      return;
    }

    throw error;
  }
};

const resetAuthState = async (page: Page) => {
  await gotoLocal(page, '/');
  await callMeteor(page, TEST_AUTH_METHODS.reset);
};

const latestMailFor = async (page: Page, email: string) =>
  callMeteor<{
    readonly subject: string;
    readonly text: string;
    readonly url: string;
  } | null>(page, TEST_AUTH_METHODS.latestMailFor, email);

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
    };
  }
}

test.describe('passwordless authentication', () => {
  test.beforeEach(async ({ page }) => {
    await resetAuthState(page);
  });

  test('requests a real email link, redeems it in a fresh browser, restores the session, and signs out', async ({
    browser,
    page,
  }) => {
    const email = uniqueEmail('player');

    await gotoLocal(page, '/sign-in?returnTo=%2Faccount');
    await page.getByLabel('Email address').fill(email);
    await page.getByRole('button', { name: 'Email me a sign-in link' }).click();

    await expect(
      page.getByText('Check your email for a Rugby Rooster sign-in link.'),
    ).toBeVisible();

    const mail = await latestMailFor(page, email);
    expect(mail?.subject).toBe('Your Rugby Rooster sign-in link');
    expect(mail?.text).toContain('within 15 minutes');
    expect(mail?.url).toContain('/auth/email-link');
    expect(mail?.url).not.toContain('loginToken=');

    const context = await browser.newContext();
    const linkPage = await context.newPage();

    await gotoLocal(linkPage, mail?.url ?? '/');
    await expect(linkPage).toHaveURL(
      /\/auth\/email-link\?returnTo=%2Faccount$/,
    );
    await expect(
      linkPage.getByRole('heading', { name: 'Continue signing in' }),
    ).toBeVisible();

    await linkPage.getByRole('button', { name: 'Continue signing in' }).click();
    await expect(linkPage).toHaveURL('/account');
    await expect(
      linkPage.getByRole('heading', {
        level: 1,
        name: 'Your Rugby Rooster account',
      }),
    ).toBeVisible();
    await expect(linkPage.getByText(email)).toBeVisible();

    const storedSession = await linkPage.evaluate(() =>
      window.localStorage.getItem('Meteor.loginToken'),
    );
    expect(storedSession).toBeTruthy();

    await linkPage.reload();
    await expect(linkPage).toHaveURL('/account');
    await expect(linkPage.getByText('Verified player')).toBeVisible();

    await linkPage
      .getByRole('main')
      .getByRole('button', { name: 'Sign out' })
      .click();
    await expect(linkPage).toHaveURL('/games');

    await gotoLocal(linkPage, '/account');
    await expect(
      linkPage.getByRole('heading', { name: 'Sign in to view your account' }),
    ).toBeVisible();

    await context.close();
  });

  test('denies ordinary players, allows admins, and removes admin access after revocation', async ({
    page,
  }) => {
    const email = uniqueEmail('admin');

    await gotoLocal(page, '/sign-in?returnTo=%2Fadmin');
    await page.getByLabel('Email address').fill(email);
    await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
    const mail = await latestMailFor(page, email);

    await gotoLocal(page, mail?.url ?? '/');
    await page.getByRole('button', { name: 'Continue signing in' }).click();

    await expect(page).toHaveURL('/admin');
    await expect(
      page.getByRole('heading', { name: 'Admin access is restricted' }),
    ).toBeVisible();

    await callMeteor(page, TEST_AUTH_METHODS.setAdminForEmail, email, true);
    await page.reload();

    await expect(
      page.getByRole('heading', { name: 'Admin access summary' }),
    ).toBeVisible();
    await expect(page.getByText('accounts-passwordless 3.1.1')).toBeVisible();

    await callMeteor(page, TEST_AUTH_METHODS.setAdminForEmail, email, false);
    await page.reload();

    await expect(
      page.getByRole('heading', { name: 'Admin access is restricted' }),
    ).toBeVisible();
  });

  test('shows invalid-link recovery without leaking credentials in the final URL', async ({
    page,
  }) => {
    const email = uniqueEmail('invalid');

    await gotoLocal(page, '/sign-in?returnTo=%2Faccount');
    await page.getByLabel('Email address').fill(email);
    await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
    const mail = await latestMailFor(page, email);
    const url = new URL(mail?.url ?? 'http://127.0.0.1:3200/');
    url.searchParams.set('token', 'BADBAD');

    await gotoLocal(page, url.toString());
    await expect(
      page.getByRole('heading', { name: 'Continue signing in' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/email-link\?returnTo=%2Faccount$/);
    await page.getByRole('button', { name: 'Continue signing in' }).click();

    await expect(
      page.getByText('This sign-in link is invalid, expired, or already used.'),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Request another link' }),
    ).toBeVisible();
  });

  test('blocks forbidden client user updates after sign-in', async ({
    page,
  }) => {
    const email = uniqueEmail('client-update');

    await gotoLocal(page, '/sign-in?returnTo=%2Faccount');
    await page.getByLabel('Email address').fill(email);
    await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
    const mail = await latestMailFor(page, email);

    await gotoLocal(page, mail?.url ?? '/');
    await page.getByRole('button', { name: 'Continue signing in' }).click();
    await expect(page).toHaveURL('/account');

    const updateResult = await page.evaluate(
      () =>
        new Promise<{ readonly error?: string; readonly user: unknown }>(
          (resolve) => {
            window.Meteor.users.update(
              window.Meteor.userId(),
              {
                $set: {
                  'emails.0.verified': false,
                  'roles.platformAdmin': true,
                },
              },
              (error) => {
                resolve({
                  error: error?.error,
                  user: window.Meteor.user(),
                });
              },
            );
          },
        ),
    );

    expect(updateResult.error).toBeTruthy();
    expect(JSON.stringify(updateResult.user)).not.toContain('services');

    await gotoLocal(page, '/admin');
    await expect(
      page.getByRole('heading', { name: 'Admin access is restricted' }),
    ).toBeVisible();
  });

  test('keeps sign-in usable on mobile and keyboard navigation', async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await gotoLocal(page, '/sign-in');

    await expectNoHorizontalOverflow(page);

    for (let index = 0; index < 8; index += 1) {
      if (
        await page
          .getByLabel('Email address')
          .evaluate((input) => input === document.activeElement)
      ) {
        break;
      }

      await page.keyboard.press('Tab');
    }

    await expect(page.getByLabel('Email address')).toBeFocused();
  });
});
