import { Meteor } from 'meteor/meteor';

import { Fixtures } from '/imports/api/fixtures/collection';
import {
  FIXTURE_METHODS,
  FIXTURE_PUBLICATIONS,
  FixtureValidationError,
  INITIAL_FIXTURE_REVISION,
  sanitizeAdminFixtureListOptions,
  sanitizeCreateDraftInput,
  sanitizeEditDetailsInput,
  sanitizeFixtureId,
  sanitizePublicFixtureListOptions,
  sanitizeStateMutationInput,
  type FixtureDocument,
  type FixtureListCursor,
  type FixtureMutationResult,
} from '/imports/shared/fixtures';
import { ScoringValidationError } from '/imports/shared/scoring';
import { requirePlatformAdmin } from '/imports/server/auth/authorization';
import { getAuthTestRunId } from '/imports/server/auth/settings';
import { createDefaultFixtureRulesetSnapshot } from './ruleset';
import { registerFixtureTestMethods } from './testSupport';

const publicFixtureFields = {
  competitionDisplayName: 1,
  isCancelled: 1,
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

const conflictError = (): Meteor.Error =>
  new Meteor.Error(
    'fixture-conflict',
    'This fixture changed before your update could be saved. Refresh and try again.',
  );

const notFoundError = (): Meteor.Error =>
  new Meteor.Error('fixture-not-found', 'Fixture was not found.');

const readFixtureForStateMessage = async (fixtureId: string) =>
  Fixtures.findOneAsync(fixtureId, {
    fields: {
      isCancelled: 1,
      revision: 1,
      visibility: 1,
    },
  });

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

        const rulesetSnapshot = createDefaultFixtureRulesetSnapshot();
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
  ]);
});
