import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

import { PlayerProfiles } from '/imports/api/playerProfiles/collection';
import {
  PLAYER_PROFILE_METHODS,
  PlayerProfileValidationError,
  sanitizeUpdateMyPlayerProfileInput,
  type PlayerProfileDocument,
  type PublicPlayerIdentity,
} from '/imports/shared/playerProfiles';
import { requireVerifiedUser } from '/imports/server/auth/authorization';
import { getAuthTestRunId } from '/imports/server/auth/settings';
import { registerPlayerProfileTestMethods } from './testSupport';

interface RawPlayerProfileCollection {
  createIndex: (
    keys: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<string>;
  updateOne: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => Promise<{
    readonly matchedCount: number;
    readonly modifiedCount: number;
    readonly upsertedCount: number;
  }>;
}

const rawPlayerProfiles = (): RawPlayerProfileCollection =>
  PlayerProfiles.rawCollection() as unknown as RawPlayerProfileCollection;

const currentTestOwnership = () => {
  const ownerRunId = getAuthTestRunId();

  return ownerRunId ? { rugbyRoosterTest: { ownerRunId } } : {};
};

const requireVerifiedUserId = async (
  invocation: Pick<Meteor.MethodThisType, 'userId'>,
): Promise<string> => {
  await requireVerifiedUser(invocation);

  if (!invocation.userId) {
    throw new Meteor.Error('not-authenticated', 'Sign in to continue.');
  }

  return invocation.userId;
};

const asMeteorPlayerProfileError = (error: unknown): Meteor.Error => {
  if (error instanceof PlayerProfileValidationError) {
    return new Meteor.Error(error.code, error.message);
  }

  if (error instanceof Meteor.Error) {
    return error;
  }

  return new Meteor.Error(
    'player-profile-operation-failed',
    'The player profile operation could not be completed.',
  );
};

const publicIdentityFields = {
  displayName: 1,
} as const;

const publicIdentityFromProfile = (
  profile: Pick<PlayerProfileDocument, 'displayName'> | null | undefined,
): PublicPlayerIdentity => ({
  displayName: profile?.displayName ?? null,
});

Meteor.methods({
  [PLAYER_PROFILE_METHODS.getMine]:
    async function getMine(): Promise<PublicPlayerIdentity> {
      try {
        const userId = await requireVerifiedUserId(this);
        const profile = await PlayerProfiles.findOneAsync(
          {
            userId,
          },
          {
            fields: publicIdentityFields,
          },
        );

        return publicIdentityFromProfile(profile);
      } catch (error) {
        throw asMeteorPlayerProfileError(error);
      }
    },

  [PLAYER_PROFILE_METHODS.updateMine]: async function updateMine(
    rawInput: unknown,
  ): Promise<PublicPlayerIdentity> {
    try {
      const userId = await requireVerifiedUserId(this);
      const input = sanitizeUpdateMyPlayerProfileInput(rawInput);
      const now = new Date();

      await rawPlayerProfiles().updateOne(
        {
          userId,
        },
        {
          $set: {
            displayName: input.displayName,
            updatedAt: now,
          },
          $setOnInsert: {
            _id: Random.id(),
            ...currentTestOwnership(),
            createdAt: now,
            userId,
          },
        },
        {
          upsert: true,
        },
      );

      return {
        displayName: input.displayName,
      };
    } catch (error) {
      throw asMeteorPlayerProfileError(error);
    }
  },
});

PlayerProfiles.deny({
  insert: () => true,
  remove: () => true,
  update: () => true,
});

await registerPlayerProfileTestMethods();

Meteor.startup(async () => {
  await Promise.all([
    rawPlayerProfiles().createIndex(
      {
        userId: 1,
      },
      {
        unique: true,
      },
    ),
    rawPlayerProfiles().createIndex({
      'rugbyRoosterTest.ownerRunId': 1,
    }),
  ]);
});
