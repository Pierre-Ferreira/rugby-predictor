import { expect, type Page, test } from '@playwright/test';

import { TEST_AUTH_METHODS } from '../../imports/shared/auth/methods';
import {
  FIXTURE_METHODS,
  TEST_FIXTURE_METHODS,
} from '../../imports/shared/fixtures';

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

const loginAsFixtureAdmin = async (page: Page, label: string) => {
  const email = uniqueEmail(label);

  await callMeteor(page, TEST_AUTH_METHODS.createVerifiedUser, email);
  await callMeteor(page, TEST_AUTH_METHODS.setAdminForEmail, email, true);
  await loginWithTestToken(page, email);

  return email;
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

const isoDaysFromNow = (days: number): string =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

const futureKickoffIso = (index: number): string =>
  new Date(Date.UTC(2098, 0, index + 1, 12, 0, 0)).toISOString();

const recentPastKickoffIso = (index: number): string =>
  new Date(Date.now() - (index + 1) * 60 * 1000).toISOString();

interface ClientFixtureSnapshot {
  readonly _id: string;
  readonly competitionDisplayName: string;
  readonly revision: number;
  readonly scheduledKickoffAt: string;
  readonly team1DisplayName: string;
  readonly team2DisplayName: string;
  readonly venueDisplayName?: string;
  readonly visibility: string;
}

interface ClientFixtureCollection {
  find: (selector?: Record<string, unknown>) => {
    fetch: () => readonly ClientFixtureRecord[];
  };
  findOne: (id: string) => ClientFixtureRecord | undefined;
}

interface ClientFixtureRecord {
  readonly _id: string;
  readonly competitionDisplayName: string;
  readonly revision: number;
  readonly scheduledKickoffAt: Date | string;
  readonly team1DisplayName: string;
  readonly team2DisplayName: string;
  readonly venueDisplayName?: string;
  readonly visibility: string;
}

interface MeteorFixtureStoreClient {
  readonly connection?: {
    readonly _stores?: {
      readonly fixtures?: {
        readonly _getCollection?: () => ClientFixtureCollection;
      };
    };
  };
}

const readClientFixture = async (
  page: Page,
  fixtureId: string,
): Promise<ClientFixtureSnapshot | null> =>
  page.evaluate<ClientFixtureSnapshot | null, string>((id) => {
    const meteor = window.Meteor as typeof window.Meteor &
      MeteorFixtureStoreClient;
    const collection = meteor.connection?._stores?.fixtures?._getCollection?.();
    const fixture = collection?.findOne(id);

    if (!fixture) {
      return null;
    }

    const scheduledKickoffAt =
      fixture.scheduledKickoffAt instanceof Date
        ? fixture.scheduledKickoffAt.toISOString()
        : String(fixture.scheduledKickoffAt);

    return {
      _id: fixture._id,
      competitionDisplayName: fixture.competitionDisplayName,
      revision: fixture.revision,
      scheduledKickoffAt,
      team1DisplayName: fixture.team1DisplayName,
      team2DisplayName: fixture.team2DisplayName,
      ...(fixture.venueDisplayName
        ? { venueDisplayName: fixture.venueDisplayName }
        : {}),
      visibility: fixture.visibility,
    };
  }, fixtureId);

const readClientFixtureByTeams = async (
  page: Page,
  team1DisplayName: string,
  team2DisplayName: string,
): Promise<ClientFixtureSnapshot | null> =>
  page.evaluate<
    ClientFixtureSnapshot | null,
    { readonly team1DisplayName: string; readonly team2DisplayName: string }
  >(
    (selector) => {
      const meteor = window.Meteor as typeof window.Meteor &
        MeteorFixtureStoreClient;
      const collection =
        meteor.connection?._stores?.fixtures?._getCollection?.();
      const fixture = collection
        ?.find({
          team1DisplayName: selector.team1DisplayName,
          team2DisplayName: selector.team2DisplayName,
        })
        .fetch()[0];

      if (!fixture) {
        return null;
      }

      const scheduledKickoffAt =
        fixture.scheduledKickoffAt instanceof Date
          ? fixture.scheduledKickoffAt.toISOString()
          : String(fixture.scheduledKickoffAt);

      return {
        _id: fixture._id,
        competitionDisplayName: fixture.competitionDisplayName,
        revision: fixture.revision,
        scheduledKickoffAt,
        team1DisplayName: fixture.team1DisplayName,
        team2DisplayName: fixture.team2DisplayName,
        ...(fixture.venueDisplayName
          ? { venueDisplayName: fixture.venueDisplayName }
          : {}),
        visibility: fixture.visibility,
      };
    },
    { team1DisplayName, team2DisplayName },
  );

const editFixtureDetails = async (
  page: Page,
  input: {
    readonly competitionDisplayName: string;
    readonly expectedRevision: number;
    readonly fixtureId: string;
    readonly scheduledKickoffAt: string;
    readonly team1DisplayName: string;
    readonly team2DisplayName: string;
    readonly venueDisplayName?: string;
  },
) =>
  callMeteor(page, FIXTURE_METHODS.editDetails, {
    details: {
      competitionDisplayName: input.competitionDisplayName,
      scheduledKickoffAt: input.scheduledKickoffAt,
      team1DisplayName: input.team1DisplayName,
      team2DisplayName: input.team2DisplayName,
      ...(input.venueDisplayName
        ? { venueDisplayName: input.venueDisplayName }
        : {}),
    },
    expectedRevision: input.expectedRevision,
    fixtureId: input.fixtureId,
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
    const team1 = uniqueLabel('Springboks');
    const team2 = uniqueLabel('All Blacks');
    const fixtureName = `${team1} vs ${team2}`;

    await loginAsFixtureAdmin(page, 'admin');
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
      .fill('2098-02-03T18:45');
    await page.getByLabel('Venue').fill('Ellis Park');
    await page.getByRole('button', { name: 'Create draft' }).click();

    const row = page.getByRole('listitem').filter({ hasText: fixtureName });

    await expect(row.getByText('Draft')).toBeVisible();
    const createdFixture = await readClientFixtureByTeams(page, team1, team2);
    expect(createdFixture?._id).toBeTruthy();

    await row.getByRole('button', { name: 'Publish' }).click();

    await expect(row.getByText('Published')).toBeVisible();

    page.once('dialog', (dialog) => void dialog.accept());
    await row.getByRole('button', { name: 'Cancel' }).click();

    await expect(row.getByText('Cancelled')).toBeVisible();

    await gotoLocal(page, `/games/${createdFixture?._id}`);
    await expect(
      page.getByRole('heading', { level: 1, name: fixtureName }),
    ).toBeVisible();
    await expect(page.getByText('Cancelled')).toBeVisible();
  });

  test('paginates public and admin fixture lists with next and previous controls', async ({
    page,
  }) => {
    const publicLabel = uniqueLabel('Public Paging');
    const publicFixtureName = (index: number) =>
      `${publicLabel} Team ${index.toString().padStart(2, '0')} vs ${publicLabel} Opponent ${index.toString().padStart(2, '0')}`;

    for (let index = 0; index < 51; index += 1) {
      await createPublishedFixture(page, {
        competitionDisplayName: 'Public Pagination Cup',
        scheduledKickoffAt: recentPastKickoffIso(index),
        team1DisplayName: `${publicLabel} Team ${index.toString().padStart(2, '0')}`,
        team2DisplayName: `${publicLabel} Opponent ${index.toString().padStart(2, '0')}`,
      });
    }

    await gotoLocal(page, '/games');
    await page.getByRole('button', { name: 'Past' }).click();

    await expect(page.getByText(publicFixtureName(0))).toBeVisible();
    await expect(page.getByText(publicFixtureName(10))).toHaveCount(0);

    await page.getByRole('button', { name: 'Next fixtures' }).click();

    await expect(page.getByText(publicFixtureName(10))).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Previous fixtures' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Previous fixtures' }).click();

    await expect(page.getByText(publicFixtureName(0))).toBeVisible();

    const adminLabel = uniqueLabel('Admin Paging');
    const adminFixtureName = (index: number) =>
      `${adminLabel} Team ${index.toString().padStart(2, '0')} vs ${adminLabel} Opponent ${index.toString().padStart(2, '0')}`;

    for (let index = 0; index < 51; index += 1) {
      await createPublishedFixture(page, {
        competitionDisplayName: 'Admin Pagination Cup',
        scheduledKickoffAt: futureKickoffIso(index),
        team1DisplayName: `${adminLabel} Team ${index.toString().padStart(2, '0')}`,
        team2DisplayName: `${adminLabel} Opponent ${index.toString().padStart(2, '0')}`,
      });
    }

    await loginAsFixtureAdmin(page, 'paging-admin');
    await gotoLocal(page, '/admin');

    await expect(page.getByText(adminFixtureName(50))).toBeVisible();
    await expect(page.getByText(adminFixtureName(0))).toHaveCount(0);

    await page.getByRole('button', { name: 'Next fixtures' }).click();

    await expect(page.getByText(adminFixtureName(0))).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Previous fixtures' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Previous fixtures' }).click();

    await expect(page.getByText(adminFixtureName(50))).toBeVisible();
  });

  test('rejects stale fixture edits without replacing form values or newer details', async ({
    page,
  }) => {
    const originalTeam1 = uniqueLabel('Stale Springboks');
    const originalTeam2 = uniqueLabel('Stale All Blacks');
    const competingTeam2 = uniqueLabel('Competing All Blacks');
    const unsavedTeam1 = uniqueLabel('Unsaved Springboks');
    const savedAfterReloadTeam1 = uniqueLabel('Reloaded Springboks');
    const scheduledKickoffAt = futureKickoffIso(5);
    const competitionDisplayName = 'Edit Conflict Cup';
    const venueDisplayName = 'Athlone Stadium';
    const fixtureId = (
      await createPublishedFixture(page, {
        competitionDisplayName,
        scheduledKickoffAt,
        team1DisplayName: originalTeam1,
        team2DisplayName: originalTeam2,
        venueDisplayName,
      })
    ).fixtureId;

    await loginAsFixtureAdmin(page, 'stale-edit-admin');
    await gotoLocal(page, '/admin');

    await page
      .getByRole('listitem')
      .filter({ hasText: `${originalTeam1} vs ${originalTeam2}` })
      .getByRole('button', { name: 'Edit' })
      .click();
    await page.getByLabel('Team 1 display name').fill(unsavedTeam1);

    await editFixtureDetails(page, {
      competitionDisplayName,
      expectedRevision: 1,
      fixtureId,
      scheduledKickoffAt,
      team1DisplayName: originalTeam1,
      team2DisplayName: competingTeam2,
      venueDisplayName,
    });

    await expect
      .poll(async () => (await readClientFixture(page, fixtureId))?.revision)
      .toBe(2);
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: `${originalTeam1} vs ${competingTeam2}` }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Save fixture' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'This fixture changed before your update could be saved.',
    );
    await expect(
      page.getByText('This edit still uses the original revision.'),
    ).toBeVisible();
    await expect(page.getByLabel('Team 1 display name')).toHaveValue(
      unsavedTeam1,
    );
    await expect(page.getByLabel('Team 2 display name')).toHaveValue(
      originalTeam2,
    );

    const afterConflict = await readClientFixture(page, fixtureId);
    expect(afterConflict).toMatchObject({
      revision: 2,
      team1DisplayName: originalTeam1,
      team2DisplayName: competingTeam2,
    });

    await page.getByRole('button', { name: 'Reload and replace form' }).click();

    await expect(page.getByLabel('Team 1 display name')).toHaveValue(
      originalTeam1,
    );
    await expect(page.getByLabel('Team 2 display name')).toHaveValue(
      competingTeam2,
    );

    await page.getByLabel('Team 1 display name').fill(savedAfterReloadTeam1);
    await page.getByRole('button', { name: 'Save fixture' }).click();

    await expect(page.getByRole('status')).toContainText(
      'Fixture details saved.',
    );
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: `${savedAfterReloadTeam1} vs ${competingTeam2}` }),
    ).toBeVisible();
  });

  test('clears edit session and form values together when admin pagination changes', async ({
    page,
  }) => {
    const label = uniqueLabel('Edit Paging');
    const fixtureName = (index: number) =>
      `${label} Team ${index.toString().padStart(2, '0')} vs ${label} Opponent ${index.toString().padStart(2, '0')}`;
    const unsavedTeam1 = uniqueLabel('Pagination Unsaved');

    for (let index = 0; index < 51; index += 1) {
      await createPublishedFixture(page, {
        competitionDisplayName: 'Pagination Edit Cup',
        scheduledKickoffAt: futureKickoffIso(index),
        team1DisplayName: `${label} Team ${index.toString().padStart(2, '0')}`,
        team2DisplayName: `${label} Opponent ${index.toString().padStart(2, '0')}`,
      });
    }

    await loginAsFixtureAdmin(page, 'pagination-edit-admin');
    await gotoLocal(page, '/admin');

    await page
      .getByRole('listitem')
      .filter({ hasText: fixtureName(50) })
      .getByRole('button', { name: 'Edit' })
      .click();
    await page.getByLabel('Team 1 display name').fill(unsavedTeam1);
    await page.getByRole('button', { name: 'Next fixtures' }).click();

    await expect(page.getByText(fixtureName(0))).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Create draft fixture' }),
    ).toBeVisible();
    await expect(page.getByLabel('Team 1 display name')).toHaveValue('');
    await expect(page.getByLabel('Team 2 display name')).toHaveValue('');
    await expect(
      page.getByRole('button', { name: 'Create draft' }),
    ).toBeVisible();
  });

  test('keeps edit semantics when the edited fixture leaves the visible page', async ({
    page,
  }) => {
    const label = uniqueLabel('Moved Edit');
    const fixtureName = (index: number) =>
      `${label} Team ${index.toString().padStart(2, '0')} vs ${label} Opponent ${index.toString().padStart(2, '0')}`;
    const unsavedTeam1 = uniqueLabel('Moved Unsaved');
    let movedFixtureId = '';

    for (let index = 0; index < 51; index += 1) {
      const result = await createPublishedFixture(page, {
        competitionDisplayName: 'Moving Fixture Cup',
        scheduledKickoffAt: futureKickoffIso(index),
        team1DisplayName: `${label} Team ${index.toString().padStart(2, '0')}`,
        team2DisplayName: `${label} Opponent ${index.toString().padStart(2, '0')}`,
      });

      if (index === 50) {
        movedFixtureId = result.fixtureId;
      }
    }

    await loginAsFixtureAdmin(page, 'moved-edit-admin');
    await gotoLocal(page, '/admin');

    await page
      .getByRole('listitem')
      .filter({ hasText: fixtureName(50) })
      .getByRole('button', { name: 'Edit' })
      .click();
    await page.getByLabel('Team 1 display name').fill(unsavedTeam1);

    await editFixtureDetails(page, {
      competitionDisplayName: 'Moving Fixture Cup',
      expectedRevision: 1,
      fixtureId: movedFixtureId,
      scheduledKickoffAt: new Date(
        Date.UTC(2029, 0, 1, 12, 0, 0),
      ).toISOString(),
      team1DisplayName: `${label} Team 50`,
      team2DisplayName: `${label} Opponent 50`,
    });

    await expect(page.getByText(fixtureName(50))).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Edit fixture' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Save fixture' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Reload and replace form' }),
    ).toBeDisabled();

    await page.getByRole('button', { name: 'Save fixture' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'This fixture changed before your update could be saved.',
    );
    await expect(page.getByLabel('Team 1 display name')).toHaveValue(
      unsavedTeam1,
    );
    await expect(
      page.getByRole('button', { name: 'Save fixture' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Create draft' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Draft' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('listitem').filter({ hasText: unsavedTeam1 }),
    ).toHaveCount(0);
  });
});
