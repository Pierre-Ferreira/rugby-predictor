import assert from 'node:assert/strict';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

import { Fixtures } from '/imports/api/fixtures/collection';
import {
  FIXTURE_METHODS,
  FIXTURE_PUBLICATIONS,
  type FixtureDocument,
  type FixtureMutationResult,
} from '/imports/shared/fixtures';
import { defaultRuleset, type RulesetSnapshot } from '/imports/shared/scoring';
import { TEST_AUTH_METHODS } from '/imports/shared/auth/methods';
import { resetTestAuthData } from '/imports/server/auth/testSupport';
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
          expectedUpdatedAt: draft.updatedAt.toISOString(),
          fixtureId: draft._id,
        },
      ],
      admin.invocation,
    );
    const editedFixture = await fixtureById(draft._id);

    assert.equal(edited.status, 'updated');
    assert.equal(editedFixture.team1DisplayName, 'Sharks');
    assert.equal(editedFixture.venueDisplayName, undefined);
    assert.equal(editedFixture.visibility, 'draft');

    const published = await callMethod<FixtureMutationResult>(
      FIXTURE_METHODS.publish,
      [
        {
          expectedUpdatedAt: editedFixture.updatedAt.toISOString(),
          fixtureId: editedFixture._id,
        },
      ],
      admin.invocation,
    );
    const publishedFixture = await fixtureById(draft._id);

    assert.equal(published.status, 'published');
    assert.equal(publishedFixture.visibility, 'published');
    assert.equal(publishedFixture.publishedByAdminId, admin.userId);
    assert.equal(publishedFixture.rulesetSnapshot?.id, 'rugby-rooster-default');
    assert.equal(rulesetRate(publishedFixture.rulesetSnapshot!, 'tries'), 50);

    const cancelled = await callMethod<FixtureMutationResult>(
      FIXTURE_METHODS.cancel,
      [
        {
          expectedUpdatedAt: publishedFixture.updatedAt.toISOString(),
          fixtureId: publishedFixture._id,
        },
      ],
      admin.invocation,
    );
    const cancelledFixture = await fixtureById(draft._id);

    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelledFixture.isCancelled, true);
    assert.equal(cancelledFixture.cancelledByAdminId, admin.userId);

    await assert.rejects(
      () =>
        callMethod(
          FIXTURE_METHODS.editDetails,
          [
            {
              details: fixtureDetails({
                team1DisplayName: 'Late Edit',
              }),
              expectedUpdatedAt: cancelledFixture.updatedAt.toISOString(),
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
          expectedUpdatedAt: original.updatedAt.toISOString(),
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
              expectedUpdatedAt: original.updatedAt.toISOString(),
              fixtureId: original._id,
            },
          ],
          admin.invocation,
        ),
      /changed before your update|fixture-conflict/i,
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
          expectedUpdatedAt: draft.updatedAt.toISOString(),
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
          expectedUpdatedAt: draft.updatedAt.toISOString(),
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

    await callMethod(
      FIXTURE_METHODS.cancel,
      [
        {
          expectedUpdatedAt: afterRepeatedPublish.updatedAt.toISOString(),
          fixtureId: draft._id,
        },
      ],
      admin.invocation,
    );

    const cancelledAgain = await callMethod<FixtureMutationResult>(
      FIXTURE_METHODS.cancel,
      [
        {
          expectedUpdatedAt: afterRepeatedPublish.updatedAt.toISOString(),
          fixtureId: draft._id,
        },
      ],
      admin.invocation,
    );

    assert.equal(cancelledAgain.status, 'already-cancelled');
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
          expectedUpdatedAt: publishTarget.updatedAt.toISOString(),
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

  it('protects published ruleset snapshots from edits, repeated publication, and later default changes', async () => {
    const admin = await createVerifiedAdmin();
    const created = await createDraftFixture(admin.invocation);
    const draft = await fixtureById(created.fixtureId);

    await callMethod(
      FIXTURE_METHODS.publish,
      [
        {
          expectedUpdatedAt: draft.updatedAt.toISOString(),
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
          expectedUpdatedAt: published.updatedAt.toISOString(),
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
                expectedUpdatedAt: draft.updatedAt.toISOString(),
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
