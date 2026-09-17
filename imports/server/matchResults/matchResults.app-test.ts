import assert from 'node:assert/strict';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

import { Fixtures } from '/imports/api/fixtures/collection';
import { MatchResults } from '/imports/api/matchResults/collection';
import { TEST_AUTH_METHODS } from '/imports/shared/auth/methods';
import {
  INITIAL_FIXTURE_REVISION,
  type FixtureDocument,
} from '/imports/shared/fixtures';
import {
  MATCH_RESULT_METHODS,
  MATCH_RESULT_PUBLICATIONS,
  NO_MATCH_RESULT_REVISION,
  type MatchResultDocument,
  type MatchResultMutationResult,
} from '/imports/shared/matchResults';
import {
  defaultRuleset,
  type FixtureObservations,
  type RulesetSnapshot,
} from '/imports/shared/scoring';
import {
  buildConfiguredRulesetSnapshot,
  defaultFixturePredictionQuestionConfig,
} from '/imports/shared/predictionQuestions';
import { getAuthTestRunId } from '/imports/server/auth/settings';
import { resetTestAuthData } from '/imports/server/auth/testSupport';
import { resetFixtureTestData } from '/imports/server/fixtures/testSupport';
import { resetMatchResultTestData } from './testSupport';

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
      id: `match-result-test-${label}`,
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

  if (!result) {
    return [];
  }

  if (Array.isArray(result)) {
    const rows: TDocument[] = [];

    for (const cursor of result) {
      if (
        cursor &&
        typeof cursor === 'object' &&
        'fetchAsync' in cursor &&
        typeof cursor.fetchAsync === 'function'
      ) {
        rows.push(...((await cursor.fetchAsync()) as TDocument[]));
      }
    }

    return rows;
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
  `ccpp008b-${prefix}-${Random.id().toLowerCase()}@example.test`;

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

const testOwner = (): {
  readonly rugbyRoosterTest: { readonly ownerRunId: string };
} => {
  const ownerRunId = getAuthTestRunId();

  assert.ok(ownerRunId, 'match result test run id exists');

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
    ...testOwner(),
    competitionDisplayName: 'United Rugby Championship',
    createdAt: now,
    createdByAdminId: 'match-result-test-admin',
    isCancelled: false,
    publishedAt: now,
    publishedByAdminId: 'match-result-test-admin',
    revision: INITIAL_FIXTURE_REVISION,
    rulesetSnapshot: defaultRuleset,
    scheduledKickoffAt: new Date('2026-10-25T13:30:00.000Z'),
    team1DisplayName: `Team 1 ${Random.id()}`,
    team2DisplayName: `Team 2 ${Random.id()}`,
    updatedAt: now,
    updatedByAdminId: 'match-result-test-admin',
    visibility: 'published' as const,
    ...overrides,
  };

  return Fixtures.insertAsync(document as FixtureDocument);
};

const customRulesetSnapshot = (): RulesetSnapshot =>
  buildConfiguredRulesetSnapshot({
    ...defaultFixturePredictionQuestionConfig(),
    customQuestions: [
      {
        answerType: 'number',
        countingDefinition:
          'Scrum penalties awarded against Team 2 during regulation time.',
        deductionPerUnit: 25,
        id: 'scrum-pressure',
        max: 10,
        min: 0,
        order: 1,
        prompt: 'How many scrum penalties will Team 2 concede?',
      },
      {
        answerType: 'choice',
        countingDefinition:
          'The official player of the match positional group.',
        id: 'player-band',
        incorrectDeduction: 75,
        options: [
          { id: 'backs', label: 'Backs' },
          { id: 'forwards', label: 'Forwards' },
        ],
        order: 2,
        prompt: 'Which group produces the player of the match?',
      },
    ],
  });

const completeObservations = (
  overrides: Partial<FixtureObservations> = {},
): FixtureObservations => ({
  firstTry: { status: 'provisional', value: 'team1' },
  halfTimeLeader: { status: 'provisional', value: 'team1' },
  highestScoringHalf: { status: 'provisional', value: 'second' },
  matchStatus: 'provisional',
  team1: {
    conversions: { status: 'provisional', value: 2 },
    dropGoals: { status: 'provisional', value: 0 },
    penaltyKicks: { status: 'provisional', value: 1 },
    redCards: { status: 'provisional', value: 0 },
    tries: { status: 'provisional', value: 3 },
    yellowCards: { status: 'provisional', value: 1 },
  },
  team2: {
    conversions: { status: 'provisional', value: 1 },
    dropGoals: { status: 'provisional', value: 0 },
    penaltyKicks: { status: 'provisional', value: 2 },
    redCards: { status: 'provisional', value: 0 },
    tries: { status: 'provisional', value: 1 },
    yellowCards: { status: 'provisional', value: 0 },
  },
  ...overrides,
});

const saveProvisional = (
  invocation: TestInvocation,
  input: {
    readonly expectedRevision: number;
    readonly fixtureId: string;
    readonly observations: unknown;
  },
) =>
  callMethod<MatchResultMutationResult>(
    MATCH_RESULT_METHODS.saveProvisional,
    [input],
    invocation,
  );

const confirmFinal = (
  invocation: TestInvocation,
  input: {
    readonly expectedRevision: number;
    readonly fixtureId: string;
    readonly observations: unknown;
  },
) =>
  callMethod<MatchResultMutationResult>(
    MATCH_RESULT_METHODS.confirmFinal,
    [input],
    invocation,
  );

describe('match result administration', function () {
  this.timeout(20_000);

  beforeEach(async () => {
    await resetMatchResultTestData();
    await resetFixtureTestData();
    await resetTestAuthData();
  });

  it('creates a partial provisional result and preserves pending versus zero', async () => {
    const admin = await createVerifiedAdmin();
    const fixtureId = await insertFixtureDocument();
    const result = await saveProvisional(admin.invocation, {
      expectedRevision: NO_MATCH_RESULT_REVISION,
      fixtureId,
      observations: {
        team1: {
          conversions: { status: 'provisional', value: 0 },
          tries: { status: 'provisional', value: 0 },
        },
        team2: {
          tries: { status: 'pending' },
        },
      },
    });

    assert.equal(result.status, 'created');
    assert.equal(result.revision, 1);

    const saved = await MatchResults.findOneAsync({ fixtureId });

    assert.equal(saved?.observations.team1.tries?.value, 0);
    assert.equal(saved?.observations.team1.tries?.status, 'provisional');
    assert.equal(saved?.observations.team2.tries?.status, 'pending');
    assert.equal('value' in (saved?.observations.team2.tries ?? {}), false);
    assert.equal(saved?.observations.team1.conversions?.value, 0);
  });

  it('prevents duplicate first result creation and rejects stale revisions', async () => {
    const admin = await createVerifiedAdmin();
    const fixtureId = await insertFixtureDocument();
    const observations = completeObservations();

    const created = await saveProvisional(admin.invocation, {
      expectedRevision: 0,
      fixtureId,
      observations,
    });

    await assert.rejects(
      () =>
        saveProvisional(admin.invocation, {
          expectedRevision: 0,
          fixtureId,
          observations,
        }),
      /result-conflict/i,
    );

    const updated = await saveProvisional(admin.invocation, {
      expectedRevision: created.revision,
      fixtureId,
      observations: {
        ...observations,
        team1: {
          ...observations.team1,
          tries: { status: 'provisional', value: 4 },
          conversions: { status: 'provisional', value: 2 },
        },
      },
    });

    await assert.rejects(
      () =>
        saveProvisional(admin.invocation, {
          expectedRevision: created.revision,
          fixtureId,
          observations: {
            ...observations,
            team1: {
              ...observations.team1,
              tries: { status: 'provisional', value: 1 },
              conversions: { status: 'provisional', value: 1 },
            },
          },
        }),
      /result-conflict/i,
    );

    const saved = await MatchResults.findOneAsync({ fixtureId });

    assert.equal(updated.revision, 2);
    assert.equal(saved?.observations.team1.tries?.value, 4);
    assert.equal(await MatchResults.find({ fixtureId }).countAsync(), 1);
  });

  it('enforces admin authorization and fixture eligibility', async () => {
    const admin = await createVerifiedAdmin();
    const ordinaryPlayer = await createVerifiedPlayerInvocation();
    const publishedFixtureId = await insertFixtureDocument();
    const draftFixtureId = await insertFixtureDocument({
      publishedAt: undefined,
      publishedByAdminId: undefined,
      rulesetSnapshot: undefined,
      visibility: 'draft',
    });
    const cancelledFixtureId = await insertFixtureDocument({
      cancelledAt: new Date('2026-01-02T00:00:00.000Z'),
      cancelledByAdminId: 'match-result-test-admin',
      isCancelled: true,
    });
    const input = {
      expectedRevision: 0,
      fixtureId: publishedFixtureId,
      observations: completeObservations(),
    };

    await assert.rejects(
      () => saveProvisional(makeInvocation('anonymous'), input),
      /not-authenticated|admin area|access|not-authorized/i,
    );
    await assert.rejects(
      () => saveProvisional(ordinaryPlayer, input),
      /admin area|access|not-authorized/i,
    );
    await assert.rejects(
      () =>
        saveProvisional(admin.invocation, {
          ...input,
          fixtureId: draftFixtureId,
        }),
      /fixture-not-published/i,
    );
    await assert.rejects(
      () =>
        saveProvisional(admin.invocation, {
          ...input,
          fixtureId: cancelledFixtureId,
        }),
      /fixture-cancelled/i,
    );
  });

  it('rejects injected fields, disabled observations, and invalid values', async () => {
    const admin = await createVerifiedAdmin();
    const fixtureId = await insertFixtureDocument({
      rulesetSnapshot: buildConfiguredRulesetSnapshot({
        ...defaultFixturePredictionQuestionConfig(),
        optionalStandardQuestions:
          defaultFixturePredictionQuestionConfig().optionalStandardQuestions.map(
            (question) =>
              question.id === 'first-try'
                ? { ...question, enabled: false }
                : question,
          ),
      }),
    });

    await assert.rejects(
      () =>
        saveProvisional(admin.invocation, {
          expectedRevision: 0,
          fixtureId,
          observations: {
            firstTry: { status: 'provisional', value: 'team1' },
            team1: {
              tries: { status: 'provisional', value: -1 },
            },
          },
        }),
      /not enabled|Numeric answers/i,
    );

    await assert.rejects(
      () =>
        saveProvisional(admin.invocation, {
          expectedRevision: 0,
          fixtureId,
          observations: {
            updatedByAdminId: 'attacker',
            team1: {
              tries: { status: 'provisional', value: 1 },
            },
          },
        } as never),
      /unsupported|not enabled/i,
    );
  });

  it('confirms final results, preserves custom void, and makes the result read-only', async () => {
    const admin = await createVerifiedAdmin();
    const fixtureId = await insertFixtureDocument({
      rulesetSnapshot: customRulesetSnapshot(),
    });
    const provisional = await saveProvisional(admin.invocation, {
      expectedRevision: 0,
      fixtureId,
      observations: completeObservations({
        customAnswers: {
          'player-band': { status: 'void' },
          'scrum-pressure': { status: 'provisional', value: 11 },
        },
      }),
    });

    const final = await confirmFinal(admin.invocation, {
      expectedRevision: provisional.revision,
      fixtureId,
      observations: completeObservations({
        customAnswers: {
          'player-band': { status: 'void' },
          'scrum-pressure': { status: 'provisional', value: 11 },
        },
      }),
    });

    const saved = await MatchResults.findOneAsync({ fixtureId });

    assert.equal(final.status, 'confirmed');
    assert.equal(saved?.observations.matchStatus, 'confirmed');
    assert.equal(
      saved?.observations.customAnswers?.['player-band']?.status,
      'void',
    );
    assert.equal(
      saved?.observations.customAnswers?.['scrum-pressure']?.status,
      'confirmed',
    );
    assert.ok(saved?.confirmedAt);
    assert.equal(saved?.confirmedByAdminId, admin.userId);

    await assert.rejects(
      () =>
        saveProvisional(admin.invocation, {
          expectedRevision: final.revision,
          fixtureId,
          observations: completeObservations(),
        }),
      /result-final/i,
    );
  });

  it('rejects final confirmation with missing or contradictory observations', async () => {
    const admin = await createVerifiedAdmin();
    const fixtureId = await insertFixtureDocument({
      rulesetSnapshot: customRulesetSnapshot(),
    });
    const provisional = await saveProvisional(admin.invocation, {
      expectedRevision: 0,
      fixtureId,
      observations: completeObservations({
        customAnswers: {
          'player-band': { status: 'pending' },
          'scrum-pressure': { status: 'provisional', value: 3 },
        },
      }),
    });

    await assert.rejects(
      () =>
        confirmFinal(admin.invocation, {
          expectedRevision: provisional.revision,
          fixtureId,
          observations: completeObservations({
            customAnswers: {
              'player-band': { status: 'pending' },
              'scrum-pressure': { status: 'provisional', value: 3 },
            },
          }),
        }),
      /settled or void/i,
    );

    await assert.rejects(
      () =>
        confirmFinal(admin.invocation, {
          expectedRevision: provisional.revision,
          fixtureId,
          observations: completeObservations({
            firstTry: { status: 'provisional', value: 'team2' },
            team2: {
              ...completeObservations().team2,
              conversions: { status: 'provisional', value: 0 },
              tries: { status: 'provisional', value: 0 },
            },
            customAnswers: {
              'player-band': { status: 'provisional', value: 'backs' },
              'scrum-pressure': { status: 'provisional', value: 3 },
            },
          }),
        }),
      /first-try/i,
    );
  });

  it('publishes admin-only result context and summaries', async () => {
    const admin = await createVerifiedAdmin();
    const fixtureId = await insertFixtureDocument();

    await saveProvisional(admin.invocation, {
      expectedRevision: 0,
      fixtureId,
      observations: completeObservations(),
    });

    const anonymousContext = await fetchPublication<FixtureDocument>(
      MATCH_RESULT_PUBLICATIONS.adminFixtureContext,
      [fixtureId],
      null,
    );
    const adminContext = await fetchPublication<FixtureDocument>(
      MATCH_RESULT_PUBLICATIONS.adminFixtureContext,
      [fixtureId],
      admin.userId,
    );
    const summaries = await fetchPublication<MatchResultDocument>(
      MATCH_RESULT_PUBLICATIONS.adminSummaries,
      [{ fixtureIds: [fixtureId] }],
      admin.userId,
    );

    assert.equal(anonymousContext.length, 0);
    assert.ok(adminContext.length >= 1);
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].fixtureId, fixtureId);
  });
});
