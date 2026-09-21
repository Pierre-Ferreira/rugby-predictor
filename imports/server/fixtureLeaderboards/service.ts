import { Meteor } from 'meteor/meteor';

import { Fixtures } from '/imports/api/fixtures/collection';
import { MatchResults } from '/imports/api/matchResults/collection';
import { Predictions } from '/imports/api/predictions/collection';
import {
  buildFixtureLeaderboard,
  type FixtureLeaderboardProjection,
} from '/imports/shared/fixtureLeaderboards';
import { fixtureLeaderboardPlayerIdentities } from '/imports/shared/fixtureLeaderboards/privacy';
import { validateRuleset } from '/imports/shared/scoring';
import { resolvePublicPlayerIdentities } from '/imports/server/playerProfiles/service';

const leaderboardFixtureFields = {
  _id: 1,
  isCancelled: 1,
  rulesetSnapshot: 1,
  visibility: 1,
} as const;

const leaderboardPredictionFields = {
  fixtureId: 1,
  prediction: 1,
  revision: 1,
  ruleset: 1,
  userId: 1,
} as const;

const leaderboardResultFields = {
  fixtureId: 1,
  observations: 1,
  revision: 1,
  ruleset: 1,
} as const;

const fixtureNotFoundError = (): Meteor.Error =>
  new Meteor.Error('fixture-not-found', 'Fixture was not found.');

const rulesetUnavailableError = (): Meteor.Error =>
  new Meteor.Error(
    'fixture-ruleset-unavailable',
    "This fixture's published prediction rules are unavailable.",
  );

export const loadFixtureLeaderboardProjection = async ({
  fixtureId,
  limit,
  offset,
  userId,
}: {
  readonly fixtureId: string;
  readonly limit: number;
  readonly offset: number;
  readonly userId: string;
}): Promise<FixtureLeaderboardProjection> => {
  const fixture = await Fixtures.findOneAsync(fixtureId, {
    fields: leaderboardFixtureFields,
  });

  if (!fixture) {
    throw fixtureNotFoundError();
  }

  if (fixture.visibility !== 'published') {
    throw new Meteor.Error(
      'fixture-not-open',
      'Draft fixtures do not have player leaderboards.',
    );
  }

  if (!fixture.rulesetSnapshot) {
    throw rulesetUnavailableError();
  }

  const rulesetValidation = validateRuleset(fixture.rulesetSnapshot);

  if (!rulesetValidation.valid) {
    throw rulesetUnavailableError();
  }

  const [result, predictions] = await Promise.all([
    MatchResults.findOneAsync(
      {
        fixtureId,
      },
      {
        fields: leaderboardResultFields,
      },
    ),
    Predictions.find(
      {
        fixtureId,
      },
      {
        fields: leaderboardPredictionFields,
        sort: {
          userId: 1,
        },
      },
    ).fetchAsync(),
  ]);
  const uniqueUserIds = Array.from(
    new Set(predictions.map((prediction) => prediction.userId)),
  ).sort();
  const publicIdentities = await resolvePublicPlayerIdentities(uniqueUserIds);
  const playerIdentities = fixtureLeaderboardPlayerIdentities({
    currentUserId: userId,
    fixtureId,
    players: uniqueUserIds.map((predictionUserId) => ({
      publicIdentity: publicIdentities.get(predictionUserId),
      userId: predictionUserId,
    })),
  });

  return buildFixtureLeaderboard({
    currentUserId: userId,
    fixture,
    page: {
      limit,
      offset,
    },
    playerIdentities,
    predictions,
    result: result ?? null,
  });
};
