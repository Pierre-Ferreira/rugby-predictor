import assert from 'node:assert/strict';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

import { Fixtures } from '/imports/api/fixtures/collection';
import {
  FIXTURE_METHODS,
  FIXTURE_PUBLICATIONS,
  INITIAL_FIXTURE_REVISION,
  type FixtureDocument,
  type FixtureListCursor,
  type FixtureMutationResult,
} from '/imports/shared/fixtures';
import { defaultRuleset, type RulesetSnapshot } from '/imports/shared/scoring';
import { TEST_AUTH_METHODS } from '/imports/shared/auth/methods';
import { getAuthTestRunId } from '/imports/server/auth/settings';
import { resetTestAuthData } from '/imports/server/auth/testSupport';
import { backfillFixtureRevisions } from './server';
import { resetFixtureTestData } from './testSupport';

type MethodHandler = (
  this: Meteor.MethodThisType,
  ...args: unknown[]
) => Promise<unknown>;

type PublicationHandler = (
  this: {
    readonly userId: string | null;
    ready: () => readonly unknown[];
  },
  ...args: unknown[]
) => Promise<unknown> | unknown;

interface TestInvocation extends Meteor.MethodThisType {
  userId: string | null;
}

const handlers = (): Record<string, MethodHandler> =>
  (
    Meteor as unknown as {
      server: {
        method_handlers: Record<string, MethodHandler>;
      };
    }
  ).server.method_handlers;

const publishHandlers = (): Record<string, PublicationHandler> =>
  (
    Meteor as unknown as {
      server: {
        publish_handlers: Record<string, PublicationHandler>;
      };
    }
  ).server.publish_handlers;

const makeInvocation = (label = Random.id()): TestInvocation => {
  const invocation: {
    connection: {
      clientAddress: string;
      close: () => undefined;
      id: string;
    };
    isSimulation: false;
    setUserId: (userId: string | null) => Promise<void>;
    unblock: () => undefined;
    userId: string | null;
  } = {
    connection: {
      clientAddress: '127.0.0.1',
      close: () => undefined,
      id: `fixture-test-${label}`,
    },
    isSimulation: false,
    setUserId(userId: string | null) {
      invocation.userId = userId;
      return Promise.resolve();
    },
    unblock: () => undefined,
    userId: null,
  };

  return invocation as unknown as TestInvocation;
};

const callMethod = async <TResult>(
  name: string,
  args: readonly unknown[] = [],
  invocation = makeInvocation(),
): Promise<TResult> => {
  const handler = handlers()[name];

  assert.equal(typeof handler, 'function', `${name} method exists`);

  return (await handler.apply(invocation, [...args])) as TResult;
};

const fetchPublication = async <TDocument>(
  name: string,
  args: readonly unknown[] = [],
  userId: string | null = null,
): Promise<TDocument[]> => {
  const handler = publishHandlers()[name];

  assert.equal(typeof handler, 'function', `${name} publication exists`);

  const result = await handler.apply(
    {
      ready: () => [],
      userId,
    },
    [...args],
  );

  if (!result || Array.isArray(result)) {
    return [];
  }

  if (
    typeof result === 'object' &&
    'fetchAsync' in result &&
    typeof result.fetchAsync === 'function'
  ) {
    return (await result.fetchAsync()) as TDocument[];
  }

  throw new Error(`${name} returned an unsupported publication result`);
};

const uniqueEmail = (prefix: string): string =>
  `ccpp005-${prefix}-${Random.id().toLowerCase()}@example.test`;

const createVerifiedAdmin = async () => {
  const email = uniqueEmail('admin');
  const user = await callMethod<{
    readonly email: string;
    readonly userId: string;
  }>(TEST_AUTH_METHODS.createVerifiedUser, [email]);

  assert.equal(
    await callMethod(TEST_AUTH_METHODS.setAdminForEmail, [email, true]),
    true,
  );

  const invocation = makeInvocation('admin');
  invocation.userId = user.userId;

  return {
    email,
    invocation,
    userId: user.userId,
  };
};

const createVerifiedPlayerInvocation = async () => {
  const email = uniqueEmail('player');
  const user = await callMethod<{
    readonly userId: string;
  }>(TEST_AUTH_METHODS.createVerifiedUser, [email]);
  const invocation = makeInvocation('player');
  invocation.userId = user.userId;

  return invocation;
};

const fixtureDetails = (
  overrides: Partial<{
    readonly competitionDisplayName: string;
    readonly scheduledKickoffAt: string;
    readonly team1DisplayName: string;
    readonly team2DisplayName: string;
    readonly venueDisplayName: string;
  }> = {},
) => ({
  competitionDisplayName: 'United Rugby Championship',
  scheduledKickoffAt: '2026-10-25T13:30:00.000Z',
  team1DisplayName: 'Stormers',
  team2DisplayName: 'Bulls',
  venueDisplayName: 'Cape Town Stadium',
  ...overrides,
});

const testFixtureOwner = (): {
  readonly rugbyRoosterTest: { readonly ownerRunId: string };
} => {
  const ownerRunId = getAuthTestRunId();

  assert.ok(ownerRunId, 'fixture test run id exists');

  return {
    rugbyRoosterTest: {
      ownerRunId,
    },
  };
};

const insertFixtureDocument = async (
  overrides: Partial<FixtureDocument> = {},
): Promise<string> => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const document = {
    ...testFixtureOwner(),
    competitionDisplayName: 'United Rugby Championship',
    createdAt: now,
    createdByAdminId: 'fixture-test-admin',
    isCancelled: false,
    revision: INITIAL_FIXTURE_REVISION,
    scheduledKickoffAt: new Date('2026-10-25T13:30:00.000Z'),
    team1DisplayName: `Team 1 ${Random.id()}`,
    team2DisplayName: `Team 2 ${Random.id()}`,
    updatedAt: now,
    updatedByAdminId: 'fixture-test-admin',
    visibility: 'published' as const,
    ...overrides,
  };

  return Fixtures.insertAsync(document as FixtureDocument);
};

const cursorFromFixture = (fixture: FixtureDocument): FixtureListCursor => ({
  fixtureId: fixture._id,
  scheduledKickoffAt: fixture.scheduledKickoffAt,
});

const collectPaginatedPublication = async (options: {
  readonly fetchPage: (
    cursor: FixtureListCursor | undefined,
  ) => Promise<FixtureDocument[]>;
  readonly limit: number;
}): Promise<FixtureDocument[]> => {
  const collected: FixtureDocument[] = [];
  let cursor: FixtureListCursor | undefined;

  for (let pageCount = 0; pageCount < 30; pageCount += 1) {
    const page = await options.fetchPage(cursor);
    const visibleRows = page.slice(0, options.limit);

    collected.push(...visibleRows);

    if (page.length <= options.limit || visibleRows.length === 0) {
      return collected;
    }

    cursor = cursorFromFixture(visibleRows[visibleRows.length - 1]);
  }

  throw new Error('Fixture pagination did not terminate');
};

const withFixedDate = async (
  isoInstant: string,
  operation: () => Promise<void>,
) => {
  const RealDate = Date;
  const fixedTime = RealDate.parse(isoInstant);

  class FixedDate extends RealDate {
    constructor(value?: string | number | Date) {
      if (value === undefined) {
        super(fixedTime);
        return;
      }

      super(value);
    }

    static now() {
      return fixedTime;
    }
  }

  globalThis.Date = FixedDate as DateConstructor;

  try {
    await operation();
  } finally {
    globalThis.Date = RealDate;
  }
};

const createDraftFixture = async (invocation: TestInvocation) =>
  callMethod<FixtureMutationResult>(
    FIXTURE_METHODS.createDraft,
    [
      {
        details: fixtureDetails(),
      },
    ],
    invocation,
  );

const fixtureById = async (fixtureId: string): Promise<FixtureDocument> => {
  const fixture = await Fixtures.findOneAsync(fixtureId);

  assert.ok(fixture, `fixture ${fixtureId} exists`);

  return fixture;
};

const rulesetRate = (
  snapshot: RulesetSnapshot,
  questionId: string,
): number | null => {
  const question = snapshot.questions.find(
    (candidate) => candidate.id === questionId,
  );

  if (question?.type === 'built-in-team-numeric') {
    return question.rate;
  }

  return null;
};

describe('CCPP-005 fixture management', function (this: Mocha.Suite) {
  this.timeout(20_000);

  beforeEach(async () => {
    await resetTestAuthData();
    await resetFixtureTestData();
  });

  it('rejects anonymous and non-admin fixture mutations', async () => {
    await assert.rejects(
      () =>
        callMethod(FIXTURE_METHODS.createDraft, [
          {
            details: fixtureDetails(),
          },
        ]),
      /Sign in to continue|not-authenticated/i,
    );

    const playerInvocation = await createVerifiedPlayerInvocation();

    await assert.rejects(
      () =>
        callMethod(
          FIXTURE_METHODS.createDraft,
          [
            {
              details: fixtureDetails(),
            },
          ],
          playerInvocation,
        ),
      /admin area|access|not-authorized/i,
    );
  });

  it('rejects server-owned field injection in ordinary admin payloads', async () => {
    const admin = await createVerifiedAdmin();

    await assert.rejects(
      () =>
        callMethod(
          FIXTURE_METHODS.createDraft,
          [
            {
              details: {
                ...fixtureDetails(),
                cancelledByAdminId: 'attacker',
                isCancelled: true,
                revision: 99,
                rulesetSnapshot: { id: 'fake' },
                visibility: 'published',
              },
            },
          ],
          admin.invocation,
        ),
      /unsupported fields|unknown-fixture-field/i,
    );
  });

  it('lets admins create, edit, publish, and cancel fixtures with server-owned metadata', async () => {
    const admin = await createVerifiedAdmin();
    const created = await createDraftFixture(admin.invocation);
    const draft = await fixtureById(created.fixtureId);

    assert.equal(created.status, 'created');
    assert.equal(draft.visibility, 'draft');
    assert.equal(draft.isCancelled, false);
    assert.equal(draft.createdByAdminId, admin.userId);
    assert.equal(draft.revision, INITIAL_FIXTURE_REVISION);
    assert.equal(draft.updatedByAdminId, admin.userId);
    assert.equal(draft.rulesetSnapshot, undefined);
    assert.equal(draft.rugbyRoosterTest?.ownerRunId?.startsWith('rr-'), true);

    const edited = await callMethod<FixtureMutationResult>(
      FIXTURE_METHODS.editDetails,
      [
        {
          details: fixtureDetails({
            team1DisplayName: 'Sharks',
            venueDisplayName: '',
          }),
          expectedRevision: draft.revision,
          fixtureId: draft._id,
        },
      ],
      admin.invocation,
    );
    const editedFixture = await fixtureById(draft._id);

    assert.equal(edited.status, 'updated');
    assert.equal(editedFixture.team1DisplayName, 'Sharks');
    assert.equal(editedFixture.venueDisplayName, undefined);
    assert.equal(editedFixture.revision, draft.revision + 1);
    assert.equal(editedFixture.visibility, 'draft');

    const published = await callMethod<FixtureMutationResult>(
      FIXTURE_METHODS.publish,
      [
        {
          expectedRevision: editedFixture.revision,
          fixtureId: editedFixture._id,
        },
      ],
      admin.invocation,
    );
    const publishedFixture = await fixtureById(draft._id);

    assert.equal(published.status, 'published');
    assert.equal(publishedFixture.visibility, 'published');
    assert.equal(publishedFixture.publishedByAdminId, admin.userId);
    assert.equal(publishedFixture.revision, editedFixture.revision + 1);
    assert.equal(publishedFixture.rulesetSnapshot?.id, 'rugby-rooster-default');
    assert.equal(rulesetRate(publishedFixture.rulesetSnapshot!, 'tries'), 50);

    const cancelled = await callMethod<FixtureMutationResult>(
      FIXTURE_METHODS.cancel,
      [
        {
          expectedRevision: publishedFixture.revision,
          fixtureId: publishedFixture._id,
        },
      ],
      admin.invocation,
    );
    const cancelledFixture = await fixtureById(draft._id);

    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelledFixture.isCancelled, true);
    assert.equal(cancelledFixture.cancelledByAdminId, admin.userId);
    assert.equal(cancelledFixture.revision, publishedFixture.revision + 1);

    await assert.rejects(
      () =>
        callMethod(
          FIXTURE_METHODS.editDetails,
          [
            {
              details: fixtureDetails({
                team1DisplayName: 'Late Edit',
              }),
              expectedRevision: cancelledFixture.revision,
              fixtureId: cancelledFixture._id,
            },
          ],
          admin.invocation,
        ),
      /read-only|cancelled/i,
    );
  });

  it('reports conflicts instead of overwriting protected state', async () => {
    const admin = await createVerifiedAdmin();
    const created = await createDraftFixture(admin.invocation);
    const original = await fixtureById(created.fixtureId);

    await callMethod(
      FIXTURE_METHODS.editDetails,
      [
        {
          details: fixtureDetails({
            team1DisplayName: 'Lions',
          }),
          expectedRevision: original.revision,
          fixtureId: original._id,
        },
      ],
      admin.invocation,
    );

    await assert.rejects(
      () =>
        callMethod(
          FIXTURE_METHODS.publish,
          [
            {
              expectedRevision: original.revision,
              fixtureId: original._id,
            },
          ],
          admin.invocation,
        ),
      /changed before your update|fixture-conflict/i,
    );
  });

  it('blocks stale edit, publish, and cancel requests without changing newer fixture state', async () => {
    const admin = await createVerifiedAdmin();
    const created = await createDraftFixture(admin.invocation);
    const original = await fixtureById(created.fixtureId);

    await callMethod(
      FIXTURE_METHODS.editDetails,
      [
        {
          details: fixtureDetails({
            team1DisplayName: 'Lions',
          }),
          expectedRevision: original.revision,
          fixtureId: original._id,
        },
      ],
      admin.invocation,
    );

    const updated = await fixtureById(original._id);

    for (const attempt of [
      () =>
        callMethod(
          FIXTURE_METHODS.editDetails,
          [
            {
              details: fixtureDetails({
                team1DisplayName: 'Late Edit',
              }),
              expectedRevision: original.revision,
              fixtureId: original._id,
            },
          ],
          admin.invocation,
        ),
      () =>
        callMethod(
          FIXTURE_METHODS.publish,
          [
            {
              expectedRevision: original.revision,
              fixtureId: original._id,
            },
          ],
          admin.invocation,
        ),
      () =>
        callMethod(
          FIXTURE_METHODS.cancel,
          [
            {
              expectedRevision: original.revision,
              fixtureId: original._id,
            },
          ],
          admin.invocation,
        ),
    ]) {
      await assert.rejects(
        attempt,
        /changed before your update|fixture-conflict/i,
      );
    }

    const afterAttempts = await fixtureById(original._id);

    assert.equal(afterAttempts.team1DisplayName, updated.team1DisplayName);
    assert.equal(afterAttempts.visibility, 'draft');
    assert.equal(afterAttempts.isCancelled, false);
    assert.equal(afterAttempts.revision, updated.revision);
  });

  it('prevents two same-revision operations from both changing a fixture with a fixed clock', async () => {
    const admin = await createVerifiedAdmin();
    const created = await createDraftFixture(admin.invocation);
    const original = await fixtureById(created.fixtureId);

    await withFixedDate('2030-01-01T00:00:00.000Z', async () => {
      await callMethod(
        FIXTURE_METHODS.editDetails,
        [
          {
            details: fixtureDetails({
              team1DisplayName: 'Lions',
            }),
            expectedRevision: original.revision,
            fixtureId: original._id,
          },
        ],
        admin.invocation,
      );

      await assert.rejects(
        () =>
          callMethod(
            FIXTURE_METHODS.cancel,
            [
              {
                expectedRevision: original.revision,
                fixtureId: original._id,
              },
            ],
            admin.invocation,
          ),
        /changed before your update|fixture-conflict/i,
      );
    });

    const afterAttempts = await fixtureById(original._id);

    assert.equal(afterAttempts.team1DisplayName, 'Lions');
    assert.equal(afterAttempts.isCancelled, false);
    assert.equal(afterAttempts.revision, original.revision + 1);
    assert.equal(
      afterAttempts.updatedAt.toISOString(),
      '2030-01-01T00:00:00.000Z',
    );
  });

  it('makes repeated publish and cancel calls predictable', async () => {
    const admin = await createVerifiedAdmin();
    const created = await createDraftFixture(admin.invocation);
    const draft = await fixtureById(created.fixtureId);

    await callMethod(
      FIXTURE_METHODS.publish,
      [
        {
          expectedRevision: draft.revision,
          fixtureId: draft._id,
        },
      ],
      admin.invocation,
    );

    const published = await fixtureById(draft._id);
    const publishedAgain = await callMethod<FixtureMutationResult>(
      FIXTURE_METHODS.publish,
      [
        {
          expectedRevision: draft.revision,
          fixtureId: draft._id,
        },
      ],
      admin.invocation,
    );
    const afterRepeatedPublish = await fixtureById(draft._id);

    assert.equal(publishedAgain.status, 'already-published');
    assert.deepEqual(
      afterRepeatedPublish.rulesetSnapshot,
      published.rulesetSnapshot,
    );
    assert.deepEqual(afterRepeatedPublish.publishedAt, published.publishedAt);
    assert.equal(afterRepeatedPublish.revision, published.revision);

    await callMethod(
      FIXTURE_METHODS.cancel,
      [
        {
          expectedRevision: afterRepeatedPublish.revision,
          fixtureId: draft._id,
        },
      ],
      admin.invocation,
    );
    const cancelled = await fixtureById(draft._id);

    const cancelledAgain = await callMethod<FixtureMutationResult>(
      FIXTURE_METHODS.cancel,
      [
        {
          expectedRevision: afterRepeatedPublish.revision,
          fixtureId: draft._id,
        },
      ],
      admin.invocation,
    );
    const afterRepeatedCancel = await fixtureById(draft._id);

    assert.equal(cancelledAgain.status, 'already-cancelled');
    assert.equal(afterRepeatedCancel.revision, cancelled.revision);
  });

  it('excludes drafts from public lists and direct detail publication', async () => {
    const admin = await createVerifiedAdmin();
    const draftResult = await createDraftFixture(admin.invocation);
    const draft = await fixtureById(draftResult.fixtureId);
    const publishedResult = await createDraftFixture(admin.invocation);
    const publishTarget = await fixtureById(publishedResult.fixtureId);

    await callMethod(
      FIXTURE_METHODS.publish,
      [
        {
          expectedRevision: publishTarget.revision,
          fixtureId: publishTarget._id,
        },
      ],
      admin.invocation,
    );

    const publicList = await fetchPublication<FixtureDocument>(
      FIXTURE_PUBLICATIONS.publicList,
      [
        {
          boundary: '2026-01-01T00:00:00.000Z',
          limit: 10,
          mode: 'upcoming',
        },
      ],
    );
    const publicIds = publicList.map((fixture) => fixture._id);

    assert.deepEqual(publicIds, [publishTarget._id]);
    assert.equal('createdByAdminId' in publicList[0], false);
    assert.equal('updatedByAdminId' in publicList[0], false);
    assert.equal('revision' in publicList[0], false);
    assert.equal('rulesetSnapshot' in publicList[0], false);
    assert.equal('rugbyRoosterTest' in publicList[0], false);

    assert.deepEqual(
      await fetchPublication<FixtureDocument>(
        FIXTURE_PUBLICATIONS.publicDetail,
        [draft._id],
      ),
      [],
    );
  });

  it('paginates public upcoming fixtures beyond the former cap with stable identical-kickoff ordering', async () => {
    const scheduledKickoffAt = new Date('2026-12-01T12:00:00.000Z');
    const fixtureIds: string[] = [];

    for (let index = 0; index < 55; index += 1) {
      fixtureIds.push(
        await insertFixtureDocument({
          scheduledKickoffAt,
          team1DisplayName: `Upcoming Team 1 ${index}`,
          team2DisplayName: `Upcoming Team 2 ${index}`,
        }),
      );
    }

    const expectedIds = [...fixtureIds].sort();
    const maxFirstPage = await fetchPublication<FixtureDocument>(
      FIXTURE_PUBLICATIONS.publicList,
      [
        {
          boundary: '2026-01-01T00:00:00.000Z',
          limit: 50,
          mode: 'upcoming',
        },
      ],
    );
    const maxSecondPage = await fetchPublication<FixtureDocument>(
      FIXTURE_PUBLICATIONS.publicList,
      [
        {
          boundary: '2026-01-01T00:00:00.000Z',
          cursor: cursorFromFixture(maxFirstPage[49]),
          limit: 50,
          mode: 'upcoming',
        },
      ],
    );
    const collected = await collectPaginatedPublication({
      fetchPage: (cursor) =>
        fetchPublication<FixtureDocument>(FIXTURE_PUBLICATIONS.publicList, [
          {
            boundary: '2026-01-01T00:00:00.000Z',
            ...(cursor ? { cursor } : {}),
            limit: 10,
            mode: 'upcoming',
          },
        ]),
      limit: 10,
    });
    const collectedIds = collected.map((fixture) => fixture._id);

    assert.equal(maxFirstPage.length, 51);
    assert.deepEqual(
      maxSecondPage.slice(0, 5).map((fixture) => fixture._id),
      expectedIds.slice(50),
    );
    assert.equal(collected.length, 55);
    assert.equal(new Set(collectedIds).size, 55);
    assert.deepEqual(collectedIds, expectedIds);
  });

  it('paginates public past fixtures in descending kickoff order', async () => {
    const fixtures = [
      {
        kickoff: '2026-01-02T12:00:00.000Z',
        label: 'Oldest',
      },
      {
        kickoff: '2026-01-04T12:00:00.000Z',
        label: 'Newest',
      },
      {
        kickoff: '2026-01-03T12:00:00.000Z',
        label: 'Middle',
      },
    ];

    for (const fixture of fixtures) {
      await insertFixtureDocument({
        scheduledKickoffAt: new Date(fixture.kickoff),
        team1DisplayName: fixture.label,
        team2DisplayName: `${fixture.label} Opponent`,
      });
    }

    const collected = await collectPaginatedPublication({
      fetchPage: (cursor) =>
        fetchPublication<FixtureDocument>(FIXTURE_PUBLICATIONS.publicList, [
          {
            boundary: '2026-02-01T00:00:00.000Z',
            ...(cursor ? { cursor } : {}),
            limit: 2,
            mode: 'past',
          },
        ]),
      limit: 2,
    });

    assert.deepEqual(
      collected.map((fixture) => fixture.team1DisplayName),
      ['Newest', 'Middle', 'Oldest'],
    );
  });

  it('paginates admin fixtures beyond the former cap', async () => {
    const admin = await createVerifiedAdmin();
    const scheduledKickoffAt = new Date('2027-01-01T12:00:00.000Z');
    const fixtureIds: string[] = [];

    for (let index = 0; index < 105; index += 1) {
      fixtureIds.push(
        await insertFixtureDocument({
          scheduledKickoffAt,
          team1DisplayName: `Admin Team 1 ${index}`,
          team2DisplayName: `Admin Team 2 ${index}`,
        }),
      );
    }

    const collected = await collectPaginatedPublication({
      fetchPage: (cursor) =>
        fetchPublication<FixtureDocument>(
          FIXTURE_PUBLICATIONS.adminList,
          [
            {
              ...(cursor ? { cursor } : {}),
              limit: 100,
            },
          ],
          admin.userId,
        ),
      limit: 100,
    });
    const collectedIds = collected.map((fixture) => fixture._id);

    assert.equal(collected.length, 105);
    assert.equal(new Set(collectedIds).size, 105);
    assert.deepEqual(collectedIds, [...fixtureIds].sort());
  });

  it('protects published ruleset snapshots from edits, repeated publication, and later default changes', async () => {
    const admin = await createVerifiedAdmin();
    const created = await createDraftFixture(admin.invocation);
    const draft = await fixtureById(created.fixtureId);

    await callMethod(
      FIXTURE_METHODS.publish,
      [
        {
          expectedRevision: draft.revision,
          fixtureId: draft._id,
        },
      ],
      admin.invocation,
    );

    const published = await fixtureById(draft._id);
    const publishedSnapshotJson = JSON.stringify(published.rulesetSnapshot);

    await callMethod(
      FIXTURE_METHODS.editDetails,
      [
        {
          details: fixtureDetails({
            competitionDisplayName: 'Corrected Competition',
          }),
          expectedRevision: published.revision,
          fixtureId: published._id,
        },
      ],
      admin.invocation,
    );

    const afterEdit = await fixtureById(draft._id);
    assert.equal(
      JSON.stringify(afterEdit.rulesetSnapshot),
      publishedSnapshotJson,
    );

    const triesQuestion = defaultRuleset.questions.find(
      (question) => question.id === 'tries',
    ) as { rate: number } | undefined;

    assert.ok(triesQuestion);
    const originalRate = triesQuestion.rate;

    try {
      triesQuestion.rate = 999;
      const afterDefaultMutation = await fixtureById(draft._id);

      assert.equal(
        rulesetRate(afterDefaultMutation.rulesetSnapshot!, 'tries'),
        50,
      );
    } finally {
      triesQuestion.rate = originalRate;
    }
  });

  it('rejects publishing when the required default ruleset is invalid', async () => {
    const admin = await createVerifiedAdmin();
    const created = await createDraftFixture(admin.invocation);
    const draft = await fixtureById(created.fixtureId);
    const mutableDefault = defaultRuleset as { id: string };
    const originalId = mutableDefault.id;

    try {
      mutableDefault.id = '';

      await assert.rejects(
        () =>
          callMethod(
            FIXTURE_METHODS.publish,
            [
              {
                expectedRevision: draft.revision,
                fixtureId: draft._id,
              },
            ],
            admin.invocation,
          ),
        /default scoring ruleset is invalid|invalid-fixture-ruleset/i,
      );
    } finally {
      mutableDefault.id = originalId;
    }
  });

  it('backfills missing fixture revisions without changing existing data', async () => {
    const now = new Date('2026-06-01T10:00:00.000Z');
    const legacyFixture = {
      ...testFixtureOwner(),
      competitionDisplayName: 'Legacy Competition',
      createdAt: now,
      createdByAdminId: 'legacy-admin',
      isCancelled: false,
      publishedAt: now,
      publishedByAdminId: 'legacy-admin',
      rulesetSnapshot: defaultRuleset,
      scheduledKickoffAt: new Date('2026-07-01T10:00:00.000Z'),
      team1DisplayName: 'Legacy Team 1',
      team2DisplayName: 'Legacy Team 2',
      updatedAt: now,
      updatedByAdminId: 'legacy-admin',
      venueDisplayName: 'Legacy Venue',
      visibility: 'published' as const,
    };
    const fixtureId = await Fixtures.insertAsync(
      legacyFixture as unknown as FixtureDocument,
    );

    assert.equal((await fixtureById(fixtureId)).revision, undefined);
    assert.equal(await backfillFixtureRevisions(), 1);

    const backfilled = await fixtureById(fixtureId);

    assert.equal(backfilled.revision, INITIAL_FIXTURE_REVISION);
    assert.equal(backfilled.updatedAt.toISOString(), now.toISOString());
    assert.equal(backfilled.updatedByAdminId, 'legacy-admin');
    assert.equal(backfilled.rulesetSnapshot?.id, defaultRuleset.id);
    assert.equal(backfilled.venueDisplayName, 'Legacy Venue');
    assert.equal(await backfillFixtureRevisions(), 0);
    assert.equal(
      (await fixtureById(fixtureId)).revision,
      INITIAL_FIXTURE_REVISION,
    );
  });

  it('requires platform-admin authorization for the admin fixture publication', async () => {
    const playerInvocation = await createVerifiedPlayerInvocation();

    await assert.rejects(
      () =>
        fetchPublication(
          FIXTURE_PUBLICATIONS.adminList,
          [
            {
              limit: 10,
            },
          ],
          playerInvocation.userId,
        ),
      /admin area|access|not-authorized/i,
    );
  });
});
