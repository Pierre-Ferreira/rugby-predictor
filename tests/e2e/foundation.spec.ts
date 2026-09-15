import { expect, type Page, test } from '@playwright/test';

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

test.describe('Rugby Rooster foundation', () => {
  test('homepage renders Rugby Rooster identity', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('Rugby Rooster');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Rugby Rooster' }),
    ).toBeVisible();
    await expect(
      page.getByText('Standalone rugby prediction game'),
    ).toBeVisible();
  });

  test('homepage navigation reaches the games empty state', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Browse games' }).click();

    await expect(page).toHaveURL('/games');
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'No games are available yet',
      }),
    ).toBeVisible();
  });

  test('games route loads directly and survives refresh', async ({ page }) => {
    await page.goto('/games');

    const emptyState = page.getByRole('heading', {
      level: 1,
      name: 'No games are available yet',
    });
    await expect(emptyState).toBeVisible();

    await page.reload();

    await expect(page).toHaveURL('/games');
    await expect(emptyState).toBeVisible();
  });

  test('browser back and forward navigation preserve routes', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Browse games' }).click();
    await expect(page).toHaveURL('/games');

    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Rugby Rooster' }),
    ).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL('/games');
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'No games are available yet',
      }),
    ).toBeVisible();
  });

  test('keyboard navigation can reach the games route', async ({ page }) => {
    await page.goto('/');

    const gamesNavLink = page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'Games' });

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(gamesNavLink).toBeFocused();

    await page.keyboard.press('Enter');

    await expect(page).toHaveURL('/games');
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'No games are available yet',
      }),
    ).toBeVisible();
  });

  test('admin route requires sign-in before showing protected content', async ({
    page,
  }) => {
    await page.goto('/admin');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Sign in to continue' }),
    ).toBeVisible();
    await expect(
      page.getByText('Platform administration is available only'),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Email me a sign-in link' }),
    ).toBeVisible();
  });

  test('unknown paths display the not-found page', async ({ page }) => {
    await page.goto('/unknown-foundation-route');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeVisible();
  });

  for (const viewport of [
    { height: 900, name: 'desktop', width: 1440 },
    { height: 844, name: 'mobile', width: 390 },
  ]) {
    test(`public and admin layouts have no horizontal overflow on ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        height: viewport.height,
        width: viewport.width,
      });

      for (const path of ['/', '/games', '/sign-in', '/account', '/admin']) {
        await page.goto(path);
        await expectNoHorizontalOverflow(page);
      }
    });
  }
});
