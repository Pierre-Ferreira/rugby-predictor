import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

import { Fixtures } from '/imports/api/fixtures/collection';
import { MatchResults } from '/imports/api/matchResults/collection';
import { PredictionAccessAudits } from '/imports/api/predictionAccessAudits/collection';
import {
  FIXTURE_METHODS,
  FIXTURE_PUBLICATIONS,
  FixtureValidationError,
  INITIAL_FIXTURE_REVISION,
  sanitizeAdminFixtureListOptions,
  sanitizeCreateDraftInput,
  sanitizeEditDetailsInput,
  sanitizeExpectedRevision,
  sanitizeFixtureId,
  sanitizePublicFixtureListOptions,
  sanitizeStateMutationInput,
  type FixtureDocument,
  type FixtureListCursor,
  type FixtureMutationResult,
} from '/imports/shared/fixtures';
import {
  type PredictionAccessAuditAction,
  type PredictionLockOverride,
} from '/imports/shared/predictionAccess';
import {
  PredictionQuestionConfigValidationError,
  buildConfiguredRulesetSnapshot,
  normalizeFixturePredictionQuestionConfig,
  predictionQuestionConfigForFixture,
  type FixtureQuestionConfigMutationResult,
} from '/imports/shared/predictionQuestions';
import { ScoringValidationError } from '/imports/shared/scoring';
import { requirePlatformAdmin } from '/imports/server/auth/authorization';
import { getAuthTestRunId } from '/imports/server/auth/settings';
import { registerFixtureTestMethods } from './testSupport';

const publicFixtureFields = {
  competitionDisplayName: 1,
  isCancelled: 1,
  predictionLockOverride: 1,
  scheduledKickoffAt: 1,
  team1DisplayName: 1,
  team2DisplayName: 1,
  venueDisplayName: 1,
  visibility: 1,
} as const;

const adminFixtureFields = {
  cancelledAt: 1,
  cancelledByAdminId: 1,
  competitionDisplayName: 1,
  createdAt: 1,
  createdByAdminId: 1,
  isCancelled: 1,
  publishedAt: 1,
  publishedByAdminId: 1,
  predictionQuestionConfig: 1,
  predictionLockOverride: 1,
  revision: 1,
  rulesetSnapshot: 1,
  scheduledKickoffAt: 1,
  team1DisplayName: 1,
  team2DisplayName: 1,
  updatedAt: 1,
  updatedByAdminId: 1,
  venueDisplayName: 1,
  visibility: 1,
} as const;

const asMeteorFixtureError = (error: unknown): Meteor.Error => {
  if (error instanceof FixtureValidationError) {
    return new Meteor.Error(error.code, error.message);
  }

  if (error instanceof PredictionQuestionConfigValidationError) {
    return new Meteor.Error(error.code, error.message);
  }

  if (error instanceof ScoringValidationError) {
    return new Meteor.Error(
      'invalid-fixture-ruleset',
      'The default scoring ruleset is invalid and the fixture cannot be published.',
    );
  }

  if (error instanceof Meteor.Error) {
    return error;
  }

  return new Meteor.Error(
    'fixture-operation-failed',
    'The fixture operation could not be completed.',
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

const currentTestOwnership = () => {
  const ownerRunId = getAuthTestRunId();

  return ownerRunId ? { rugbyRoosterTest: { ownerRunId } } : {};
};

const auditCurrentTestOwnership = () => {
  const ownerRunId = getAuthTestRunId();

  return ownerRunId ? { rugbyRoosterTest: { ownerRunId } } : {};
};

const conflictError = (): Meteor.Error =>
  new Meteor.Error(
    'fixture-conflict',
    'This fixture changed before your update could be saved. Refresh and try again.',
  );

const notFoundError = (): Meteor.Error =>
  new Meteor.Error('fixture-not-found', 'Fixture was not found.');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assertAllowedKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string,
): void => {
  const allowed = new Set(allowedKeys);
  const unknownKeys = Object.keys(value).filter((key) => !allowed.has(key));

  if (unknownKeys.length > 0) {
    throw new FixtureValidationError(
      'unknown-fixture-field',
      `${label} contains unsupported fields: ${unknownKeys.join(', ')}.`,
    );
  }
};

const sanitizeQuestionConfigMutationInput = (input: unknown) => {
  if (!isRecord(input)) {
    throw new FixtureValidationError(
      'invalid-fixture-request',
      'Fixture question configuration input is required.',
    );
  }

  assertAllowedKeys(
    input,
    ['config', 'expectedRevision', 'fixtureId'],
    'Fixture question configuration input',
  );

  return {
    config: normalizeFixturePredictionQuestionConfig(input.config),
    expectedRevision: sanitizeExpectedRevision(input.expectedRevision),
    fixtureId: sanitizeFixtureId(input.fixtureId),
  };
};

const readFixtureForStateMessage = async (fixtureId: string) =>
  Fixtures.findOneAsync(fixtureId, {
    fields: {
      isCancelled: 1,
      revision: 1,
      visibility: 1,
    },
  });

const finalResultExists = async (fixtureId: string): Promise<boolean> =>
  Boolean(
    await MatchResults.findOneAsync(
      {
        fixtureId,
        'observations.matchStatus': 'confirmed',
      },
      {
        fields: {
          _id: 1,
        },
      },
    ),
  );

const recordPredictionAccessAudit = async (input: {
  readonly action: PredictionAccessAuditAction;
  readonly actorAdminUserId: string;
  readonly fixtureId: string;
  readonly fixtureRevisionAfter: number;
  readonly fixtureRevisionBefore: number;
  readonly predictionLockOverrideAfter?: PredictionLockOverride;
  readonly predictionLockOverrideBefore?: PredictionLockOverride;
}) => {
  await PredictionAccessAudits.insertAsync({
    _id: Random.id(),
    ...auditCurrentTestOwnership(),
    action: input.action,
    actorAdminUserId: input.actorAdminUserId,
    createdAt: new Date(),
    fixtureId: input.fixtureId,
    fixtureRevisionAfter: input.fixtureRevisionAfter,
    fixtureRevisionBefore: input.fixtureRevisionBefore,
    ...(input.predictionLockOverrideAfter
      ? {
          predictionLockOverrideAfter: input.predictionLockOverrideAfter,
        }
      : {}),
    ...(input.predictionLockOverrideBefore
      ? {
          predictionLockOverrideBefore: input.predictionLockOverrideBefore,
        }
      : {}),
  });
};

const updatePredictionAccessControl = async (input: {
  readonly action: PredictionAccessAuditAction;
  readonly adminId: string;
  readonly expectedRevision: number;
  readonly fixtureId: string;
  readonly nextOverride?: PredictionLockOverride;
  readonly status: FixtureMutationResult['status'];
}): Promise<FixtureMutationResult> => {
  const current = await Fixtures.findOneAsync(input.fixtureId, {
    fields: {
      isCancelled: 1,
      predictionLockOverride: 1,
      revision: 1,
      visibility: 1,
    },
  });

  if (!current) {
    throw notFoundError();
  }

  if (current.visibility !== 'published') {
    throw new Meteor.Error(
      'fixture-not-published',
      'Draft fixtures do not accept prediction access controls.',
    );
  }

  if (current.isCancelled) {
    throw new Meteor.Error(
      'fixture-cancelled',
      'Cancelled fixtures are read-only in this milestone.',
    );
  }

  if (
    input.action === 'reopened' &&
    (await finalResultExists(input.fixtureId))
  ) {
    throw new Meteor.Error(
      'prediction-access-final',
      'Final results cannot be reopened for prediction editing.',
    );
  }

  if (current.revision !== input.expectedRevision) {
    throw conflictError();
  }

  const nextRevision = input.expectedRevision + 1;
  const now = new Date();
  const modifier =
    input.nextOverride === undefined
      ? {
          $inc: {
            revision: 1,
          },
          $set: {
            updatedAt: now,
            updatedByAdminId: input.adminId,
          },
          $unset: {
            predictionLockOverride: 1 as const,
          },
        }
      : {
          $inc: {
            revision: 1,
          },
          $set: {
            predictionLockOverride: input.nextOverride,
            updatedAt: now,
            updatedByAdminId: input.adminId,
          },
        };

  const updatedCount = await Fixtures.updateAsync(
    {
      _id: input.fixtureId,
      isCancelled: false,
      revision: input.expectedRevision,
      visibility: 'published',
    },
    modifier,
  );

  if (updatedCount !== 1) {
    const after = await readFixtureForStateMessage(input.fixtureId);

    if (!after) {
      throw notFoundError();
    }

    if (after.isCancelled) {
      throw new Meteor.Error(
        'fixture-cancelled',
        'Cancelled fixtures are read-only in this milestone.',
      );
    }

    if (after.visibility !== 'published') {
      throw new Meteor.Error(
        'fixture-not-published',
        'Draft fixtures do not accept prediction access controls.',
      );
    }

    throw conflictError();
  }

  await recordPredictionAccessAudit({
    action: input.action,
    actorAdminUserId: input.adminId,
    fixtureId: input.fixtureId,
    fixtureRevisionAfter: nextRevision,
    fixtureRevisionBefore: input.expectedRevision,
    predictionLockOverrideAfter: input.nextOverride,
    predictionLockOverrideBefore: current.predictionLockOverride,
  });

  return {
    fixtureId: input.fixtureId,
    revision: nextRevision,
    status: input.status,
  };
};

const extraPageRowLimit = (limit: number): number => limit + 1;

const cursorCondition = (
  cursor: FixtureListCursor | undefined,
  direction: 'ascending' | 'descending',
): Record<string, unknown> | null => {
  if (!cursor) {
    return null;
  }

  if (direction === 'ascending') {
    return {
      $or: [
        {
          scheduledKickoffAt: {
            $gt: cursor.scheduledKickoffAt,
          },
        },
        {
          _id: {
            $gt: cursor.fixtureId,
          },
          scheduledKickoffAt: cursor.scheduledKickoffAt,
        },
      ],
    };
  }

  return {
    $or: [
      {
        scheduledKickoffAt: {
          $lt: cursor.scheduledKickoffAt,
        },
      },
      {
        _id: {
          $gt: cursor.fixtureId,
        },
        scheduledKickoffAt: cursor.scheduledKickoffAt,
      },
    ],
  };
};

const combineConditions = (
  conditions: readonly (Record<string, unknown> | null)[],
): Record<string, unknown> => {
  const activeConditions = conditions.filter(
    (condition): condition is Record<string, unknown> => Boolean(condition),
  );

  if (activeConditions.length === 1) {
    return activeConditions[0];
  }

  if (activeConditions.length === 0) {
    return {};
  }

  return {
    $and: activeConditions,
  };
};

export const backfillFixtureRevisions = async (): Promise<number> => {
  const result = await Fixtures.rawCollection().updateMany(
    {
      revision: {
        $exists: false,
      },
    },
    {
      $set: {
        revision: INITIAL_FIXTURE_REVISION,
      },
    },
  );

  return result.modifiedCount;
};

const registerFixtureMethods = () => {
  Meteor.methods({
    [FIXTURE_METHODS.createDraft]: async function createDraft(
      input: unknown,
    ): Promise<FixtureMutationResult> {
      try {
        const adminId = await requireAdminId(this);
        const details = sanitizeCreateDraftInput(input);
        const now = new Date();
        const fixtureId = await Fixtures.insertAsync({
          ...details,
          ...currentTestOwnership(),
          createdAt: now,
          createdByAdminId: adminId,
          isCancelled: false,
          revision: INITIAL_FIXTURE_REVISION,
          updatedAt: now,
          updatedByAdminId: adminId,
          visibility: 'draft',
        } as FixtureDocument);

        return {
          fixtureId,
          status: 'created',
        };
      } catch (error) {
        throw asMeteorFixtureError(error);
      }
    },

    [FIXTURE_METHODS.editDetails]: async function editDetails(
      input: unknown,
    ): Promise<FixtureMutationResult> {
      try {
        const adminId = await requireAdminId(this);
        const { details, expectedRevision, fixtureId } =
          sanitizeEditDetailsInput(input);
        const now = new Date();
        const modifier = details.venueDisplayName
          ? {
              $inc: {
                revision: 1,
              },
              $set: {
                ...details,
                updatedAt: now,
                updatedByAdminId: adminId,
              },
            }
          : {
              $inc: {
                revision: 1,
              },
              $set: {
                ...details,
                updatedAt: now,
                updatedByAdminId: adminId,
              },
              $unset: {
                venueDisplayName: 1 as const,
              },
            };
        const updatedCount = await Fixtures.updateAsync(
          {
            _id: fixtureId,
            isCancelled: false,
            revision: expectedRevision,
          },
          modifier,
        );

        if (updatedCount === 1) {
          return {
            fixtureId,
            status: 'updated',
          };
        }

        const current = await readFixtureForStateMessage(fixtureId);

        if (!current) {
          throw notFoundError();
        }

        if (current.isCancelled) {
          throw new Meteor.Error(
            'fixture-cancelled',
            'Cancelled fixtures are read-only in this milestone.',
          );
        }

        throw conflictError();
      } catch (error) {
        throw asMeteorFixtureError(error);
      }
    },

    [FIXTURE_METHODS.saveQuestionConfig]: async function saveQuestionConfig(
      input: unknown,
    ): Promise<FixtureQuestionConfigMutationResult> {
      try {
        const adminId = await requireAdminId(this);
        const { config, expectedRevision, fixtureId } =
          sanitizeQuestionConfigMutationInput(input);
        const now = new Date();
        const updatedCount = await Fixtures.updateAsync(
          {
            _id: fixtureId,
            isCancelled: false,
            revision: expectedRevision,
            visibility: 'draft',
          },
          {
            $inc: {
              revision: 1,
            },
            $set: {
              predictionQuestionConfig: config,
              updatedAt: now,
              updatedByAdminId: adminId,
            },
          },
        );

        if (updatedCount === 1) {
          return {
            fixtureId,
            revision: expectedRevision + 1,
            status: 'updated',
          };
        }

        const current = await readFixtureForStateMessage(fixtureId);

        if (!current) {
          throw notFoundError();
        }

        if (current.isCancelled) {
          throw new Meteor.Error(
            'fixture-cancelled',
            'Cancelled fixtures are read-only in this milestone.',
          );
        }

        if (current.visibility === 'published') {
          throw new Meteor.Error(
            'fixture-published',
            'Published fixture question configuration is read-only.',
          );
        }

        throw conflictError();
      } catch (error) {
        throw asMeteorFixtureError(error);
      }
    },

    [FIXTURE_METHODS.publish]: async function publish(
      input: unknown,
    ): Promise<FixtureMutationResult> {
      try {
        const adminId = await requireAdminId(this);
        const { expectedRevision, fixtureId } =
          sanitizeStateMutationInput(input);
        const current = await Fixtures.findOneAsync(fixtureId, {
          fields: {
            isCancelled: 1,
            predictionQuestionConfig: 1,
            revision: 1,
            rulesetSnapshot: 1,
            visibility: 1,
          },
        });

        if (!current) {
          throw notFoundError();
        }

        if (current.visibility === 'published') {
          return {
            fixtureId,
            status: 'already-published',
          };
        }

        if (current.isCancelled) {
          throw new Meteor.Error(
            'fixture-cancelled',
            'Cancelled drafts cannot be published.',
          );
        }

        if (current.revision !== expectedRevision) {
          throw conflictError();
        }

        const questionConfig = predictionQuestionConfigForFixture(current);

        const rulesetSnapshot = buildConfiguredRulesetSnapshot(questionConfig);
        const now = new Date();
        const updatedCount = await Fixtures.updateAsync(
          {
            _id: fixtureId,
            isCancelled: false,
            revision: expectedRevision,
            visibility: 'draft',
          },
          {
            $inc: {
              revision: 1,
            },
            $set: {
              publishedAt: now,
              publishedByAdminId: adminId,
              rulesetSnapshot,
              updatedAt: now,
              updatedByAdminId: adminId,
              visibility: 'published',
            },
          },
        );

        if (updatedCount === 1) {
          return {
            fixtureId,
            status: 'published',
          };
        }

        const after = await readFixtureForStateMessage(fixtureId);

        if (!after) {
          throw notFoundError();
        }

        if (after.visibility === 'published') {
          return {
            fixtureId,
            status: 'already-published',
          };
        }

        if (after.isCancelled) {
          throw new Meteor.Error(
            'fixture-cancelled',
            'Cancelled drafts cannot be published.',
          );
        }

        throw conflictError();
      } catch (error) {
        throw asMeteorFixtureError(error);
      }
    },

    [FIXTURE_METHODS.lockPredictions]: async function lockPredictions(
      input: unknown,
    ): Promise<FixtureMutationResult> {
      try {
        const adminId = await requireAdminId(this);
        const { expectedRevision, fixtureId } =
          sanitizeStateMutationInput(input);

        return await updatePredictionAccessControl({
          action: 'locked',
          adminId,
          expectedRevision,
          fixtureId,
          nextOverride: 'locked',
          status: 'prediction-access-locked',
        });
      } catch (error) {
        throw asMeteorFixtureError(error);
      }
    },

    [FIXTURE_METHODS.reopenPredictions]: async function reopenPredictions(
      input: unknown,
    ): Promise<FixtureMutationResult> {
      try {
        const adminId = await requireAdminId(this);
        const { expectedRevision, fixtureId } =
          sanitizeStateMutationInput(input);

        return await updatePredictionAccessControl({
          action: 'reopened',
          adminId,
          expectedRevision,
          fixtureId,
          nextOverride: 'open',
          status: 'prediction-access-reopened',
        });
      } catch (error) {
        throw asMeteorFixtureError(error);
      }
    },

    [FIXTURE_METHODS.resetPredictionAccess]:
      async function resetPredictionAccess(
        input: unknown,
      ): Promise<FixtureMutationResult> {
        try {
          const adminId = await requireAdminId(this);
          const { expectedRevision, fixtureId } =
            sanitizeStateMutationInput(input);

          return await updatePredictionAccessControl({
            action: 'reset-to-automatic',
            adminId,
            expectedRevision,
            fixtureId,
            status: 'prediction-access-automatic',
          });
        } catch (error) {
          throw asMeteorFixtureError(error);
        }
      },

    [FIXTURE_METHODS.cancel]: async function cancel(
      input: unknown,
    ): Promise<FixtureMutationResult> {
      try {
        const adminId = await requireAdminId(this);
        const { expectedRevision, fixtureId } =
          sanitizeStateMutationInput(input);
        const current = await readFixtureForStateMessage(fixtureId);

        if (!current) {
          throw notFoundError();
        }

        if (current.isCancelled) {
          return {
            fixtureId,
            status: 'already-cancelled',
          };
        }

        if (current.revision !== expectedRevision) {
          throw conflictError();
        }

        const now = new Date();
        const updatedCount = await Fixtures.updateAsync(
          {
            _id: fixtureId,
            isCancelled: false,
            revision: expectedRevision,
          },
          {
            $inc: {
              revision: 1,
            },
            $set: {
              cancelledAt: now,
              cancelledByAdminId: adminId,
              isCancelled: true,
              updatedAt: now,
              updatedByAdminId: adminId,
            },
          },
        );

        if (updatedCount === 1) {
          return {
            fixtureId,
            status: 'cancelled',
          };
        }

        const after = await readFixtureForStateMessage(fixtureId);

        if (!after) {
          throw notFoundError();
        }

        if (after.isCancelled) {
          return {
            fixtureId,
            status: 'already-cancelled',
          };
        }

        throw conflictError();
      } catch (error) {
        throw asMeteorFixtureError(error);
      }
    },
  });
};

const registerFixturePublications = () => {
  Meteor.publish(
    FIXTURE_PUBLICATIONS.adminList,
    async function adminList(input: unknown) {
      await requirePlatformAdmin(this);
      const options = sanitizeAdminFixtureListOptions(input);
      const selector = combineConditions([
        cursorCondition(options.cursor, 'descending'),
      ]);

      return Fixtures.find(selector, {
        fields: adminFixtureFields,
        limit: extraPageRowLimit(options.limit),
        sort: {
          scheduledKickoffAt: -1,
          _id: 1,
        },
      });
    },
  );

  Meteor.publish(
    FIXTURE_PUBLICATIONS.publicList,
    function publicList(input: unknown) {
      const options = sanitizePublicFixtureListOptions(input);
      const scheduledKickoffAt =
        options.mode === 'upcoming'
          ? { $gte: options.boundary }
          : { $lt: options.boundary };
      const sortDirection =
        options.mode === 'upcoming' ? 'ascending' : 'descending';
      const selector = combineConditions([
        {
          scheduledKickoffAt,
          visibility: 'published',
        },
        cursorCondition(options.cursor, sortDirection),
      ]);

      return Fixtures.find(selector, {
        fields: publicFixtureFields,
        limit: extraPageRowLimit(options.limit),
        sort:
          options.mode === 'upcoming'
            ? {
                scheduledKickoffAt: 1,
                _id: 1,
              }
            : {
                scheduledKickoffAt: -1,
                _id: 1,
              },
      });
    },
  );

  Meteor.publish(
    FIXTURE_PUBLICATIONS.publicDetail,
    function publicDetail(fixtureIdInput: unknown) {
      let fixtureId: string;

      try {
        fixtureId = sanitizeFixtureId(fixtureIdInput);
      } catch {
        return [];
      }

      return Fixtures.find(
        {
          _id: fixtureId,
          visibility: 'published',
        },
        {
          fields: publicFixtureFields,
          limit: 1,
        },
      );
    },
  );
};

Fixtures.deny({
  insert: () => true,
  remove: () => true,
  update: () => true,
});

PredictionAccessAudits.deny({
  insert: () => true,
  remove: () => true,
  update: () => true,
});

await backfillFixtureRevisions();
registerFixtureMethods();
registerFixturePublications();
await registerFixtureTestMethods();

Meteor.startup(async () => {
  await Promise.all([
    Fixtures.rawCollection().createIndex({
      visibility: 1,
      scheduledKickoffAt: 1,
      _id: 1,
    }),
    Fixtures.rawCollection().createIndex({
      scheduledKickoffAt: -1,
      _id: 1,
      visibility: 1,
    }),
    Fixtures.rawCollection().createIndex({
      updatedAt: -1,
      _id: 1,
    }),
    Fixtures.rawCollection().createIndex({
      'rugbyRoosterTest.ownerRunId': 1,
    }),
    PredictionAccessAudits.rawCollection().createIndex({
      fixtureId: 1,
      createdAt: 1,
    }),
    PredictionAccessAudits.rawCollection().createIndex({
      'rugbyRoosterTest.ownerRunId': 1,
    }),
  ]);
});
