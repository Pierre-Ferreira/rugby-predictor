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

const gotoApp = async (page: Page, path: string) => {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
};

test.describe('Rugby Rooster foundation', () => {
  test('exposes minimal PWA metadata without service workers', async ({
    page,
    request,
  }) => {
    await gotoApp(page, '/games');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Upcoming fixtures',
      }),
    ).toBeVisible();

    const metadata = await page.evaluate(() => {
      const manifest = document.querySelector<HTMLLinkElement>(
        'link[rel="manifest"]',
      );
      const appleTouchIcon = document.querySelector<HTMLLinkElement>(
        'link[rel="apple-touch-icon"]',
      );
      const favicon =
        document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      const themeColor = document.querySelector<HTMLMetaElement>(
        'meta[name="theme-color"]',
      );
      const viewport = document.querySelectorAll<HTMLMetaElement>(
        'meta[name="viewport"]',
      );

      return {
        appleTouchIconHref: appleTouchIcon?.href ?? null,
        faviconHref: favicon?.href ?? null,
        manifestHref: manifest?.href ?? null,
        themeColor: themeColor?.content ?? null,
        viewportContents: Array.from(viewport).map((meta) => meta.content),
      };
    });

    expect(metadata.manifestHref).toBeTruthy();
    expect(metadata.appleTouchIconHref).toBeTruthy();
    expect(metadata.faviconHref).toMatch(/\/favicon\.svg$/);
    expect(metadata.themeColor).toBe('#161f26');
    expect(metadata.viewportContents).toEqual([
      'width=device-width, initial-scale=1.0, viewport-fit=cover',
    ]);

    const manifestResponse = await request.get(metadata.manifestHref ?? '/');

    expect(manifestResponse.status()).toBe(200);
    expect(manifestResponse.headers()['content-type']).toContain(
      'application/manifest+json',
    );

    const manifestText = await manifestResponse.text();
    expect(manifestText).not.toContain('<html');

    const manifest = JSON.parse(manifestText) as {
      readonly display?: string;
      readonly icons?: readonly {
        readonly purpose?: string;
        readonly sizes?: string;
        readonly src?: string;
        readonly type?: string;
      }[];
      readonly scope?: string;
      readonly start_url?: string;
    };

    const startUrl = manifest.start_url;

    expect(startUrl).toBe('/games');
    expect(new URL(startUrl ?? '/', page.url()).search).toBe('');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');

    const pngIcons = manifest.icons ?? [];

    expect(
      pngIcons.some(
        (icon) =>
          icon.src === '/icons/rr-icon-192.png' &&
          icon.sizes === '192x192' &&
          icon.type === 'image/png',
      ),
    ).toBe(true);
    expect(
      pngIcons.some(
        (icon) =>
          icon.src === '/icons/rr-maskable-512.png' &&
          icon.sizes === '512x512' &&
          icon.type === 'image/png' &&
          icon.purpose === 'maskable',
      ),
    ).toBe(true);

    const iconPaths = [
      '/icons/rr-icon-192.png',
      '/icons/rr-icon-512.png',
      '/icons/rr-maskable-512.png',
      '/icons/apple-touch-icon.png',
    ] as const;
    type IconPath = (typeof iconPaths)[number];
    const iconExpectations: Record<IconPath, number> = {
      '/icons/apple-touch-icon.png': 180,
      '/icons/rr-icon-192.png': 192,
      '/icons/rr-icon-512.png': 512,
      '/icons/rr-maskable-512.png': 512,
    };

    for (const iconPath of iconPaths) {
      const response = await request.get(iconPath);

      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    }

    const imageDimensions = await page.evaluate(async (paths) => {
      const loadImage = (path: string) =>
        new Promise<{
          readonly height: number;
          readonly path: string;
          readonly width: number;
        }>((resolve, reject) => {
          const image = new Image();

          image.onload = () => {
            resolve({
              height: image.naturalHeight,
              path,
              width: image.naturalWidth,
            });
          };
          image.onerror = () => reject(new Error(`Failed to load ${path}`));
          image.src = path;
        });

      return Promise.all(paths.map(loadImage));
    }, iconPaths);

    for (const [iconPath, expectedSize] of Object.entries(iconExpectations) as [
      IconPath,
      number,
    ][]) {
      const icon = imageDimensions.find((image) => image.path === iconPath);

      expect(icon).toBeDefined();
      expect(icon?.width).toBe(expectedSize);
      expect(icon?.height).toBe(expectedSize);
    }

    const serviceWorkerState = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) {
        return {
          controller: false,
          registrations: 0,
          supported: false,
        };
      }

      const registrations = await navigator.serviceWorker.getRegistrations();

      return {
        controller: Boolean(navigator.serviceWorker.controller),
        registrations: registrations.length,
        supported: true,
      };
    });

    expect(serviceWorkerState.controller).toBe(false);
    expect(serviceWorkerState.registrations).toBe(0);
  });

  test('homepage renders Rugby Rooster identity', async ({ page }) => {
    await gotoApp(page, '/');

    await expect(page).toHaveTitle('Rugby Rooster');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Rugby Rooster' }),
    ).toBeVisible();
    await expect(
      page.getByText('Standalone rugby prediction game'),
    ).toBeVisible();
  });

  test('homepage navigation reaches fixture browsing', async ({ page }) => {
    await gotoApp(page, '/');

    await page.getByRole('link', { name: 'Browse games' }).click();

    await expect(page).toHaveURL('/games');
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Upcoming fixtures',
      }),
    ).toBeVisible();
  });

  test('games route loads directly and survives refresh', async ({ page }) => {
    await gotoApp(page, '/games');

    const emptyState = page.getByRole('heading', {
      level: 1,
      name: 'Upcoming fixtures',
    });
    await expect(emptyState).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL('/games');
    await expect(emptyState).toBeVisible();
  });

  test('browser back and forward navigation preserve routes', async ({
    page,
  }) => {
    await gotoApp(page, '/');
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
        name: 'Upcoming fixtures',
      }),
    ).toBeVisible();
  });

  test('keyboard navigation can reach the games route', async ({ page }) => {
    await gotoApp(page, '/');

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
        name: 'Upcoming fixtures',
      }),
    ).toBeVisible();
  });

  test('admin route requires sign-in before showing protected content', async ({
    page,
  }) => {
    await gotoApp(page, '/admin');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Sign in to continue' }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Admin access is available only after email-link sign-in with an authorised account.',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Email me a sign-in link' }),
    ).toBeVisible();
  });

  test('unknown paths display the not-found page', async ({ page }) => {
    await gotoApp(page, '/unknown-foundation-route');

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
        await gotoApp(page, path);
        await expectNoHorizontalOverflow(page);
      }
    });
  }
});
