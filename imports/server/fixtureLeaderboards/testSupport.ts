import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

import { Fixtures } from '/imports/api/fixtures/collection';
import { MatchResults } from '/imports/api/matchResults/collection';
import { Predictions } from '/imports/api/predictions/collection';
import {
  INITIAL_FIXTURE_REVISION,
  type FixtureDocument,
} from '/imports/shared/fixtures';
import {
  INITIAL_MATCH_RESULT_REVISION,
  type MatchResultDocument,
} from '/imports/shared/matchResults';
import { TEST_FIXTURE_LEADERBOARD_METHODS } from '/imports/shared/fixtureLeaderboards';
import {
  INITIAL_PREDICTION_REVISION,
  type PredictionEntryDocument,
} from '/imports/shared/predictions';
import {
  defaultRuleset,
  type FixtureObservations,
  type FixturePrediction,
  type ObservedValue,
  type RulesetIdentity,
  type RulesetSnapshot,
} from '/imports/shared/scoring';
import {
  areTestHelpersEnabled,
  assertVerifiedAuthTestEnvironment,
} from '/imports/server/auth/settings';

const assertArgCount = (
  args: readonly unknown[],
  expected: number,
): readonly unknown[] => {
  if (args.length !== expected) {
    throw new Meteor.Error(
      'invalid-test-helper-call',
      'Test helper call has invalid arguments.',
    );
  }

  return args;
};

const assertRecord = (
  value: unknown,
  message: string,
): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Meteor.Error('invalid-test-helper-call', message);
  }

  return value as Record<string, unknown>;
};

const rulesetIdentity = (ruleset: RulesetSnapshot): RulesetIdentity => ({
  id: ruleset.id,
  schemaVersion: ruleset.schemaVersion,
  version: ruleset.version,
});

const observed = <T>(
  value: T,
  status: 'provisional' | 'confirmed' = 'provisional',
): ObservedValue<T> => ({ status, value });

const pending = <T>(): ObservedValue<T> => ({ status: 'pending' });

const scenarioPrediction = (yellowCards: number): FixturePrediction => ({
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

const scenarioObservations = ({
  matchStatus,
  redCardsPending,
  team1YellowCards,
}: {
  readonly matchStatus: 'provisional' | 'confirmed';
  readonly redCardsPending: boolean;
  readonly team1YellowCards: number;
}): FixtureObservations => ({
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

const testOwner = async () => {
  const testEnvironment = await assertVerifiedAuthTestEnvironment();

  return {
    ownerRunId: testEnvironment.runId,
    owner: {
      rugbyRoosterTest: {
        ownerRunId: testEnvironment.runId,
      },
    },
  };
};

const createCompetitorUser = async (label: string, ownerRunId: string) =>
  Meteor.users.insertAsync({
    createdAt: new Date(),
    emails: [
      {
        address: `ccpp011b-${label}-${Random.id().toLowerCase()}@example.test`,
        verified: true,
      },
    ],
    rugbyRoosterTest: {
      ownerRunId,
    },
    services: {},
  } as unknown as Meteor.User);

const insertPrediction = async ({
  fixtureId,
  now,
  ownerRunId,
  prediction,
  ruleset,
  userId,
}: {
  readonly fixtureId: string;
  readonly now: Date;
  readonly ownerRunId: string;
  readonly prediction: FixturePrediction;
  readonly ruleset: RulesetSnapshot;
  readonly userId: string;
}) =>
  Predictions.insertAsync({
    _id: Random.id(),
    createdAt: now,
    fixtureId,
    prediction,
    revision: INITIAL_PREDICTION_REVISION,
    rugbyRoosterTest: {
      ownerRunId,
    },
    ruleset: rulesetIdentity(ruleset),
    updatedAt: now,
    userId,
  } as PredictionEntryDocument);

const assertOwnedScenarioFixture = async (
  fixtureId: unknown,
  ownerRunId: string,
): Promise<string> => {
  if (typeof fixtureId !== 'string' || fixtureId.trim().length === 0) {
    throw new Meteor.Error(
      'invalid-test-helper-call',
      'Fixture id is required.',
    );
  }

  const fixture = await Fixtures.findOneAsync({
    _id: fixtureId,
    'rugbyRoosterTest.ownerRunId': ownerRunId,
  });

  if (!fixture) {
    throw new Meteor.Error(
      'test-data-not-owned',
      'Test helper refused to operate on data outside the current test run.',
    );
  }

  return fixtureId;
};

export const registerFixtureLeaderboardTestMethods = async () => {
  if (!areTestHelpersEnabled()) {
    return;
  }

  await assertVerifiedAuthTestEnvironment();

  Meteor.methods({
    [TEST_FIXTURE_LEADERBOARD_METHODS.seedScenario]:
      async function seedScenario(...args: unknown[]) {
        assertArgCount(args, 0);

        if (!this.userId) {
          throw new Meteor.Error(
            'not-authorized',
            'A signed-in test user is required.',
          );
        }

        const { owner, ownerRunId } = await testOwner();
        const now = new Date();
        const ruleset = defaultRuleset;
        const fixtureId = await Fixtures.insertAsync({
          ...owner,
          competitionDisplayName: 'Fixture Leaderboard Cup',
          createdAt: now,
          createdByAdminId: `test-leaderboard-admin-${ownerRunId}`,
          isCancelled: false,
          publishedAt: now,
          publishedByAdminId: `test-leaderboard-admin-${ownerRunId}`,
          revision: INITIAL_FIXTURE_REVISION,
          rulesetSnapshot: ruleset,
          scheduledKickoffAt: new Date('2098-08-22T13:00:00.000Z'),
          team1DisplayName: 'Red Roosters',
          team2DisplayName: 'Blue Boots',
          updatedAt: now,
          updatedByAdminId: `test-leaderboard-admin-${ownerRunId}`,
          venueDisplayName: 'Loopback Stadium',
          visibility: 'published',
        } as unknown as FixtureDocument);
        const competitorA = await createCompetitorUser('leader-a', ownerRunId);
        const competitorB = await createCompetitorUser('leader-b', ownerRunId);
        const competitorC = await createCompetitorUser('leader-c', ownerRunId);

        await Promise.all([
          insertPrediction({
            fixtureId,
            now,
            ownerRunId,
            prediction: scenarioPrediction(0),
            ruleset,
            userId: competitorA,
          }),
          insertPrediction({
            fixtureId,
            now,
            ownerRunId,
            prediction: scenarioPrediction(1),
            ruleset,
            userId: this.userId,
          }),
          insertPrediction({
            fixtureId,
            now,
            ownerRunId,
            prediction: scenarioPrediction(1),
            ruleset,
            userId: competitorB,
          }),
          insertPrediction({
            fixtureId,
            now,
            ownerRunId,
            prediction: scenarioPrediction(2),
            ruleset,
            userId: competitorC,
          }),
        ]);

        const resultId = await MatchResults.insertAsync({
          ...owner,
          _id: Random.id(),
          createdAt: now,
          createdByAdminId: `test-leaderboard-admin-${ownerRunId}`,
          fixtureId,
          observations: scenarioObservations({
            matchStatus: 'provisional',
            redCardsPending: true,
            team1YellowCards: 0,
          }),
          revision: INITIAL_MATCH_RESULT_REVISION,
          ruleset: rulesetIdentity(ruleset),
          updatedAt: now,
          updatedByAdminId: `test-leaderboard-admin-${ownerRunId}`,
        } as MatchResultDocument);

        return {
          fixtureId,
          resultId,
        };
      },

    [TEST_FIXTURE_LEADERBOARD_METHODS.updateScenarioResult]:
      async function updateScenarioResult(...args: unknown[]) {
        const [input] = assertArgCount(args, 1);
        const record = assertRecord(
          input,
          'Scenario result input is required.',
        );
        const { ownerRunId } = await testOwner();
        const fixtureId = await assertOwnedScenarioFixture(
          record.fixtureId,
          ownerRunId,
        );
        const mode = record.mode;

        if (mode !== 'correction' && mode !== 'final') {
          throw new Meteor.Error(
            'invalid-test-helper-call',
            'Scenario result mode is required.',
          );
        }

        const now = new Date();
        const observations = scenarioObservations({
          matchStatus: mode === 'final' ? 'confirmed' : 'provisional',
          redCardsPending: false,
          team1YellowCards: 1,
        });
        const updated = await MatchResults.updateAsync(
          {
            fixtureId,
            'rugbyRoosterTest.ownerRunId': ownerRunId,
          },
          {
            $inc: {
              revision: 1,
            },
            $set: {
              ...(mode === 'final'
                ? {
                    confirmedAt: now,
                    confirmedByAdminId: `test-leaderboard-admin-${ownerRunId}`,
                  }
                : {}),
              observations,
              updatedAt: now,
              updatedByAdminId: `test-leaderboard-admin-${ownerRunId}`,
            },
          },
        );

        if (updated !== 1) {
          throw new Meteor.Error(
            'test-scenario-not-found',
            'Leaderboard scenario result was not found.',
          );
        }

        const result = await MatchResults.findOneAsync(
          {
            fixtureId,
          },
          {
            fields: {
              revision: 1,
            },
          },
        );

        return {
          fixtureId,
          revision: result?.revision ?? null,
        };
      },
  });
};
