import assert from 'node:assert/strict';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

import { Fixtures } from '/imports/api/fixtures/collection';
import { MatchResults } from '/imports/api/matchResults/collection';
import { Predictions } from '/imports/api/predictions/collection';
import { TEST_AUTH_METHODS } from '/imports/shared/auth/methods';
import {
  INITIAL_FIXTURE_REVISION,
  type FixtureDocument,
} from '/imports/shared/fixtures';
import {
  INITIAL_MATCH_RESULT_REVISION,
  MATCH_RESULT_METHODS,
  rulesetIdentity,
  type MatchResultDocument,
  type MatchResultMutationResult,
} from '/imports/shared/matchResults';
import {
  PREDICTION_METHODS,
  type PredictionMutationResult,
} from '/imports/shared/predictions';
import {
  type PlayerFixtureScoreProjection,
  type PlayerFixtureScoreComponent,
} from '/imports/shared/playerFixtureScores';
import {
  defaultRuleset,
  type FixtureObservations,
  type FixturePrediction,
  type ObservedValue,
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
import { resetPredictionTestData } from '/imports/server/predictions/testSupport';

type MethodHandler = (
  this: Meteor.MethodThisType,
  ...args: unknown[]
) => Promise<unknown>;

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
      id: `fixture-score-test-${label}`,
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

const uniqueEmail = (prefix: string): string =>
  `ccpp011a-${prefix}-${Random.id().toLowerCase()}@example.test`;

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

const testOwner = (): {
  readonly rugbyRoosterTest: { readonly ownerRunId: string };
} => {
  const ownerRunId = getAuthTestRunId();

  assert.ok(ownerRunId, 'fixture score test run id exists');

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
    createdByAdminId: 'fixture-score-test-admin',
    isCancelled: false,
    publishedAt: now,
    publishedByAdminId: 'fixture-score-test-admin',
    revision: INITIAL_FIXTURE_REVISION,
    rulesetSnapshot: defaultRuleset,
    scheduledKickoffAt: new Date('2098-10-25T13:30:00.000Z'),
    team1DisplayName: `Team 1 ${Random.id()}`,
    team2DisplayName: `Team 2 ${Random.id()}`,
    updatedAt: now,
    updatedByAdminId: 'fixture-score-test-admin',
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
  highestScoringHalf: 'first',
  matchResult: 'team1',
  team1: {
    conversions: 2,
    dropGoals: 0,
    penaltyKicks: 1,
    redCards: 0,
    tries: 2,
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

const validCustomPrediction = (): FixturePrediction =>
  validPrediction({
    customAnswers: {
      'player-band': 'forwards',
      'scrum-pressure': 4,
    },
  });

const observed = <T>(
  value: T,
  status: 'provisional' | 'confirmed' = 'provisional',
): ObservedValue<T> => ({ status, value });

const completeObservations = (
  status: 'provisional' | 'confirmed' = 'provisional',
  overrides: Partial<FixtureObservations> = {},
): FixtureObservations => ({
  firstTry: observed('team1', status),
  halfTimeLeader: observed('team1', status),
  highestScoringHalf: observed('first', status),
  matchStatus: status,
  team1: {
    conversions: observed(2, status),
    dropGoals: observed(0, status),
    penaltyKicks: observed(1, status),
    redCards: observed(0, status),
    tries: observed(2, status),
    yellowCards: observed(0, status),
  },
  team2: {
    conversions: observed(1, status),
    dropGoals: observed(0, status),
    penaltyKicks: observed(0, status),
    redCards: observed(0, status),
    tries: observed(1, status),
    yellowCards: observed(0, status),
  },
  ...overrides,
});

const insertMatchResultDocument = async ({
  fixtureId,
  observations,
  ruleset = defaultRuleset,
}: {
  readonly fixtureId: string;
  readonly observations: FixtureObservations;
  readonly ruleset?: RulesetSnapshot;
}): Promise<MatchResultDocument> => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const document: MatchResultDocument = {
    _id: Random.id(),
    ...testOwner(),
    createdAt: now,
    createdByAdminId: 'fixture-score-test-admin',
    fixtureId,
    observations,
    revision: INITIAL_MATCH_RESULT_REVISION,
    ruleset: rulesetIdentity(ruleset),
    updatedAt: now,
    updatedByAdminId: 'fixture-score-test-admin',
  };

  await MatchResults.insertAsync(document);

  return document;
};

const submitPrediction = (
  invocation: TestInvocation,
  input: {
    readonly fixtureId: string;
    readonly prediction?: FixturePrediction;
  },
) =>
  callMethod<PredictionMutationResult>(
    PREDICTION_METHODS.submit,
    [
      {
        fixtureId: input.fixtureId,
        prediction: input.prediction ?? validPrediction(),
      },
    ],
    invocation,
  );

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

const createProvisionalResult = async (
  invocation: TestInvocation,
  input: {
    readonly fixtureId: string;
    readonly observations: unknown;
  },
) => {
  const started = await startResultTracking(invocation, {
    fixtureId: input.fixtureId,
  });

  return saveProvisional(invocation, {
    expectedRevision: started.revision,
    fixtureId: input.fixtureId,
    observations: input.observations,
  });
};

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

const getMyFixtureScore = (
  invocation: TestInvocation,
  fixtureId: string,
  extraArgs: readonly unknown[] = [],
) =>
  callMethod<PlayerFixtureScoreProjection | null>(
    PREDICTION_METHODS.getMyFixtureScore,
    [fixtureId, ...extraArgs],
    invocation,
  );

const component = (
  projection: PlayerFixtureScoreProjection,
  questionId: string,
): PlayerFixtureScoreComponent => {
  const match = projection.components.find(
    (candidate) => candidate.questionId === questionId,
  );

  assert.ok(match, `projection contains ${questionId}`);

  return match;
};

describe('player fixture score method', function () {
  this.timeout(20_000);

  beforeEach(async () => {
    await resetMatchResultTestData();
    await resetPredictionTestData();
    await resetFixtureTestData();
    await resetTestAuthData();
  });

  it('requires a verified signed-in player and returns null when no prediction exists', async () => {
    const player = await createVerifiedPlayer();
    const fixtureId = await insertFixtureDocument();

    await assert.rejects(
      () => getMyFixtureScore(makeInvocation('anonymous'), fixtureId),
      /Sign in to continue|not-authenticated/i,
    );
    assert.equal(await getMyFixtureScore(player.invocation, fixtureId), null);
  });

  it('returns the owner score only and ignores supplied identity arguments', async () => {
    const admin = await createVerifiedAdmin();
    const playerA = await createVerifiedPlayer('player-a');
    const playerB = await createVerifiedPlayer('player-b');
    const fixtureId = await insertFixtureDocument();

    await submitPrediction(playerA.invocation, { fixtureId });
    await createProvisionalResult(admin.invocation, {
      fixtureId,
      observations: completeObservations(),
    });

    const ownerProjection = await getMyFixtureScore(
      playerA.invocation,
      fixtureId,
    );

    assert.equal(ownerProjection?.fixtureId, fixtureId);
    assert.equal(ownerProjection?.status, 'provisional');
    assert.equal(await getMyFixtureScore(playerB.invocation, fixtureId), null);
    assert.equal(
      await getMyFixtureScore(playerB.invocation, fixtureId, [playerA.userId]),
      null,
    );
  });

  it('returns awaiting_result for a saved prediction before official result entry starts', async () => {
    const player = await createVerifiedPlayer();
    const fixtureId = await insertFixtureDocument();

    const created = await submitPrediction(player.invocation, { fixtureId });
    const projection = await getMyFixtureScore(player.invocation, fixtureId);

    assert.equal(projection?.status, 'awaiting_result');
    assert.equal(projection?.currentScore, null);
    assert.equal(projection?.finalScore, null);
    assert.equal(projection?.predictionRevision, created.revision);
    assert.equal(projection?.resultRevision, null);
    assert.equal(projection?.resolvedDeduction, 0);
    assert.equal(projection?.components.length, 0);
  });

  it('separates awaiting_result from initialized zero-result provisional scoring', async () => {
    const admin = await createVerifiedAdmin();
    const player = await createVerifiedPlayer();
    const fixtureId = await insertFixtureDocument({
      rulesetSnapshot: customRulesetSnapshot(),
    });

    await submitPrediction(player.invocation, {
      fixtureId,
      prediction: validCustomPrediction(),
    });

    const awaiting = await getMyFixtureScore(player.invocation, fixtureId);
    const started = await startResultTracking(admin.invocation, { fixtureId });
    const initialized = await getMyFixtureScore(player.invocation, fixtureId);

    assert.equal(awaiting?.status, 'awaiting_result');
    assert.equal(awaiting?.currentScore, null);
    assert.equal(initialized?.status, 'provisional');
    assert.equal(initialized?.resultRevision, started.revision);
    assert.equal(initialized?.finalScore, null);
    assert.notEqual(initialized?.currentScore, null);
    assert.equal(component(initialized!, 'tries').status, 'resolved');
    assert.equal(component(initialized!, 'conversions').status, 'resolved');
    assert.equal(component(initialized!, 'penalty-kicks').status, 'resolved');
    assert.equal(component(initialized!, 'drop-goals').status, 'resolved');
    assert.equal(component(initialized!, 'yellow-cards').status, 'resolved');
    assert.equal(component(initialized!, 'red-cards').status, 'resolved');
    assert.equal(component(initialized!, 'first-try').status, 'pending');
    assert.equal(
      component(initialized!, 'highest-scoring-half').status,
      'pending',
    );
    assert.equal(component(initialized!, 'half-time-leader').status, 'pending');
    assert.equal(component(initialized!, 'scrum-pressure').status, 'pending');
    assert.equal(component(initialized!, 'player-band').status, 'pending');
  });

  it('distinguishes blank pending penalty kicks from observed zero through result normalization', async () => {
    const admin = await createVerifiedAdmin();
    const player = await createVerifiedPlayer();
    const fixtureId = await insertFixtureDocument();

    await submitPrediction(player.invocation, { fixtureId });
    const createdResult = await insertMatchResultDocument({
      fixtureId,
      observations: {
        firstTry: { status: 'provisional', value: 'team1' },
        halfTimeLeader: { status: 'provisional', value: 'team1' },
        matchStatus: 'provisional',
        highestScoringHalf: { status: 'provisional', value: 'first' },
        team1: {
          conversions: { status: 'provisional', value: 2 },
          dropGoals: { status: 'provisional', value: 0 },
          penaltyKicks: { status: 'pending' },
          redCards: { status: 'provisional', value: 0 },
          tries: { status: 'provisional', value: 2 },
          yellowCards: { status: 'provisional', value: 0 },
        },
        team2: {
          conversions: { status: 'provisional', value: 1 },
          dropGoals: { status: 'provisional', value: 0 },
          penaltyKicks: { status: 'pending' },
          redCards: { status: 'provisional', value: 0 },
          tries: { status: 'provisional', value: 1 },
          yellowCards: { status: 'provisional', value: 0 },
        },
      },
    });
    const blankProjection = await getMyFixtureScore(
      player.invocation,
      fixtureId,
    );

    assert.equal(blankProjection?.status, 'provisional');
    assert.equal(
      component(blankProjection!, 'penalty-kicks').status,
      'pending',
    );
    assert.equal(component(blankProjection!, 'penalty-kicks').deduction, null);

    const updatedResult = await saveProvisional(admin.invocation, {
      expectedRevision: createdResult.revision,
      fixtureId,
      observations: completeObservations('provisional', {
        team1: {
          ...completeObservations().team1,
          penaltyKicks: { status: 'provisional', value: 0 },
        },
      }),
    });
    const zeroProjection = await getMyFixtureScore(
      player.invocation,
      fixtureId,
    );

    assert.equal(zeroProjection?.resultRevision, updatedResult.revision);
    assert.equal(
      component(zeroProjection!, 'penalty-kicks').status,
      'resolved',
    );
    assert.equal(component(zeroProjection!, 'penalty-kicks').deduction, 100);
    assert.ok(
      zeroProjection!.currentScore! < blankProjection!.currentScore!,
      'observed zero applies resolved deductions that blank pending does not',
    );
  });

  it('recalculates from a corrected result revision without mutating the prediction', async () => {
    const admin = await createVerifiedAdmin();
    const player = await createVerifiedPlayer();
    const fixtureId = await insertFixtureDocument();
    const predictionResult = await submitPrediction(player.invocation, {
      fixtureId,
    });
    const firstResult = await createProvisionalResult(admin.invocation, {
      fixtureId,
      observations: completeObservations('provisional', {
        team1: {
          ...completeObservations().team1,
          tries: { status: 'provisional', value: 3 },
        },
      }),
    });
    const projectionA = await getMyFixtureScore(player.invocation, fixtureId);

    const secondResult = await saveProvisional(admin.invocation, {
      expectedRevision: firstResult.revision,
      fixtureId,
      observations: completeObservations(),
    });
    const projectionB = await getMyFixtureScore(player.invocation, fixtureId);
    const storedPrediction = await Predictions.findOneAsync({
      fixtureId,
      userId: player.userId,
    });

    assert.equal(projectionA?.resultRevision, firstResult.revision);
    assert.equal(projectionB?.resultRevision, secondResult.revision);
    assert.notEqual(projectionA?.currentScore, projectionB?.currentScore);
    assert.equal(projectionA?.predictionRevision, predictionResult.revision);
    assert.equal(projectionB?.predictionRevision, predictionResult.revision);
    assert.equal(storedPrediction?.revision, predictionResult.revision);
    assert.equal(
      'score' in (storedPrediction as unknown as Record<string, unknown>),
      false,
    );
  });

  it('returns final score after valid final confirmation and preserves custom Void', async () => {
    const admin = await createVerifiedAdmin();
    const player = await createVerifiedPlayer();
    const ruleset = customRulesetSnapshot();
    const fixtureId = await insertFixtureDocument({
      rulesetSnapshot: ruleset,
    });

    await submitPrediction(player.invocation, {
      fixtureId,
      prediction: validCustomPrediction(),
    });
    const provisional = await createProvisionalResult(admin.invocation, {
      fixtureId,
      observations: completeObservations('provisional', {
        customAnswers: {
          'player-band': { status: 'void' },
          'scrum-pressure': { status: 'provisional', value: 6 },
        },
      }),
    });
    const final = await confirmFinal(admin.invocation, {
      expectedRevision: provisional.revision,
      fixtureId,
      observations: completeObservations('provisional', {
        customAnswers: {
          'player-band': { status: 'void' },
          'scrum-pressure': { status: 'provisional', value: 6 },
        },
      }),
    });
    const projection = await getMyFixtureScore(player.invocation, fixtureId);

    assert.equal(final.status, 'confirmed');
    assert.equal(projection?.status, 'final');
    assert.equal(projection?.currentScore, projection?.finalScore);
    assert.equal(projection?.pendingCount, 0);
    assert.equal(projection?.resultRevision, final.revision);
    assert.equal(component(projection!, 'scrum-pressure').deduction, 50);
    assert.equal(component(projection!, 'player-band').status, 'void');
    assert.equal(component(projection!, 'player-band').deduction, 0);
  });

  it('returns a cancelled non-score projection instead of scoring a cancelled fixture', async () => {
    const player = await createVerifiedPlayer();
    const fixtureId = await insertFixtureDocument();
    const created = await submitPrediction(player.invocation, { fixtureId });

    assert.equal(
      await Fixtures.updateAsync(fixtureId, {
        $set: {
          cancelledAt: new Date('2026-01-02T00:00:00.000Z'),
          cancelledByAdminId: 'fixture-score-test-admin',
          isCancelled: true,
        },
      }),
      1,
    );

    const projection = await getMyFixtureScore(player.invocation, fixtureId);

    assert.equal(projection?.status, 'cancelled');
    assert.equal(projection?.predictionRevision, created.revision);
    assert.equal(projection?.currentScore, null);
    assert.equal(projection?.finalScore, null);
    assert.equal(projection?.components.length, 0);
  });
});
