import assert from 'node:assert/strict';
import { Meteor } from 'meteor/meteor';
import { MongoInternals } from 'meteor/mongo';
import { Random } from 'meteor/random';

import { Fixtures } from '/imports/api/fixtures/collection';
import { Predictions } from '/imports/api/predictions/collection';
import { TEST_AUTH_METHODS } from '/imports/shared/auth/methods';
import {
  FIXTURE_LEADERBOARD_METHODS,
  MAX_FIXTURE_LEADERBOARD_LIMIT,
  type FixtureLeaderboardProjection,
} from '/imports/shared/fixtureLeaderboards';
import {
  INITIAL_FIXTURE_REVISION,
  type FixtureDocument,
} from '/imports/shared/fixtures';
import {
  MATCH_RESULT_METHODS,
  NO_MATCH_RESULT_REVISION,
  type MatchResultMutationResult,
} from '/imports/shared/matchResults';
import {
  PLAYER_PROFILE_METHODS,
  type PublicPlayerIdentity,
} from '/imports/shared/playerProfiles';
import {
  PREDICTION_METHODS,
  type PredictionMutationResult,
} from '/imports/shared/predictions';
import type { PlayerFixtureScoreProjection } from '/imports/shared/playerFixtureScores';
import {
  defaultRuleset,
  type FixtureObservations,
  type FixturePrediction,
  type ObservedValue,
} from '/imports/shared/scoring';
import { getAuthTestRunId } from '/imports/server/auth/settings';
import { resetTestAuthData } from '/imports/server/auth/testSupport';
import { resetFixtureTestData } from '/imports/server/fixtures/testSupport';
import { resetMatchResultTestData } from '/imports/server/matchResults/testSupport';
import { resetPlayerProfileTestData } from '/imports/server/playerProfiles/testSupport';
import { resetPredictionTestData } from '/imports/server/predictions/testSupport';

type MethodHandler = (
  this: Meteor.MethodThisType,
  ...args: unknown[]
) => Promise<unknown>;

interface TestInvocation extends Meteor.MethodThisType {
  userId: string | null;
}

interface CollectionInfo {
  readonly name: string;
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
      id: `fixture-leaderboard-test-${label}`,
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
  `ccpp011b-${prefix}-${Random.id().toLowerCase()}@example.test`;

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

  assert.ok(ownerRunId, 'fixture leaderboard test run id exists');

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
    competitionDisplayName: 'Fixture Leaderboard Cup',
    createdAt: now,
    createdByAdminId: 'fixture-leaderboard-test-admin',
    isCancelled: false,
    publishedAt: now,
    publishedByAdminId: 'fixture-leaderboard-test-admin',
    revision: INITIAL_FIXTURE_REVISION,
    rulesetSnapshot: defaultRuleset,
    scheduledKickoffAt: new Date('2098-10-25T13:30:00.000Z'),
    team1DisplayName: `Team 1 ${Random.id()}`,
    team2DisplayName: `Team 2 ${Random.id()}`,
    updatedAt: now,
    updatedByAdminId: 'fixture-leaderboard-test-admin',
    visibility: 'published' as const,
    ...overrides,
  };

  return Fixtures.insertAsync(document as FixtureDocument);
};

const validPrediction = (yellowCards = 0): FixturePrediction => ({
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
    yellowCards,
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

const observed = <T>(
  value: T,
  status: 'provisional' | 'confirmed' = 'provisional',
): ObservedValue<T> => ({ status, value });

const pending = <T>(): ObservedValue<T> => ({ status: 'pending' });

const completeObservations = ({
  matchStatus = 'provisional',
  redCardsPending = false,
  team1YellowCards = 0,
}: {
  readonly matchStatus?: 'provisional' | 'confirmed';
  readonly redCardsPending?: boolean;
  readonly team1YellowCards?: number;
} = {}): FixtureObservations => ({
  firstTry: observed('team1', matchStatus),
  halfTimeLeader: observed('team1', matchStatus),
  highestScoringHalf: observed('first', matchStatus),
  matchStatus,
  team1: {
    conversions: observed(2, matchStatus),
    dropGoals: observed(0, matchStatus),
    penaltyKicks: observed(1, matchStatus),
    redCards: redCardsPending ? pending() : observed(0, matchStatus),
    tries: observed(2, matchStatus),
    yellowCards: observed(team1YellowCards, matchStatus),
  },
  team2: {
    conversions: observed(1, matchStatus),
    dropGoals: observed(0, matchStatus),
    penaltyKicks: observed(0, matchStatus),
    redCards: redCardsPending ? pending() : observed(0, matchStatus),
    tries: observed(1, matchStatus),
    yellowCards: observed(0, matchStatus),
  },
});

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

const getFixtureLeaderboard = (
  invocation: TestInvocation,
  input: {
    readonly fixtureId: string;
    readonly limit?: number;
    readonly offset?: number;
  },
) =>
  callMethod<FixtureLeaderboardProjection>(
    FIXTURE_LEADERBOARD_METHODS.getFixtureLeaderboard,
    [input],
    invocation,
  );

const getMyFixtureScore = (invocation: TestInvocation, fixtureId: string) =>
  callMethod<PlayerFixtureScoreProjection | null>(
    PREDICTION_METHODS.getMyFixtureScore,
    [fixtureId],
    invocation,
  );

const updatePlayerProfile = (invocation: TestInvocation, displayName: string) =>
  callMethod<PublicPlayerIdentity>(
    PLAYER_PROFILE_METHODS.updateMine,
    [
      {
        displayName,
      },
    ],
    invocation,
  );

const collectionNames = async (): Promise<readonly string[]> => {
  const db = MongoInternals.defaultRemoteCollectionDriver().mongo.db;
  const collections = (await db
    .listCollections({}, { nameOnly: true })
    .toArray()) as CollectionInfo[];

  return collections.map((collection) => collection.name);
};

describe('fixture leaderboard method', function () {
  this.timeout(20_000);

  beforeEach(async () => {
    await resetPlayerProfileTestData();
    await resetMatchResultTestData();
    await resetPredictionTestData();
    await resetFixtureTestData();
    await resetTestAuthData();
  });

  it('requires a verified signed-in player', async () => {
    const fixtureId = await insertFixtureDocument();

    await assert.rejects(
      () =>
        getFixtureLeaderboard(makeInvocation('anonymous'), {
          fixtureId,
        }),
      /Sign in to continue|not-authenticated/i,
    );
  });

  it('allows a signed-in viewer without a prediction to see a published fixture leaderboard', async () => {
    const admin = await createVerifiedAdmin();
    const player = await createVerifiedPlayer('player');
    const viewer = await createVerifiedPlayer('viewer');
    const fixtureId = await insertFixtureDocument();

    await submitPrediction(player.invocation, { fixtureId });
    await saveProvisional(admin.invocation, {
      expectedRevision: NO_MATCH_RESULT_REVISION,
      fixtureId,
      observations: completeObservations(),
    });

    const projection = await getFixtureLeaderboard(viewer.invocation, {
      fixtureId,
    });

    assert.equal(projection.status, 'provisional');
    assert.equal(projection.totalEntries, 1);
    assert.equal(projection.currentUserParticipating, false);
    assert.equal(projection.rows.length, 1);
    assert.equal(projection.rows[0].isCurrentUser, false);
  });

  it('returns the awaiting-result contract without fake rank rows', async () => {
    const playerA = await createVerifiedPlayer('player-a');
    const playerB = await createVerifiedPlayer('player-b');
    const fixtureId = await insertFixtureDocument();

    await submitPrediction(playerA.invocation, { fixtureId });
    await submitPrediction(playerB.invocation, {
      fixtureId,
      prediction: validPrediction(1),
    });

    const projection = await getFixtureLeaderboard(playerA.invocation, {
      fixtureId,
    });

    assert.equal(projection.status, 'awaiting_result');
    assert.equal(projection.resultRevision, null);
    assert.equal(projection.totalEntries, 2);
    assert.equal(projection.currentUserParticipating, true);
    assert.deepEqual(projection.rows, []);
    assert.equal(projection.currentUserRow, undefined);
  });

  it('includes all eligible saved predictions in a provisional leaderboard', async () => {
    const admin = await createVerifiedAdmin();
    const playerA = await createVerifiedPlayer('player-a');
    const playerB = await createVerifiedPlayer('player-b');
    const playerC = await createVerifiedPlayer('player-c');
    const fixtureId = await insertFixtureDocument();

    await submitPrediction(playerA.invocation, { fixtureId });
    await submitPrediction(playerB.invocation, {
      fixtureId,
      prediction: validPrediction(1),
    });
    await submitPrediction(playerC.invocation, {
      fixtureId,
      prediction: validPrediction(1),
    });
    const result = await saveProvisional(admin.invocation, {
      expectedRevision: NO_MATCH_RESULT_REVISION,
      fixtureId,
      observations: completeObservations({ redCardsPending: true }),
    });

    const projection = await getFixtureLeaderboard(playerB.invocation, {
      fixtureId,
    });

    assert.equal(projection.status, 'provisional');
    assert.equal(projection.resultRevision, result.revision);
    assert.equal(projection.totalEntries, 3);
    assert.equal(projection.rows.length, 3);
    assert.deepEqual(
      projection.rows.map((row) => row.place),
      [1, 2, 2],
    );
    assert.deepEqual(
      projection.rows.map((row) => row.pendingCount),
      [1, 1, 1],
    );
    assert.ok(projection.rows.some((row) => row.isCurrentUser));
  });

  it('shows another player public display name when one exists', async () => {
    const admin = await createVerifiedAdmin();
    const player = await createVerifiedPlayer('player');
    const viewer = await createVerifiedPlayer('viewer');
    const fixtureId = await insertFixtureDocument();

    await updatePlayerProfile(player.invocation, 'Pierre');
    await submitPrediction(player.invocation, { fixtureId });
    await saveProvisional(admin.invocation, {
      expectedRevision: NO_MATCH_RESULT_REVISION,
      fixtureId,
      observations: completeObservations(),
    });

    const projection = await getFixtureLeaderboard(viewer.invocation, {
      fixtureId,
    });

    assert.equal(projection.rows.length, 1);
    assert.equal(projection.rows[0].displayLabel, 'Pierre');
    assert.equal(projection.rows[0].isCurrentUser, false);
  });

  it('keeps the fixture-scoped Rooster fallback when no profile exists', async () => {
    const admin = await createVerifiedAdmin();
    const player = await createVerifiedPlayer('player');
    const viewer = await createVerifiedPlayer('viewer');
    const fixtureId = await insertFixtureDocument();

    await submitPrediction(player.invocation, { fixtureId });
    await saveProvisional(admin.invocation, {
      expectedRevision: NO_MATCH_RESULT_REVISION,
      fixtureId,
      observations: completeObservations(),
    });

    const projection = await getFixtureLeaderboard(viewer.invocation, {
      fixtureId,
    });

    assert.match(projection.rows[0].displayLabel, /^Rooster [A-F0-9]{8}$/);
    assert.notEqual(projection.rows[0].displayLabel, player.userId);
  });

  it('allows duplicate public display names while keeping separate rows and ranks', async () => {
    const admin = await createVerifiedAdmin();
    const playerA = await createVerifiedPlayer('player-a');
    const playerB = await createVerifiedPlayer('player-b');
    const viewer = await createVerifiedPlayer('viewer');
    const fixtureId = await insertFixtureDocument();

    await updatePlayerProfile(playerA.invocation, 'John');
    await updatePlayerProfile(playerB.invocation, 'John');
    await submitPrediction(playerA.invocation, { fixtureId });
    await submitPrediction(playerB.invocation, {
      fixtureId,
      prediction: validPrediction(1),
    });
    await saveProvisional(admin.invocation, {
      expectedRevision: NO_MATCH_RESULT_REVISION,
      fixtureId,
      observations: completeObservations(),
    });

    const projection = await getFixtureLeaderboard(viewer.invocation, {
      fixtureId,
    });

    assert.deepEqual(
      projection.rows.map((row) => row.displayLabel),
      ['John', 'John'],
    );
    assert.deepEqual(
      projection.rows.map((row) => row.place),
      [1, 2],
    );
    assert.notEqual(projection.rows[0].rowId, projection.rows[1].rowId);
  });

  it('reflects display name changes on fresh calculation without mutating predictions', async () => {
    const admin = await createVerifiedAdmin();
    const player = await createVerifiedPlayer('player');
    const viewer = await createVerifiedPlayer('viewer');
    const fixtureId = await insertFixtureDocument();

    await updatePlayerProfile(player.invocation, 'Pierre');
    const savedPrediction = await submitPrediction(player.invocation, {
      fixtureId,
    });
    await saveProvisional(admin.invocation, {
      expectedRevision: NO_MATCH_RESULT_REVISION,
      fixtureId,
      observations: completeObservations(),
    });

    const before = await getFixtureLeaderboard(viewer.invocation, {
      fixtureId,
    });

    await updatePlayerProfile(player.invocation, 'Pete');

    const after = await getFixtureLeaderboard(viewer.invocation, {
      fixtureId,
    });
    const storedPrediction = await Predictions.findOneAsync({
      fixtureId,
      userId: player.userId,
    });

    assert.equal(before.rows[0].displayLabel, 'Pierre');
    assert.equal(after.rows[0].displayLabel, 'Pete');
    assert.equal(storedPrediction?.revision, savedPrediction.revision);
    assert.equal(
      'displayName' in (storedPrediction as unknown as Record<string, unknown>),
      false,
    );
  });

  it('returns final leaderboard rows with no pending indicator', async () => {
    const admin = await createVerifiedAdmin();
    const playerA = await createVerifiedPlayer('player-a');
    const playerB = await createVerifiedPlayer('player-b');
    const fixtureId = await insertFixtureDocument();

    await submitPrediction(playerA.invocation, { fixtureId });
    await submitPrediction(playerB.invocation, {
      fixtureId,
      prediction: validPrediction(1),
    });
    const provisional = await saveProvisional(admin.invocation, {
      expectedRevision: NO_MATCH_RESULT_REVISION,
      fixtureId,
      observations: completeObservations(),
    });
    const final = await confirmFinal(admin.invocation, {
      expectedRevision: provisional.revision,
      fixtureId,
      observations: completeObservations({ matchStatus: 'confirmed' }),
    });

    const projection = await getFixtureLeaderboard(playerA.invocation, {
      fixtureId,
    });

    assert.equal(projection.status, 'final');
    assert.equal(projection.resultRevision, final.revision);
    assert.deepEqual(
      projection.rows.map((row) => row.pendingCount),
      [0, 0],
    );
  });

  it('returns cancelled state for a cancelled fixture without ranking rows', async () => {
    const player = await createVerifiedPlayer('player');
    const fixtureId = await insertFixtureDocument();

    await submitPrediction(player.invocation, { fixtureId });
    assert.equal(
      await Fixtures.updateAsync(fixtureId, {
        $set: {
          cancelledAt: new Date('2026-01-02T00:00:00.000Z'),
          cancelledByAdminId: 'fixture-leaderboard-test-admin',
          isCancelled: true,
        },
      }),
      1,
    );

    const projection = await getFixtureLeaderboard(player.invocation, {
      fixtureId,
    });

    assert.equal(projection.status, 'cancelled');
    assert.equal(projection.totalEntries, 1);
    assert.deepEqual(projection.rows, []);
  });

  it('enforces pagination bounds and returns currentUserRow outside the page', async () => {
    const admin = await createVerifiedAdmin();
    const players = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        createVerifiedPlayer(`player-${index}`),
      ),
    );
    const fixtureId = await insertFixtureDocument();

    await Promise.all(
      players.map((player, index) =>
        submitPrediction(player.invocation, {
          fixtureId,
          prediction: validPrediction(index),
        }),
      ),
    );
    await saveProvisional(admin.invocation, {
      expectedRevision: NO_MATCH_RESULT_REVISION,
      fixtureId,
      observations: completeObservations(),
    });

    await assert.rejects(
      () =>
        getFixtureLeaderboard(players[0].invocation, {
          fixtureId,
          limit: MAX_FIXTURE_LEADERBOARD_LIMIT + 1,
        }),
      /Leaderboard limit must be from 1 to 100|invalid-leaderboard-limit/i,
    );

    const projection = await getFixtureLeaderboard(players[3].invocation, {
      fixtureId,
      limit: 1,
    });

    assert.equal(projection.rows.length, 1);
    assert.equal(projection.currentUserRow?.isCurrentUser, true);
    assert.equal(projection.currentUserRow?.place, 4);
    assert.equal(projection.page.hasMore, true);
  });

  it('recalculates after provisional result correction without mutating predictions or persisting leaderboard documents', async () => {
    const admin = await createVerifiedAdmin();
    const playerA = await createVerifiedPlayer('player-a');
    const playerB = await createVerifiedPlayer('player-b');
    const fixtureId = await insertFixtureDocument();

    const savedPrediction = await submitPrediction(playerA.invocation, {
      fixtureId,
      prediction: validPrediction(0),
    });
    await submitPrediction(playerB.invocation, {
      fixtureId,
      prediction: validPrediction(1),
    });
    const firstResult = await saveProvisional(admin.invocation, {
      expectedRevision: NO_MATCH_RESULT_REVISION,
      fixtureId,
      observations: completeObservations({ team1YellowCards: 0 }),
    });
    const firstProjection = await getFixtureLeaderboard(playerA.invocation, {
      fixtureId,
    });

    const correctedResult = await saveProvisional(admin.invocation, {
      expectedRevision: firstResult.revision,
      fixtureId,
      observations: completeObservations({ team1YellowCards: 1 }),
    });
    const correctedProjection = await getFixtureLeaderboard(
      playerA.invocation,
      {
        fixtureId,
      },
    );
    const storedPrediction = await Predictions.findOneAsync({
      fixtureId,
      userId: playerA.userId,
    });
    const collections = await collectionNames();

    assert.equal(firstProjection.resultRevision, firstResult.revision);
    assert.equal(correctedProjection.resultRevision, correctedResult.revision);
    assert.equal(
      firstProjection.rows.find((row) => row.isCurrentUser)?.place,
      1,
    );
    assert.equal(
      correctedProjection.rows.find((row) => row.isCurrentUser)?.place,
      2,
    );
    assert.equal(storedPrediction?.revision, savedPrediction.revision);
    assert.equal(
      'score' in (storedPrediction as unknown as Record<string, unknown>),
      false,
    );
    assert.equal(collections.includes('fixture_leaderboards'), false);
    assert.equal(collections.includes('player_scores'), false);
  });

  it("keeps the current user's leaderboard score equal to getMyFixtureScore", async () => {
    const admin = await createVerifiedAdmin();
    const player = await createVerifiedPlayer('player');
    const fixtureId = await insertFixtureDocument();

    await submitPrediction(player.invocation, {
      fixtureId,
      prediction: validPrediction(2),
    });
    await saveProvisional(admin.invocation, {
      expectedRevision: NO_MATCH_RESULT_REVISION,
      fixtureId,
      observations: completeObservations({
        redCardsPending: true,
        team1YellowCards: 1,
      }),
    });

    const [leaderboard, score] = await Promise.all([
      getFixtureLeaderboard(player.invocation, {
        fixtureId,
      }),
      getMyFixtureScore(player.invocation, fixtureId),
    ]);
    const ownRow = leaderboard.rows.find((row) => row.isCurrentUser);

    assert.ok(ownRow);
    assert.ok(score);
    assert.equal(leaderboard.resultRevision, score.resultRevision);
    assert.equal(ownRow.score, score.currentScore);
  });

  it('does not serialize user IDs, emails, prediction payloads, or raw result documents', async () => {
    const admin = await createVerifiedAdmin();
    const player = await createVerifiedPlayer('private-player');
    const viewer = await createVerifiedPlayer('viewer');
    const fixtureId = await insertFixtureDocument();

    await submitPrediction(player.invocation, { fixtureId });
    await saveProvisional(admin.invocation, {
      expectedRevision: NO_MATCH_RESULT_REVISION,
      fixtureId,
      observations: completeObservations(),
    });

    const projection = await getFixtureLeaderboard(viewer.invocation, {
      fixtureId,
    });
    const serialized = JSON.stringify(projection);

    assert.equal(serialized.includes(player.userId), false);
    assert.equal(serialized.includes(viewer.userId), false);
    assert.equal(serialized.includes(player.email), false);
    assert.equal(serialized.includes(viewer.email), false);
    assert.equal(serialized.includes('"userId"'), false);
    assert.equal(serialized.includes('"prediction"'), false);
    assert.equal(serialized.includes('"observations"'), false);
    assert.equal(serialized.includes('"emails"'), false);
    assert.equal(serialized.includes('"roles"'), false);
    assert.equal(serialized.includes('"createdByAdminId"'), false);
    assert.equal(serialized.includes('"updatedByAdminId"'), false);
    assert.equal(serialized.includes('"services"'), false);
    assert.equal(serialized.includes('"passwordless"'), false);
  });
});
