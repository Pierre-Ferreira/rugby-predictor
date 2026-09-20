import { Meteor } from 'meteor/meteor';

import {
  FixtureLeaderboardError,
  FIXTURE_LEADERBOARD_METHODS,
  sanitizeFixtureLeaderboardInput,
  type FixtureLeaderboardProjection,
} from '/imports/shared/fixtureLeaderboards';
import { FixtureValidationError } from '/imports/shared/fixtures';
import { PlayerFixtureScoreError } from '/imports/shared/playerFixtureScores';
import { ScoringValidationError } from '/imports/shared/scoring';
import { requireVerifiedUser } from '/imports/server/auth/authorization';
import { loadFixtureLeaderboardProjection } from './service';
import { registerFixtureLeaderboardTestMethods } from './testSupport';

const requireVerifiedUserId = async (
  invocation: Pick<Meteor.MethodThisType, 'userId'>,
): Promise<string> => {
  await requireVerifiedUser(invocation);

  if (!invocation.userId) {
    throw new Meteor.Error('not-authenticated', 'Sign in to continue.');
  }

  return invocation.userId;
};

const logCanonicalLeaderboardFailure = (
  error: unknown,
  fixtureId?: string,
): void => {
  console.error('Rugby Rooster fixture leaderboard calculation failed', {
    error,
    fixtureId,
  });
};

const asMeteorLeaderboardError = (
  error: unknown,
  fixtureId?: string,
): Meteor.Error => {
  if (error instanceof FixtureLeaderboardError) {
    return new Meteor.Error(error.code, error.message);
  }

  if (error instanceof FixtureValidationError) {
    return new Meteor.Error(error.code, error.message);
  }

  if (error instanceof PlayerFixtureScoreError) {
    logCanonicalLeaderboardFailure(error, fixtureId);

    return new Meteor.Error(
      'fixture-leaderboard-invalid',
      'The fixture leaderboard could not be calculated.',
    );
  }

  if (error instanceof ScoringValidationError) {
    logCanonicalLeaderboardFailure(error, fixtureId);

    return new Meteor.Error(
      'fixture-leaderboard-invalid',
      'The fixture leaderboard could not be calculated.',
    );
  }

  if (error instanceof Meteor.Error) {
    return error;
  }

  logCanonicalLeaderboardFailure(error, fixtureId);

  return new Meteor.Error(
    'fixture-leaderboard-operation-failed',
    'The fixture leaderboard could not be loaded.',
  );
};

Meteor.methods({
  [FIXTURE_LEADERBOARD_METHODS.getFixtureLeaderboard]:
    async function getFixtureLeaderboard(
      rawInput: unknown,
    ): Promise<FixtureLeaderboardProjection> {
      let fixtureId: string | undefined;

      try {
        const input = sanitizeFixtureLeaderboardInput(rawInput);
        fixtureId = input.fixtureId;
        const userId = await requireVerifiedUserId(this);

        return await loadFixtureLeaderboardProjection({
          fixtureId: input.fixtureId,
          limit: input.limit,
          offset: input.offset,
          userId,
        });
      } catch (error) {
        throw asMeteorLeaderboardError(error, fixtureId);
      }
    },
});

await registerFixtureLeaderboardTestMethods();
