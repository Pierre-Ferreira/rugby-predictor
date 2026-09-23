import assert from 'node:assert/strict';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

import { Fixtures } from '/imports/api/fixtures/collection';
import { PredictionAccessAudits } from '/imports/api/predictionAccessAudits/collection';
import { Predictions } from '/imports/api/predictions/collection';
import { TEST_AUTH_METHODS } from '/imports/shared/auth/methods';
import {
  FIXTURE_METHODS,
  INITIAL_FIXTURE_REVISION,
  type FixtureDocument,
  type FixtureMutationResult,
} from '/imports/shared/fixtures';
import {
  MATCH_RESULT_METHODS,
  type MatchResultMutationResult,
} from '/imports/shared/matchResults';
import {
  PREDICTION_METHODS,
  PREDICTION_PUBLICATIONS,
  INITIAL_PREDICTION_REVISION,
  type PredictionEntryDocument,
  type PredictionMutationResult,
} from '/imports/shared/predictions';
import {
  defaultRuleset,
  type FixturePrediction,
  type RulesetSnapshot,
} from '/imports/shared/scoring';
import {
  buildConfiguredRulesetSnapshot,
  defaultFixturePredictionQuestionConfig,
} from '/imports/shared/predictionQuestions';
import { getAuthTestRunId } from '/imports/server/auth/settings';
import { resetTestAuthData } from '/imports/server/auth/testSupport';
import { resetFixtureTestData } from '/imports/server/fixtures/testSupport';
import { resetMatchResultTestData } from '/imports/server/matchResults/testSupport';
import { resetPredictionTestData } from './testSupport';

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
      id: `prediction-test-${label}`,
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
  `ccpp006-${prefix}-${Random.id().toLowerCase()}@example.test`;

const createVerifiedPlayer = async (label = 'player') => {
  const email = uniqueEmail(label);
  const user = await callMethod<{
    readonly email: string;
    readonly userId: string;
  }>(TEST_AUTH_METHODS.createVerifiedUser, [email]);
  const invocation = makeInvocation(label);
  invocation.userId = user.userId;

  return {
    email,
    invocation,
    userId: user.userId,
  };
};

const createVerifiedAdmin = async () => {
  const admin = await createVerifiedPlayer('admin');

  assert.equal(
    await callMethod(TEST_AUTH_METHODS.setAdminForEmail, [admin.email, true]),
    true,
  );

  return admin;
};

const createUnverifiedPlayer = async () => {
  const ownerRunId = getAuthTestRunId();

  assert.ok(ownerRunId, 'prediction test run id exists');

  const userId = await Meteor.users.insertAsync({
    createdAt: new Date(),
    emails: [
      {
        address: uniqueEmail('unverified'),
        verified: false,
      },
    ],
    rugbyRoosterTest: {
      ownerRunId,
    },
    services: {},
  } as unknown as Meteor.User);
  const invocation = makeInvocation('unverified');
  invocation.userId = userId;

  return invocation;
};

const testFixtureOwner = (): {
  readonly rugbyRoosterTest: { readonly ownerRunId: string };
} => {
  const ownerRunId = getAuthTestRunId();

  assert.ok(ownerRunId, 'prediction test run id exists');

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
    createdByAdminId: 'prediction-test-admin',
    isCancelled: false,
    publishedAt: now,
    publishedByAdminId: 'prediction-test-admin',
    revision: INITIAL_FIXTURE_REVISION,
    rulesetSnapshot: defaultRuleset,
    scheduledKickoffAt: new Date('2098-10-25T13:30:00.000Z'),
    team1DisplayName: `Team 1 ${Random.id()}`,
    team2DisplayName: `Team 2 ${Random.id()}`,
    updatedAt: now,
    updatedByAdminId: 'prediction-test-admin',
    visibility: 'published' as const,
    ...overrides,
  };

  return Fixtures.insertAsync(document as FixtureDocument);
};

const validPrediction = (
  overrides: Partial<FixturePrediction> = {},
): FixturePrediction => ({
  firstTry: 'team1',
  halfTimeLeader: 'team1',
  highestScoringHalf: 'second',
  matchResult: 'team1',
  team1: {
    conversions: 2,
    dropGoals: 0,
    penaltyKicks: 1,
    redCards: 0,
    tries: 2,
    yellowCards: 1,
  },
  team2: {
    conversions: 1,
    dropGoals: 0,
    penaltyKicks: 1,
    redCards: 0,
    tries: 1,
    yellowCards: 0,
  },
  ...overrides,
});

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
        max: 12,
        min: 0,
        order: 1,
        prompt: 'How many scrum penalties?',
      },
      {
        answerType: 'choice',
        countingDefinition: 'Official player of the match group.',
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

const validCustomPrediction = (
  customAnswers: FixturePrediction['customAnswers'] = {
    'player-band': 'forwards',
    'scrum-pressure': 4,
  },
): FixturePrediction =>
  validPrediction({
    customAnswers,
  });

const submitPrediction = (
  invocation: TestInvocation,
  input: {
    readonly expectedRevision?: number;
    readonly fixtureId: string;
    readonly prediction?: FixturePrediction | Record<string, unknown>;
  },
) =>
  callMethod<PredictionMutationResult>(
    PREDICTION_METHODS.submit,
    [
      {
        ...(input.expectedRevision === undefined
          ? {}
          : { expectedRevision: input.expectedRevision }),
        fixtureId: input.fixtureId,
        prediction: input.prediction ?? validPrediction(),
      },
    ],
    invocation,
  );

const fixtureControl = (
  invocation: TestInvocation,
  methodName: string,
  input: {
    readonly expectedRevision: number;
    readonly fixtureId: string;
  },
) => callMethod<FixtureMutationResult>(methodName, [input], invocation);

const startResultTracking = (
  invocation: TestInvocation,
  input: {
    readonly fixtureId: string;
  },
) =>
  callMethod<MatchResultMutationResult>(
    MATCH_RESULT_METHODS.startResultTracking,
    [input],
    invocation,
  );

const confirmFinalResult = (
  invocation: TestInvocation,
  input: {
    readonly expectedRevision: number;
    readonly fixtureId: string;
  },
) =>
  callMethod<MatchResultMutationResult>(
    MATCH_RESULT_METHODS.confirmFinal,
    [
      {
        expectedRevision: input.expectedRevision,
        fixtureId: input.fixtureId,
        observations: {
          firstTry: { status: 'provisional', value: 'team1' },
          halfTimeLeader: { status: 'provisional', value: 'team1' },
          highestScoringHalf: { status: 'provisional', value: 'first' },
          team1: {
            conversions: { status: 'provisional', value: 2 },
            dropGoals: { status: 'provisional', value: 0 },
            penaltyKicks: { status: 'provisional', value: 1 },
            redCards: { status: 'provisional', value: 0 },
            tries: { status: 'provisional', value: 2 },
            yellowCards: { status: 'provisional', value: 0 },
          },
          team2: {
            conversions: { status: 'provisional', value: 1 },
            dropGoals: { status: 'provisional', value: 0 },
            penaltyKicks: { status: 'provisional', value: 1 },
            redCards: { status: 'provisional', value: 0 },
            tries: { status: 'provisional', value: 1 },
            yellowCards: { status: 'provisional', value: 0 },
          },
        },
      },
    ],
    invocation,
  );

const predictionByOwner = async (
  fixtureId: string,
  userId: string,
): Promise<PredictionEntryDocument | null> =>
  (await Predictions.findOneAsync({
    fixtureId,
    userId,
  })) ?? null;

const withFixedDate = async <TResult>(
  isoInstant: string,
  operation: () => Promise<TResult>,
): Promise<TResult> => {
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
    return await operation();
  } finally {
    globalThis.Date = RealDate;
  }
};

describe('CCPP-006 prediction submission', function (this: Mocha.Suite) {
  this.timeout(20_000);

  beforeEach(async () => {
    await resetTestAuthData();
    await resetMatchResultTestData();
    await resetFixtureTestData();
    await resetPredictionTestData();
  });

  it('creates and revises one owned prediction before kickoff', async () => {
    const player = await createVerifiedPlayer();
    const fixtureId = await insertFixtureDocument();

    const created = await submitPrediction(player.invocation, { fixtureId });
    const firstEntry = await predictionByOwner(fixtureId, player.userId);

    assert.equal(created.status, 'created');
    assert.equal(created.revision, INITIAL_PREDICTION_REVISION);
    assert.equal(firstEntry?.userId, player.userId);
    assert.equal(firstEntry?.fixtureId, fixtureId);
    assert.equal(firstEntry?.ruleset.id, defaultRuleset.id);
    assert.equal(
      'score' in (firstEntry as unknown as Record<string, unknown>),
      false,
    );

    const revisedPrediction = validPrediction({
      firstTry: 'team2',
      matchResult: 'team2',
      team1: {
        conversions: 0,
        dropGoals: 0,
        penaltyKicks: 0,
        redCards: 0,
        tries: 0,
        yellowCards: 0,
      },
      team2: {
        conversions: 1,
        dropGoals: 0,
        penaltyKicks: 0,
        redCards: 0,
        tries: 1,
        yellowCards: 0,
      },
    });
    const updated = await submitPrediction(player.invocation, {
      expectedRevision: created.revision,
      fixtureId,
      prediction: revisedPrediction,
    });
    const secondEntry = await predictionByOwner(fixtureId, player.userId);

    assert.equal(updated.status, 'updated');
    assert.equal(updated.revision, created.revision + 1);
    assert.equal(secondEntry?.prediction.firstTry, 'team2');
    assert.equal(secondEntry?.revision, created.revision + 1);
    assert.ok(
      secondEntry?.updatedAt.getTime() >= firstEntry!.updatedAt.getTime(),
    );
  });

  it('validates against the fixture snapshot instead of the default ruleset', async () => {
    const player = await createVerifiedPlayer();
    const snapshotWithoutFirstTry = {
      ...defaultRuleset,
      id: 'snapshot-without-first-try',
      questions: defaultRuleset.questions.map((question) =>
        question.id === 'first-try'
          ? {
              ...question,
              enabled: false,
            }
          : question,
      ),
    } satisfies RulesetSnapshot;
    const fixtureId = await insertFixtureDocument({
      rulesetSnapshot: snapshotWithoutFirstTry,
    });
    const { firstTry: _firstTry, ...prediction } = validPrediction();

    const result = await submitPrediction(player.invocation, {
      fixtureId,
      prediction,
    });
    const entry = await predictionByOwner(fixtureId, player.userId);

    assert.equal(result.status, 'created');
    assert.equal(entry?.ruleset.id, 'snapshot-without-first-try');
    assert.equal(entry?.prediction.firstTry, undefined);
  });

  it('publishes custom question definitions to the prediction context and persists custom answers', async () => {
    const player = await createVerifiedPlayer();
    const otherPlayer = await createVerifiedPlayer('other-player');
    const fixtureId = await insertFixtureDocument({
      rulesetSnapshot: customRulesetSnapshot(),
    });

    const fixtureRows = await fetchPublication<FixtureDocument>(
      PREDICTION_PUBLICATIONS.fixtureContext,
      [fixtureId],
      player.userId,
    );

    assert.equal(fixtureRows.length, 1);
    assert.equal(
      fixtureRows[0].rulesetSnapshot?.questions.some(
        (question) => question.id === 'scrum-pressure',
      ),
      true,
    );

    const created = await submitPrediction(player.invocation, {
      fixtureId,
      prediction: validCustomPrediction(),
    });
    const entry = await predictionByOwner(fixtureId, player.userId);

    assert.equal(created.status, 'created');
    assert.deepEqual(entry?.prediction.customAnswers, {
      'player-band': 'forwards',
      'scrum-pressure': 4,
    });

    assert.equal(
      (
        await fetchPublication<PredictionEntryDocument>(
          PREDICTION_PUBLICATIONS.currentUserEntry,
          [fixtureId],
          otherPlayer.userId,
        )
      ).length,
      0,
    );

    const updated = await submitPrediction(player.invocation, {
      expectedRevision: created.revision,
      fixtureId,
      prediction: validCustomPrediction({
        'player-band': 'backs',
        'scrum-pressure': 7,
      }),
    });
    const revised = await predictionByOwner(fixtureId, player.userId);

    assert.equal(updated.status, 'updated');
    assert.deepEqual(revised?.prediction.customAnswers, {
      'player-band': 'backs',
      'scrum-pressure': 7,
    });
  });

  it('rejects malformed custom answers and injected custom configuration', async () => {
    const player = await createVerifiedPlayer();
    const customFixtureId = await insertFixtureDocument({
      rulesetSnapshot: customRulesetSnapshot(),
    });
    const plainFixtureId = await insertFixtureDocument();

    await assert.rejects(
      () =>
        submitPrediction(player.invocation, {
          fixtureId: customFixtureId,
          prediction: validPrediction(),
        }),
      /Custom answer 'scrum-pressure' is required|invalid-prediction/i,
    );

    for (const customAnswers of [
      {
        'player-band': 'forwards',
        'scrum-pressure': 13,
      },
      {
        'player-band': 'forwards',
        'scrum-pressure': 1.5,
      },
      {
        'player-band': 'Forward pack',
        'scrum-pressure': 4,
      },
      {
        'player-band': 'forwards',
        'scrum-pressure': 4,
        unknown: 1,
      },
      {
        'player-band': {
          incorrectDeduction: 0,
          label: 'Injected',
          value: 'forwards',
        },
        'scrum-pressure': 4,
      },
    ]) {
      await assert.rejects(
        () =>
          submitPrediction(player.invocation, {
            fixtureId: customFixtureId,
            prediction: {
              ...validPrediction(),
              customAnswers,
            },
          }),
        /invalid-prediction/i,
      );
    }

    await assert.rejects(
      () =>
        submitPrediction(player.invocation, {
          fixtureId: plainFixtureId,
          prediction: validCustomPrediction(),
        }),
      /Custom answer 'scrum-pressure' is not enabled|invalid-prediction/i,
    );
  });

  it('rejects anonymous, unverified, and ownership-spoofing attempts', async () => {
    const player = await createVerifiedPlayer();
    const unverifiedInvocation = await createUnverifiedPlayer();
    const fixtureId = await insertFixtureDocument();

    await assert.rejects(
      () => submitPrediction(makeInvocation('anonymous'), { fixtureId }),
      /Sign in to continue|not-authenticated/i,
    );

    await assert.rejects(
      () => submitPrediction(unverifiedInvocation, { fixtureId }),
      /Verify your email|email-not-verified/i,
    );

    await assert.rejects(
      () =>
        callMethod(
          PREDICTION_METHODS.submit,
          [
            {
              fixtureId,
              prediction: validPrediction(),
              userId: player.userId,
            },
          ],
          player.invocation,
        ),
      /unsupported fields|unknown-prediction-field/i,
    );
  });

  it('keeps another player from reading or modifying an entry', async () => {
    const playerA = await createVerifiedPlayer('player-a');
    const playerB = await createVerifiedPlayer('player-b');
    const fixtureId = await insertFixtureDocument();

    await submitPrediction(playerA.invocation, { fixtureId });

    assert.equal(
      (
        await fetchPublication<PredictionEntryDocument>(
          PREDICTION_PUBLICATIONS.currentUserEntry,
          [fixtureId],
          null,
        )
      ).length,
      0,
    );

    assert.equal(
      (
        await fetchPublication<PredictionEntryDocument>(
          PREDICTION_PUBLICATIONS.currentUserEntry,
          [fixtureId],
          playerB.userId,
        )
      ).length,
      0,
    );

    await assert.rejects(
      () =>
        submitPrediction(playerB.invocation, {
          expectedRevision: INITIAL_PREDICTION_REVISION,
          fixtureId,
          prediction: validPrediction(),
        }),
      /No saved prediction|prediction-not-found/i,
    );

    const ownerEntry = await predictionByOwner(fixtureId, playerA.userId);

    assert.equal(ownerEntry?.revision, INITIAL_PREDICTION_REVISION);
    assert.equal(ownerEntry?.prediction.matchResult, 'team1');
  });

  it('rejects draft, cancelled, missing, and snapshotless fixtures', async () => {
    const player = await createVerifiedPlayer();
    const draftFixtureId = await insertFixtureDocument({
      publishedAt: undefined,
      publishedByAdminId: undefined,
      rulesetSnapshot: undefined,
      visibility: 'draft',
    });
    const cancelledFixtureId = await insertFixtureDocument({
      isCancelled: true,
    });
    const snapshotlessFixtureId = await insertFixtureDocument({
      rulesetSnapshot: undefined,
    });

    await assert.rejects(
      () => submitPrediction(player.invocation, { fixtureId: draftFixtureId }),
      /Draft fixtures|fixture-not-open/i,
    );
    await assert.rejects(
      () =>
        submitPrediction(player.invocation, { fixtureId: cancelledFixtureId }),
      /prediction-access-locked|Predictions are locked/i,
    );
    await assert.rejects(
      () =>
        submitPrediction(player.invocation, {
          fixtureId: `missing-${Random.id()}`,
        }),
      /Fixture was not found|fixture-not-found/i,
    );
    await assert.rejects(
      () =>
        submitPrediction(player.invocation, {
          fixtureId: snapshotlessFixtureId,
        }),
      /prediction rules are unavailable|fixture-ruleset-unavailable/i,
    );
  });

  it('uses strict before, equal, and after kickoff boundaries', async () => {
    const player = await createVerifiedPlayer();
    const kickoff = '2030-01-01T12:00:00.000Z';
    const beforeFixtureId = await insertFixtureDocument({
      scheduledKickoffAt: new Date(kickoff),
    });
    const equalFixtureId = await insertFixtureDocument({
      scheduledKickoffAt: new Date(kickoff),
    });
    const afterFixtureId = await insertFixtureDocument({
      scheduledKickoffAt: new Date(kickoff),
    });

    await withFixedDate('2030-01-01T11:59:59.999Z', async () => {
      const result = await submitPrediction(player.invocation, {
        fixtureId: beforeFixtureId,
      });

      assert.equal(result.status, 'created');
    });

    await withFixedDate(kickoff, async () => {
      await assert.rejects(
        () =>
          submitPrediction(player.invocation, {
            fixtureId: equalFixtureId,
          }),
        /prediction-access-locked|Predictions are locked/i,
      );
    });

    await withFixedDate('2030-01-01T12:00:00.001Z', async () => {
      await assert.rejects(
        () =>
          submitPrediction(player.invocation, {
            fixtureId: afterFixtureId,
          }),
        /prediction-access-locked|Predictions are locked/i,
      );
    });
  });

  it('enforces admin lock, explicit reopen, result-start reopen, relock, audit, and stale player saves', async () => {
    const admin = await createVerifiedAdmin();
    const player = await createVerifiedPlayer();
    const fixtureId = await insertFixtureDocument({
      scheduledKickoffAt: new Date('2098-01-01T12:00:00.000Z'),
    });
    const created = await submitPrediction(player.invocation, { fixtureId });
    const storedBeforeLock = await predictionByOwner(fixtureId, player.userId);
    const fixtureBeforeLock = await Fixtures.findOneAsync(fixtureId);

    assert.ok(fixtureBeforeLock);

    const locked = await fixtureControl(
      admin.invocation,
      FIXTURE_METHODS.lockPredictions,
      {
        expectedRevision: fixtureBeforeLock.revision,
        fixtureId,
      },
    );

    await assert.rejects(
      () =>
        submitPrediction(player.invocation, {
          expectedRevision: created.revision,
          fixtureId,
          prediction: validPrediction({
            highestScoringHalf: 'equal',
          }),
        }),
      /prediction-access-locked|Predictions are locked/i,
    );

    const unchangedAfterLock = await predictionByOwner(
      fixtureId,
      player.userId,
    );

    assert.equal(locked.status, 'prediction-access-locked');
    assert.equal(unchangedAfterLock?.revision, storedBeforeLock?.revision);
    assert.equal(unchangedAfterLock?.prediction.highestScoringHalf, 'second');

    const reopened = await fixtureControl(
      admin.invocation,
      FIXTURE_METHODS.reopenPredictions,
      {
        expectedRevision: locked.revision!,
        fixtureId,
      },
    );
    const editedAfterReopen = await submitPrediction(player.invocation, {
      expectedRevision: created.revision,
      fixtureId,
      prediction: validPrediction({
        highestScoringHalf: 'equal',
      }),
    });

    assert.equal(reopened.status, 'prediction-access-reopened');
    assert.equal(editedAfterReopen.status, 'updated');

    await startResultTracking(admin.invocation, { fixtureId });

    const editedAfterResultStart = await submitPrediction(player.invocation, {
      expectedRevision: editedAfterReopen.revision,
      fixtureId,
      prediction: validPrediction({
        highestScoringHalf: 'first',
      }),
    });

    assert.equal(editedAfterResultStart.status, 'updated');

    const relocked = await fixtureControl(
      admin.invocation,
      FIXTURE_METHODS.lockPredictions,
      {
        expectedRevision: reopened.revision!,
        fixtureId,
      },
    );

    await assert.rejects(
      () =>
        submitPrediction(player.invocation, {
          expectedRevision: editedAfterResultStart.revision,
          fixtureId,
          prediction: validPrediction({
            highestScoringHalf: 'second',
          }),
        }),
      /prediction-access-locked|Predictions are locked/i,
    );

    const audits = await PredictionAccessAudits.find(
      { fixtureId },
      { sort: { createdAt: 1 } },
    ).fetchAsync();

    assert.equal(relocked.status, 'prediction-access-locked');
    assert.deepEqual(
      audits.map((audit) => audit.action),
      ['locked', 'reopened', 'locked'],
    );
    assert.deepEqual(
      audits.map((audit) => audit.actorAdminUserId),
      [admin.userId, admin.userId, admin.userId],
    );
    assert.deepEqual(
      audits.map((audit) => audit.fixtureRevisionBefore),
      [fixtureBeforeLock.revision, locked.revision, reopened.revision],
    );
    assert.deepEqual(
      audits.map((audit) => audit.fixtureRevisionAfter),
      [locked.revision, reopened.revision, relocked.revision],
    );
  });

  it('allows explicit reopen after scheduled kickoff and rejects stale admin control revisions', async () => {
    const admin = await createVerifiedAdmin();
    const player = await createVerifiedPlayer();
    const fixtureId = await insertFixtureDocument({
      scheduledKickoffAt: new Date('2030-01-01T12:00:00.000Z'),
    });
    const fixture = await Fixtures.findOneAsync(fixtureId);

    assert.ok(fixture);

    await withFixedDate('2030-01-01T12:00:00.001Z', async () => {
      await assert.rejects(
        () => submitPrediction(player.invocation, { fixtureId }),
        /prediction-access-locked|Predictions are locked/i,
      );
    });

    const reopened = await fixtureControl(
      admin.invocation,
      FIXTURE_METHODS.reopenPredictions,
      {
        expectedRevision: fixture.revision,
        fixtureId,
      },
    );

    await assert.rejects(
      () =>
        fixtureControl(admin.invocation, FIXTURE_METHODS.lockPredictions, {
          expectedRevision: fixture.revision,
          fixtureId,
        }),
      /fixture-conflict|changed before your update/i,
    );

    await withFixedDate('2030-01-01T12:00:00.001Z', async () => {
      const created = await submitPrediction(player.invocation, { fixtureId });

      assert.equal(created.status, 'created');
    });

    assert.equal(reopened.status, 'prediction-access-reopened');
  });

  it('locks automatically after result tracking starts unless admin explicitly reopens', async () => {
    const admin = await createVerifiedAdmin();
    const player = await createVerifiedPlayer();
    const fixtureId = await insertFixtureDocument({
      scheduledKickoffAt: new Date('2098-01-01T12:00:00.000Z'),
    });

    await startResultTracking(admin.invocation, { fixtureId });

    await assert.rejects(
      () => submitPrediction(player.invocation, { fixtureId }),
      /prediction-access-locked|Predictions are locked/i,
    );

    const fixture = await Fixtures.findOneAsync(fixtureId);

    assert.ok(fixture);

    await fixtureControl(admin.invocation, FIXTURE_METHODS.reopenPredictions, {
      expectedRevision: fixture.revision,
      fixtureId,
    });

    const created = await submitPrediction(player.invocation, { fixtureId });

    assert.equal(created.status, 'created');
  });

  it('keeps final and cancelled fixtures closed and prevents reopen', async () => {
    const admin = await createVerifiedAdmin();
    const player = await createVerifiedPlayer();
    const finalFixtureId = await insertFixtureDocument();
    const cancelledFixtureId = await insertFixtureDocument({
      cancelledAt: new Date('2026-01-02T00:00:00.000Z'),
      cancelledByAdminId: 'prediction-test-admin',
      isCancelled: true,
    });
    const started = await startResultTracking(admin.invocation, {
      fixtureId: finalFixtureId,
    });

    await confirmFinalResult(admin.invocation, {
      expectedRevision: started.revision,
      fixtureId: finalFixtureId,
    });

    const finalFixture = await Fixtures.findOneAsync(finalFixtureId);
    const cancelledFixture = await Fixtures.findOneAsync(cancelledFixtureId);

    assert.ok(finalFixture);
    assert.ok(cancelledFixture);

    await assert.rejects(
      () =>
        fixtureControl(admin.invocation, FIXTURE_METHODS.reopenPredictions, {
          expectedRevision: finalFixture.revision,
          fixtureId: finalFixtureId,
        }),
      /prediction-access-final|Final results cannot be reopened/i,
    );
    await assert.rejects(
      () =>
        fixtureControl(admin.invocation, FIXTURE_METHODS.reopenPredictions, {
          expectedRevision: cancelledFixture.revision,
          fixtureId: cancelledFixtureId,
        }),
      /fixture-cancelled|Cancelled fixtures/i,
    );
    await assert.rejects(
      () => submitPrediction(player.invocation, { fixtureId: finalFixtureId }),
      /prediction-access-locked|Predictions are locked/i,
    );
    await assert.rejects(
      () =>
        submitPrediction(player.invocation, {
          fixtureId: cancelledFixtureId,
        }),
      /prediction-access-locked|Predictions are locked/i,
    );
  });

  it('rejects invalid and contradictory prediction answers', async () => {
    const player = await createVerifiedPlayer();
    const fixtureId = await insertFixtureDocument();

    await assert.rejects(
      () =>
        submitPrediction(player.invocation, {
          fixtureId,
          prediction: validPrediction({
            team1: {
              conversions: 2,
              dropGoals: 0,
              penaltyKicks: 0,
              redCards: 0,
              tries: 1,
              yellowCards: 0,
            },
          }),
        }),
      /Conversions cannot exceed tries|invalid-prediction/i,
    );

    await assert.rejects(
      () =>
        submitPrediction(player.invocation, {
          fixtureId,
          prediction: validPrediction({
            matchResult: 'team2',
          }),
        }),
      /Selected match result must agree|invalid-prediction/i,
    );
  });

  it('prevents concurrent first submissions from creating duplicates', async () => {
    const player = await createVerifiedPlayer();
    const fixtureId = await insertFixtureDocument();
    const attempts = await Promise.allSettled([
      submitPrediction(player.invocation, { fixtureId }),
      submitPrediction(player.invocation, { fixtureId }),
    ]);
    const entries = await Predictions.find({
      fixtureId,
      userId: player.userId,
    }).fetchAsync();

    assert.equal(
      attempts.filter((attempt) => attempt.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      attempts.filter((attempt) => attempt.status === 'rejected').length,
      1,
    );
    assert.equal(entries.length, 1);
  });

  it('rejects stale revisions without overwriting newer answers', async () => {
    const player = await createVerifiedPlayer();
    const fixtureId = await insertFixtureDocument();
    const created = await submitPrediction(player.invocation, { fixtureId });

    await submitPrediction(player.invocation, {
      expectedRevision: created.revision,
      fixtureId,
      prediction: validPrediction({
        highestScoringHalf: 'first',
      }),
    });

    await assert.rejects(
      () =>
        submitPrediction(player.invocation, {
          expectedRevision: created.revision,
          fixtureId,
          prediction: validPrediction({
            highestScoringHalf: 'equal',
          }),
        }),
      /changed before your update|prediction-conflict/i,
    );

    const entry = await predictionByOwner(fixtureId, player.userId);

    assert.equal(entry?.prediction.highestScoringHalf, 'first');
    assert.equal(entry?.revision, created.revision + 1);
  });

  it('rejects stale custom-answer revisions without overwriting newer custom answers', async () => {
    const player = await createVerifiedPlayer();
    const fixtureId = await insertFixtureDocument({
      rulesetSnapshot: customRulesetSnapshot(),
    });
    const created = await submitPrediction(player.invocation, {
      fixtureId,
      prediction: validCustomPrediction({
        'player-band': 'forwards',
        'scrum-pressure': 4,
      }),
    });

    await submitPrediction(player.invocation, {
      expectedRevision: created.revision,
      fixtureId,
      prediction: validCustomPrediction({
        'player-band': 'backs',
        'scrum-pressure': 5,
      }),
    });

    await assert.rejects(
      () =>
        submitPrediction(player.invocation, {
          expectedRevision: created.revision,
          fixtureId,
          prediction: validCustomPrediction({
            'player-band': 'forwards',
            'scrum-pressure': 9,
          }),
        }),
      /changed before your update|prediction-conflict/i,
    );

    const entry = await predictionByOwner(fixtureId, player.userId);

    assert.deepEqual(entry?.prediction.customAnswers, {
      'player-band': 'backs',
      'scrum-pressure': 5,
    });
    assert.equal(entry?.revision, created.revision + 1);
  });

  it('rejects server-owned field injection and keeps saved entries readable after locking', async () => {
    const player = await createVerifiedPlayer();
    const fixtureId = await insertFixtureDocument({
      scheduledKickoffAt: new Date('2030-01-01T12:00:00.000Z'),
    });

    await assert.rejects(
      () =>
        callMethod(
          PREDICTION_METHODS.submit,
          [
            {
              createdAt: new Date().toISOString(),
              fixtureId,
              prediction: validPrediction(),
              revision: 10,
              score: 5000,
              updatedAt: new Date().toISOString(),
            },
          ],
          player.invocation,
        ),
      /unsupported fields|unknown-prediction-field/i,
    );

    await withFixedDate('2030-01-01T11:59:59.999Z', async () => {
      await submitPrediction(player.invocation, { fixtureId });
    });

    await withFixedDate('2030-01-01T12:00:00.001Z', async () => {
      const rows = await fetchPublication<PredictionEntryDocument>(
        PREDICTION_PUBLICATIONS.currentUserEntry,
        [fixtureId],
        player.userId,
      );

      assert.equal(rows.length, 1);
      assert.equal(rows[0].prediction.matchResult, 'team1');
      assert.equal(rows[0].userId, player.userId);
    });
  });
});
