import { describe, expect, it } from 'vitest';

import {
  fixtureLeaderboardPlayerIdentity,
  fixtureScopedLeaderboardRowId,
  fixtureScopedPlayerAlias,
} from '../../imports/shared/fixtureLeaderboards/privacy';

describe('fixture leaderboard privacy labels', () => {
  it('creates deterministic fixture-scoped aliases without exposing raw user IDs', () => {
    const aliasA = fixtureScopedPlayerAlias('fixture-a', 'raw-user-id-123');
    const aliasB = fixtureScopedPlayerAlias('fixture-a', 'raw-user-id-123');

    expect(aliasA).toBe(aliasB);
    expect(aliasA).toMatch(/^Rooster [A-F0-9]{8}$/);
    expect(aliasA).not.toContain('raw-user-id-123');
  });

  it('uses a different fallback alias for the same user across fixtures', () => {
    expect(fixtureScopedPlayerAlias('fixture-a', 'user-1')).not.toBe(
      fixtureScopedPlayerAlias('fixture-b', 'user-1'),
    );
  });

  it('does not fall back to email addresses for visible labels', () => {
    const identity = fixtureLeaderboardPlayerIdentity({
      fixtureId: 'fixture-a',
      player: {
        email: 'private@example.test',
        userId: 'user-with-email',
      },
    });

    expect(identity.displayLabel).toMatch(/^Rooster [A-F0-9]{8}$/);
    expect(identity.displayLabel).not.toContain('private@example.test');
    expect(identity.displayLabel).not.toContain('user-with-email');
  });

  it('uses You for the current player while keeping an opaque row id', () => {
    const identity = fixtureLeaderboardPlayerIdentity({
      currentUserId: 'current-user-id',
      fixtureId: 'fixture-a',
      player: {
        userId: 'current-user-id',
      },
    });

    expect(identity.displayLabel).toBe('You');
    expect(identity.rowId).toBe(
      fixtureScopedLeaderboardRowId('fixture-a', 'current-user-id'),
    );
    expect(identity.rowId).not.toContain('current-user-id');
  });
});
