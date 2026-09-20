import { Meteor } from 'meteor/meteor';

import { Fixtures } from '/imports/api/fixtures/collection';
import { MatchResults } from '/imports/api/matchResults/collection';
import { Predictions } from '/imports/api/predictions/collection';
import {
  calculatePlayerFixtureScoreProjection,
  type PlayerFixtureScoreProjection,
} from '/imports/shared/playerFixtureScores';
import { validateRuleset } from '/imports/shared/scoring';

const scoreFixtureFields = {
  _id: 1,
  isCancelled: 1,
  rulesetSnapshot: 1,
  visibility: 1,
} as const;

const scorePredictionFields = {
  fixtureId: 1,
  prediction: 1,
  revision: 1,
  ruleset: 1,
} as const;

const scoreResultFields = {
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

export const loadMyFixtureScoreProjection = async ({
  fixtureId,
  userId,
}: {
  readonly fixtureId: string;
  readonly userId: string;
}): Promise<PlayerFixtureScoreProjection | null> => {
  const fixture = await Fixtures.findOneAsync(fixtureId, {
    fields: scoreFixtureFields,
  });

  if (!fixture) {
    throw fixtureNotFoundError();
  }

  if (fixture.visibility !== 'published') {
    throw new Meteor.Error(
      'fixture-not-open',
      'Draft fixtures do not have player fixture scores.',
    );
  }

  if (!fixture.rulesetSnapshot) {
    throw rulesetUnavailableError();
  }

  const rulesetValidation = validateRuleset(fixture.rulesetSnapshot);

  if (!rulesetValidation.valid) {
    throw rulesetUnavailableError();
  }

  const prediction = await Predictions.findOneAsync(
    {
      fixtureId,
      userId,
    },
    {
      fields: scorePredictionFields,
    },
  );

  if (!prediction) {
    return null;
  }

  const result =
    (await MatchResults.findOneAsync(
      {
        fixtureId,
      },
      {
        fields: scoreResultFields,
      },
    )) ?? null;

  return calculatePlayerFixtureScoreProjection({
    fixture,
    prediction,
    result,
  });
};
