import { Meteor } from 'meteor/meteor';

import {
  FixtureValidationError,
  sanitizeFixtureId,
} from '/imports/shared/fixtures';
import {
  PlayerFixtureScoreError,
  type PlayerFixtureScoreProjection,
} from '/imports/shared/playerFixtureScores';
import { PREDICTION_METHODS } from '/imports/shared/predictions';
import { ScoringValidationError } from '/imports/shared/scoring';
import { requireVerifiedUser } from '/imports/server/auth/authorization';
import { loadMyFixtureScoreProjection } from './service';

const requireVerifiedUserId = async (
  invocation: Pick<Meteor.MethodThisType, 'userId'>,
): Promise<string> => {
  await requireVerifiedUser(invocation);

  if (!invocation.userId) {
    throw new Meteor.Error('not-authenticated', 'Sign in to continue.');
  }

  return invocation.userId;
};

const asMeteorFixtureScoreError = (error: unknown): Meteor.Error => {
  if (error instanceof PlayerFixtureScoreError) {
    return new Meteor.Error(error.code, error.message);
  }

  if (error instanceof FixtureValidationError) {
    return new Meteor.Error(error.code, error.message);
  }

  if (error instanceof ScoringValidationError) {
    const firstIssue = error.issues[0];

    return new Meteor.Error(
      'fixture-score-invalid',
      firstIssue?.message ?? 'Fixture score inputs are invalid.',
    );
  }

  if (error instanceof Meteor.Error) {
    return error;
  }

  return new Meteor.Error(
    'fixture-score-operation-failed',
    'The fixture score could not be calculated.',
  );
};

Meteor.methods({
  [PREDICTION_METHODS.getMyFixtureScore]: async function getMyFixtureScore(
    fixtureIdInput: unknown,
  ): Promise<PlayerFixtureScoreProjection | null> {
    try {
      const fixtureId = sanitizeFixtureId(fixtureIdInput);
      const userId = await requireVerifiedUserId(this);

      return await loadMyFixtureScoreProjection({ fixtureId, userId });
    } catch (error) {
      throw asMeteorFixtureScoreError(error);
    }
  },
});
