import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

import { Fixtures } from '/imports/api/fixtures/collection';
import { MatchResults } from '/imports/api/matchResults/collection';
import { Predictions } from '/imports/api/predictions/collection';
import {
  FixtureValidationError,
  sanitizeFixtureId,
} from '/imports/shared/fixtures';
import {
  PREDICTION_ACCESS_LOCKED_ERROR,
  resolvePredictionAccess,
} from '/imports/shared/predictionAccess';
import {
  PREDICTION_METHODS,
  PREDICTION_PUBLICATIONS,
  PredictionValidationError,
  INITIAL_PREDICTION_REVISION,
  sanitizeSubmitPredictionInput,
  type PredictionEntryDocument,
  type PredictionMutationResult,
} from '/imports/shared/predictions';
import {
  ScoringValidationError,
  validateRuleset,
  type RulesetIdentity,
  type RulesetSnapshot,
} from '/imports/shared/scoring';
import { requireVerifiedUser } from '/imports/server/auth/authorization';
import { getAuthTestRunId } from '/imports/server/auth/settings';
import { registerPredictionTestMethods } from './testSupport';

interface RawPredictionCollection {
  createIndex: (
    keys: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<string>;
  updateOne: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => Promise<{
    readonly upsertedCount: number;
  }>;
}

const rawPredictions = (): RawPredictionCollection =>
  Predictions.rawCollection() as unknown as RawPredictionCollection;

const fixturePredictionContextFields = {
  competitionDisplayName: 1,
  isCancelled: 1,
  predictionLockOverride: 1,
  rulesetSnapshot: 1,
  scheduledKickoffAt: 1,
  team1DisplayName: 1,
  team2DisplayName: 1,
  venueDisplayName: 1,
  visibility: 1,
} as const;

const fixturePredictionResultContextFields = {
  fixtureId: 1,
  observations: 1,
  revision: 1,
} as const;

const predictionEntryFields = {
  createdAt: 1,
  fixtureId: 1,
  prediction: 1,
  revision: 1,
  ruleset: 1,
  updatedAt: 1,
  userId: 1,
} as const;

const currentTestOwnership = () => {
  const ownerRunId = getAuthTestRunId();

  return ownerRunId ? { rugbyRoosterTest: { ownerRunId } } : {};
};

const asMeteorPredictionError = (error: unknown): Meteor.Error => {
  if (error instanceof PredictionValidationError) {
    return new Meteor.Error(error.code, error.message);
  }

  if (error instanceof FixtureValidationError) {
    return new Meteor.Error(error.code, error.message);
  }

  if (error instanceof ScoringValidationError) {
    const firstIssue = error.issues[0];

    return new Meteor.Error(
      'invalid-prediction',
      firstIssue?.message ?? 'Prediction answers are invalid.',
    );
  }

  if (error instanceof Meteor.Error) {
    return error;
  }

  return new Meteor.Error(
    'prediction-operation-failed',
    'The prediction operation could not be completed.',
  );
};

const isDuplicateKeyError = (error: unknown): boolean =>
  Boolean(
    error &&
    typeof error === 'object' &&
    (error as { readonly code?: unknown }).code === 11000,
  );

const conflictError = (): Meteor.Error =>
  new Meteor.Error(
    'prediction-conflict',
    'This prediction changed before your update could be saved. Load the latest saved prediction if you want to replace your form values.',
  );

const existingEntryConflictError = (): Meteor.Error =>
  new Meteor.Error(
    'prediction-conflict',
    'A saved prediction already exists for this fixture. Load it before revising.',
  );

const notFoundError = (): Meteor.Error =>
  new Meteor.Error('fixture-not-found', 'Fixture was not found.');

const predictionNotFoundError = (): Meteor.Error =>
  new Meteor.Error(
    'prediction-not-found',
    'No saved prediction exists for this fixture yet.',
  );

const rulesetUnavailableError = (): Meteor.Error =>
  new Meteor.Error(
    'fixture-ruleset-unavailable',
    "This fixture's prediction rules are unavailable.",
  );

const rulesetIdentity = (ruleset: RulesetSnapshot): RulesetIdentity => ({
  id: ruleset.id,
  schemaVersion: ruleset.schemaVersion,
  version: ruleset.version,
});

const requireVerifiedUserId = async (
  invocation: Pick<Meteor.MethodThisType, 'userId'>,
): Promise<string> => {
  await requireVerifiedUser(invocation);

  if (!invocation.userId) {
    throw new Meteor.Error('not-authenticated', 'Sign in to continue.');
  }

  return invocation.userId;
};

const loadEligibleFixture = async (fixtureId: string) => {
  const fixture = await Fixtures.findOneAsync(fixtureId, {
    fields: {
      isCancelled: 1,
      predictionLockOverride: 1,
      rulesetSnapshot: 1,
      scheduledKickoffAt: 1,
      visibility: 1,
    },
  });

  if (!fixture) {
    throw notFoundError();
  }

  if (fixture.visibility !== 'published') {
    throw new Meteor.Error(
      'fixture-not-open',
      'Draft fixtures do not accept prediction submissions.',
    );
  }

  if (!fixture.rulesetSnapshot) {
    throw rulesetUnavailableError();
  }

  const rulesetValidation = validateRuleset(fixture.rulesetSnapshot);

  if (!rulesetValidation.valid) {
    throw rulesetUnavailableError();
  }

  const result =
    (await MatchResults.findOneAsync(
      {
        fixtureId,
      },
      {
        fields: {
          observations: 1,
        },
      },
    )) ?? null;
  const access = resolvePredictionAccess({
    fixture,
    hasResultTrackingStarted: Boolean(result),
    isResultFinal: result?.observations.matchStatus === 'confirmed',
    now: new Date(),
  });

  if (!access.isOpen) {
    throw new Meteor.Error(
      PREDICTION_ACCESS_LOCKED_ERROR,
      'Predictions are locked for this fixture.',
    );
  }

  return {
    fixture,
    ruleset: fixture.rulesetSnapshot,
  };
};

const createPredictionEntry = async (input: {
  readonly fixtureId: string;
  readonly prediction: PredictionEntryDocument['prediction'];
  readonly ruleset: RulesetSnapshot;
  readonly userId: string;
}): Promise<PredictionMutationResult> => {
  const now = new Date();
  const predictionId = Random.id();
  const document: PredictionEntryDocument = {
    _id: predictionId,
    ...currentTestOwnership(),
    createdAt: now,
    fixtureId: input.fixtureId,
    prediction: input.prediction,
    revision: INITIAL_PREDICTION_REVISION,
    ruleset: rulesetIdentity(input.ruleset),
    updatedAt: now,
    userId: input.userId,
  };

  try {
    const result = await rawPredictions().updateOne(
      {
        fixtureId: input.fixtureId,
        userId: input.userId,
      },
      {
        $setOnInsert: document,
      },
      {
        upsert: true,
      },
    );

    if (result.upsertedCount !== 1) {
      throw existingEntryConflictError();
    }
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw existingEntryConflictError();
    }

    throw error;
  }

  return {
    fixtureId: input.fixtureId,
    predictionId,
    revision: INITIAL_PREDICTION_REVISION,
    status: 'created',
  };
};

const updatePredictionEntry = async (input: {
  readonly expectedRevision: number;
  readonly fixtureId: string;
  readonly prediction: PredictionEntryDocument['prediction'];
  readonly ruleset: RulesetSnapshot;
  readonly userId: string;
}): Promise<PredictionMutationResult> => {
  const now = new Date();
  const updatedCount = await Predictions.updateAsync(
    {
      fixtureId: input.fixtureId,
      revision: input.expectedRevision,
      userId: input.userId,
    },
    {
      $inc: {
        revision: 1,
      },
      $set: {
        prediction: input.prediction,
        ruleset: rulesetIdentity(input.ruleset),
        updatedAt: now,
      },
    },
  );

  if (updatedCount === 1) {
    const updated = await Predictions.findOneAsync(
      {
        fixtureId: input.fixtureId,
        userId: input.userId,
      },
      {
        fields: {
          _id: 1,
          revision: 1,
        },
      },
    );

    if (!updated) {
      throw predictionNotFoundError();
    }

    return {
      fixtureId: input.fixtureId,
      predictionId: updated._id,
      revision: updated.revision,
      status: 'updated',
    };
  }

  const existing = await Predictions.findOneAsync(
    {
      fixtureId: input.fixtureId,
      userId: input.userId,
    },
    {
      fields: {
        _id: 1,
        revision: 1,
      },
    },
  );

  if (!existing) {
    throw predictionNotFoundError();
  }

  throw conflictError();
};

const registerPredictionMethods = () => {
  Meteor.methods({
    [PREDICTION_METHODS.submit]: async function submit(
      rawInput: unknown,
    ): Promise<PredictionMutationResult> {
      try {
        const fixtureId = sanitizeFixtureId(
          isRecord(rawInput) ? rawInput.fixtureId : undefined,
        );
        const userId = await requireVerifiedUserId(this);
        const { ruleset } = await loadEligibleFixture(fixtureId);
        const input = sanitizeSubmitPredictionInput(rawInput, ruleset);

        if (input.expectedRevision === undefined) {
          return await createPredictionEntry({
            fixtureId: input.fixtureId,
            prediction: input.prediction,
            ruleset,
            userId,
          });
        }

        return await updatePredictionEntry({
          expectedRevision: input.expectedRevision,
          fixtureId: input.fixtureId,
          prediction: input.prediction,
          ruleset,
          userId,
        });
      } catch (error) {
        throw asMeteorPredictionError(error);
      }
    },
  });
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const registerPredictionPublications = () => {
  Meteor.publish(
    PREDICTION_PUBLICATIONS.fixtureContext,
    async function fixtureContext(fixtureIdInput: unknown) {
      if (!this.userId) {
        return [];
      }

      try {
        await requireVerifiedUser(this);
        const fixtureId = sanitizeFixtureId(fixtureIdInput);

        return [
          Fixtures.find(
            {
              _id: fixtureId,
              visibility: 'published',
            },
            {
              fields: fixturePredictionContextFields,
              limit: 1,
            },
          ),
          MatchResults.find(
            {
              fixtureId,
            },
            {
              fields: fixturePredictionResultContextFields,
              limit: 1,
            },
          ),
        ];
      } catch {
        return [];
      }
    },
  );

  Meteor.publish(
    PREDICTION_PUBLICATIONS.currentUserEntry,
    async function currentUserEntry(fixtureIdInput: unknown) {
      if (!this.userId) {
        return [];
      }

      try {
        await requireVerifiedUser(this);
        const fixtureId = sanitizeFixtureId(fixtureIdInput);

        return Predictions.find(
          {
            fixtureId,
            userId: this.userId,
          },
          {
            fields: predictionEntryFields,
            limit: 1,
          },
        );
      } catch {
        return [];
      }
    },
  );
};

Predictions.deny({
  insert: () => true,
  remove: () => true,
  update: () => true,
});

registerPredictionMethods();
registerPredictionPublications();
await registerPredictionTestMethods();

Meteor.startup(async () => {
  await Promise.all([
    rawPredictions().createIndex(
      {
        userId: 1,
        fixtureId: 1,
      },
      {
        unique: true,
      },
    ),
    rawPredictions().createIndex({
      fixtureId: 1,
      userId: 1,
    }),
    rawPredictions().createIndex({
      'rugbyRoosterTest.ownerRunId': 1,
    }),
  ]);
});
