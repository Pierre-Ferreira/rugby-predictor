import { createHash } from 'node:crypto';

import type { PublicPlayerIdentity } from '/imports/shared/playerProfiles';
import type { FixtureLeaderboardPlayerIdentity } from './types';

const DISPLAY_DIGEST_LENGTH = 8;

interface PlayerLabelSource {
  readonly userId: string;
  readonly publicIdentity?: PublicPlayerIdentity | null;
}

export const fixtureScopedPlayerDigest = (
  fixtureId: string,
  userId: string,
): string =>
  createHash('sha256')
    .update(`${fixtureId}:${userId}`)
    .digest('hex')
    .toUpperCase();

export const fixtureScopedLeaderboardRowId = (
  fixtureId: string,
  userId: string,
): string =>
  `rrlb_${fixtureScopedPlayerDigest(fixtureId, userId).toLowerCase()}`;

export const fixtureScopedPlayerAlias = (
  fixtureId: string,
  userId: string,
): string =>
  `Rooster ${fixtureScopedPlayerDigest(fixtureId, userId).slice(
    0,
    DISPLAY_DIGEST_LENGTH,
  )}`;

export const fixtureLeaderboardPlayerIdentity = ({
  fixtureId,
  currentUserId,
  player,
}: {
  readonly fixtureId: string;
  readonly currentUserId?: string | null;
  readonly player: PlayerLabelSource;
}): FixtureLeaderboardPlayerIdentity => {
  const publicDisplayName = player.publicIdentity?.displayName ?? null;

  return {
    displayLabel:
      player.userId === currentUserId
        ? 'You'
        : (publicDisplayName ??
          fixtureScopedPlayerAlias(fixtureId, player.userId)),
    rowId: fixtureScopedLeaderboardRowId(fixtureId, player.userId),
    userId: player.userId,
  };
};

export const fixtureLeaderboardPlayerIdentities = ({
  currentUserId,
  fixtureId,
  players,
}: {
  readonly currentUserId?: string | null;
  readonly fixtureId: string;
  readonly players: readonly PlayerLabelSource[];
}): readonly FixtureLeaderboardPlayerIdentity[] =>
  players.map((player) =>
    fixtureLeaderboardPlayerIdentity({
      currentUserId,
      fixtureId,
      player,
    }),
  );
