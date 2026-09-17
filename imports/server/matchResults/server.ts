import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

import { Fixtures } from '/imports/api/fixtures/collection';
import { MatchResults } from '/imports/api/matchResults/collection';
import {
  FixtureValidationError,
  sanitizeFixtureId,
} from '/imports/shared/fixtures';
import {
  INITIAL_MATCH_RESULT_REVISION,
  MATCH_RESULT_METHODS,
  MATCH_RESULT_PUBLICATIONS,
  MatchResultValidationError,
  assertExpectedFirstResultRevision,
  assertExistingResultRevision,
  normalizeResultObservations,
  rulesetIdentity,
  sanitizeResultMutationInput,
  sanitizeResultSummaryFixtureIds,
  type MatchResultDocument,
  type MatchResultMutationResult,
} from '/imports/shared/matchResults';
import {
  ScoringValidationError,
  validateRuleset,
  type FixtureObservations,
  type RulesetSnapshot,
} from '/imports/shared/scoring';
import { requirePlatformAdmin } from '/imports/server/auth/authorization';
import { getAuthTestRunId } from '/imports/server/auth/settings';
import { registerMatchResultTestMethods } from './testSupport';

interface RawMatchResultCollection {
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

const rawMatchResults = (): RawMatchResultCollection =>
  MatchResults.rawCollection() as unknown as RawMatchResultCollection;

const resultDetailFields = {
  confirmedAt: 1,
  confirmedByAdminId: 1,
  createdAt: 1,
  createdByAdminId: 1,
  fixtureId: 1,
  observations: 1,
  revision: 1,
  ruleset: 1,
  updatedAt: 1,
  updatedByAdminId: 1,
} as const;

const resultSummaryFields = {
  confirmedAt: 1,
  fixtureId: 1,
  observations: 1,
  revision: 1,
} as const;

const fixtureContextFields = {
  competitionDisplayName: 1,
  isCancelled: 1,
  predictionQuestionConfig: 1,
  revision: 1,
  rulesetSnapshot: 1,
  scheduledKickoffAt: 1,
  team1DisplayName: 1,
  team2DisplayName: 1,
  venueDisplayName: 1,
  visibility: 1,
} as const;

const currentTestOwnership = () => {
  const ownerRunId = getAuthTestRunId();

  return ownerRunId ? { rugbyRoosterTest: { ownerRunId } } : {};
};

const asMeteorResultError = (error: unknown): Meteor.Error => {
  if (error instanceof MatchResultValidationError) {
    return new Meteor.Error(error.code, error.message);
  }

  if (error instanceof FixtureValidationError) {
    return new Meteor.Error(error.code, error.message);
  }

  if (error instanceof ScoringValidationError) {
    const firstIssue = error.issues[0];

    return new Meteor.Error(
      'invalid-result-observations',
      firstIssue?.message ?? 'Result observations are invalid.',
    );
  }

  if (error instanceof Meteor.Error) {
    return error;
  }

  return new Meteor.Error(
    'result-operation-failed',
    'The result operation could not be completed.',
  );
};

const requireAdminId = async (
  invocation: Pick<Meteor.MethodThisType, 'userId'>,
): Promise<string> => {
  await requirePlatformAdmin(invocation);

  if (!invocation.userId) {
    throw new Meteor.Error('not-authenticated', 'Sign in to continue.');
  }

  return invocation.userId;
};

const conflictError = (): Meteor.Error =>
  new Meteor.Error(
    'result-conflict',
    'This result changed before your update could be saved. Reload the latest result if you want to replace your form values.',
  );

const notFoundError = (): Meteor.Error =>
  new Meteor.Error('fixture-not-found', 'Fixture was not found.');

const resultNotFoundError = (): Meteor.Error =>
  new Meteor.Error('result-not-found', 'Save a provisional result first.');

const resultFinalError = (): Meteor.Error =>
  new Meteor.Error(
    'result-final',
    'Final results are read-only in this milestone.',
  );

const rulesetUnavailableError = (): Meteor.Error =>
  new Meteor.Error(
    'fixture-ruleset-unavailable',
    "This fixture's published prediction rules are unavailable.",
  );

const isDuplicateKeyError = (error: unknown): boolean =>
  Boolean(
    error &&
    typeof error === 'object' &&
    (error as { readonly code?: unknown }).code === 11000,
  );

const loadEligibleFixture = async (fixtureId: string) => {
  const fixture = await Fixtures.findOneAsync(fixtureId, {
    fields: {
      isCancelled: 1,
      rulesetSnapshot: 1,
      visibility: 1,
    },
  });

  if (!fixture) {
    throw notFoundError();
  }

  if (fixture.visibility !== 'published') {
    throw new Meteor.Error(
      'fixture-not-published',
      'Draft fixtures do not accept official result administration.',
    );
  }

  if (fixture.isCancelled) {
    throw new Meteor.Error(
      'fixture-cancelled',
      'Cancelled fixtures are read-only in this milestone.',
    );
  }

  if (!fixture.rulesetSnapshot) {
    throw rulesetUnavailableError();
  }

  const rulesetValidation = validateRuleset(fixture.rulesetSnapshot);

  if (!rulesetValidation.valid) {
    throw rulesetUnavailableError();
  }

  return {
    fixture,
    ruleset: fixture.rulesetSnapshot as RulesetSnapshot,
  };
};

const createResultEntry = async (input: {
  readonly adminId: string;
  readonly fixtureId: string;
  readonly observations: FixtureObservations;
  readonly ruleset: RulesetSnapshot;
}): Promise<MatchResultMutationResult> => {
  const now = new Date();
  const resultId = Random.id();
  const document: MatchResultDocument = {
    _id: resultId,
    ...currentTestOwnership(),
    createdAt: now,
    createdByAdminId: input.adminId,
    fixtureId: input.fixtureId,
    observations: input.observations,
    revision: INITIAL_MATCH_RESULT_REVISION,
    ruleset: rulesetIdentity(input.ruleset),
    updatedAt: now,
    updatedByAdminId: input.adminId,
  };

  try {
    const result = await rawMatchResults().updateOne(
      {
        fixtureId: input.fixtureId,
      },
      {
        $setOnInsert: document,
      },
      {
        upsert: true,
      },
    );

    if (result.upsertedCount !== 1) {
      throw conflictError();
    }
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw conflictError();
    }

    throw error;
  }

  return {
    fixtureId: input.fixtureId,
    resultId,
    revision: INITIAL_MATCH_RESULT_REVISION,
    status: 'created',
  };
};

const updateResultEntry = async (input: {
  readonly adminId: string;
  readonly expectedRevision: number;
  readonly fixtureId: string;
  readonly observations: FixtureObservations;
  readonly status: 'updated' | 'confirmed';
}): Promise<MatchResultMutationResult> => {
  const now = new Date();
  const updatedCount = await MatchResults.updateAsync(
    {
      fixtureId: input.fixtureId,
      'observations.matchStatus': 'provisional',
      revision: input.expectedRevision,
    },
    {
      $inc: {
        revision: 1,
      },
      $set: {
        ...(input.status === 'confirmed'
          ? {
              confirmedAt: now,
              confirmedByAdminId: input.adminId,
            }
          : {}),
        observations: input.observations,
        updatedAt: now,
        updatedByAdminId: input.adminId,
      },
    },
  );

  if (updatedCount === 1) {
    const updated = await MatchResults.findOneAsync(
      {
        fixtureId: input.fixtureId,
      },
      {
        fields: {
          _id: 1,
          revision: 1,
        },
      },
    );

    if (!updated) {
      throw resultNotFoundError();
    }

    return {
      fixtureId: input.fixtureId,
      resultId: updated._id,
      revision: updated.revision,
      status: input.status,
    };
  }

  const current = await MatchResults.findOneAsync(
    {
      fixtureId: input.fixtureId,
    },
    {
      fields: {
        observations: 1,
        revision: 1,
      },
    },
  );

  if (!current) {
    throw resultNotFoundError();
  }

  if (current.observations.matchStatus === 'confirmed') {
    throw resultFinalError();
  }

  throw conflictError();
};

const registerResultMethods = () => {
  Meteor.methods({
    [MATCH_RESULT_METHODS.saveProvisional]: async function saveProvisional(
      rawInput: unknown,
    ): Promise<MatchResultMutationResult> {
      try {
        const adminId = await requireAdminId(this);
        const input = sanitizeResultMutationInput(rawInput);
        const { ruleset } = await loadEligibleFixture(input.fixtureId);
        const observations = normalizeResultObservations(
          input.observations,
          ruleset,
          'provisional',
        );

        if (input.expectedRevision === 0) {
          assertExpectedFirstResultRevision(input.expectedRevision);

          return await createResultEntry({
            adminId,
            fixtureId: input.fixtureId,
            observations,
            ruleset,
          });
        }

        return await updateResultEntry({
          adminId,
          expectedRevision: input.expectedRevision,
          fixtureId: input.fixtureId,
          observations,
          status: 'updated',
        });
      } catch (error) {
        throw asMeteorResultError(error);
      }
    },

    [MATCH_RESULT_METHODS.confirmFinal]: async function confirmFinal(
      rawInput: unknown,
    ): Promise<MatchResultMutationResult> {
      try {
        const adminId = await requireAdminId(this);
        const input = sanitizeResultMutationInput(rawInput);
        assertExistingResultRevision(input.expectedRevision);
        const { ruleset } = await loadEligibleFixture(input.fixtureId);
        const observations = normalizeResultObservations(
          input.observations,
          ruleset,
          'final',
        );

        return await updateResultEntry({
          adminId,
          expectedRevision: input.expectedRevision,
          fixtureId: input.fixtureId,
          observations,
          status: 'confirmed',
        });
      } catch (error) {
        throw asMeteorResultError(error);
      }
    },
  });
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizeSummaryInput = (input: unknown): readonly string[] => {
  if (input === undefined || input === null) {
    return [];
  }

  if (!isRecord(input)) {
    throw new MatchResultValidationError(
      'invalid-result-summary-request',
      'Result summary input must be an object.',
    );
  }

  const unknownKeys = Object.keys(input).filter((key) => key !== 'fixtureIds');

  if (unknownKeys.length > 0) {
    throw new MatchResultValidationError(
      'invalid-result-summary-request',
      `Result summary input contains unsupported fields: ${unknownKeys.join(
        ', ',
      )}.`,
    );
  }

  return sanitizeResultSummaryFixtureIds(input.fixtureIds);
};

const registerResultPublications = () => {
  Meteor.publish(
    MATCH_RESULT_PUBLICATIONS.adminFixtureContext,
    async function adminFixtureContext(fixtureIdInput: unknown) {
      if (!this.userId) {
        return [];
      }

      try {
        await requirePlatformAdmin(this);
        const fixtureId = sanitizeFixtureId(fixtureIdInput);

        return [
          Fixtures.find(
            {
              _id: fixtureId,
            },
            {
              fields: fixtureContextFields,
              limit: 1,
            },
          ),
          MatchResults.find(
            {
              fixtureId,
            },
            {
              fields: resultDetailFields,
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
    MATCH_RESULT_PUBLICATIONS.adminSummaries,
    async function adminSummaries(input: unknown) {
      if (!this.userId) {
        return [];
      }

      try {
        await requirePlatformAdmin(this);
        const fixtureIds = sanitizeSummaryInput(input);

        if (fixtureIds.length === 0) {
          return [];
        }

        return MatchResults.find(
          {
            fixtureId: {
              $in: [...fixtureIds],
            },
          },
          {
            fields: resultSummaryFields,
            limit: fixtureIds.length,
          },
        );
      } catch {
        return [];
      }
    },
  );
};

MatchResults.deny({
  insert: () => true,
  remove: () => true,
  update: () => true,
});

registerResultMethods();
registerResultPublications();
await registerMatchResultTestMethods();

Meteor.startup(async () => {
  await Promise.all([
    rawMatchResults().createIndex(
      {
        fixtureId: 1,
      },
      {
        unique: true,
      },
    ),
    rawMatchResults().createIndex({
      'rugbyRoosterTest.ownerRunId': 1,
    }),
  ]);
});
