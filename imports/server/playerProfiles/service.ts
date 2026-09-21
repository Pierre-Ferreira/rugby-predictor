import { PlayerProfiles } from '/imports/api/playerProfiles/collection';
import type { PublicPlayerIdentity } from '/imports/shared/playerProfiles';

const publicProfileFields = {
  displayName: 1,
  userId: 1,
} as const;

export const resolvePublicPlayerIdentities = async (
  userIds: readonly string[],
): Promise<ReadonlyMap<string, PublicPlayerIdentity>> => {
  const uniqueUserIds = Array.from(
    new Set(
      userIds.filter((userId): userId is string => typeof userId === 'string'),
    ),
  );
  const identities = new Map<string, PublicPlayerIdentity>();

  for (const userId of uniqueUserIds) {
    identities.set(userId, {
      displayName: null,
    });
  }

  if (uniqueUserIds.length === 0) {
    return identities;
  }

  const profiles = await PlayerProfiles.find(
    {
      userId: {
        $in: uniqueUserIds,
      },
    },
    {
      fields: publicProfileFields,
      limit: uniqueUserIds.length,
    },
  ).fetchAsync();

  for (const profile of profiles) {
    identities.set(profile.userId, {
      displayName: profile.displayName,
    });
  }

  return identities;
};
