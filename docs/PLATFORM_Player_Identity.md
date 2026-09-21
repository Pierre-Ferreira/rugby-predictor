# Rugby Rooster Player Identity Platform

CCPP-012A adds one owner-editable public display name for verified Rugby
Rooster players. It is a small identity primitive for competitive presentation,
not a profile/social system.

## Purpose

The public display name may be shown to other Rugby Rooster players in fixture
leaderboards and future competitive views. Email remains private and is never a
fallback public identity.

Players are not forced to choose a display name. A verified player without one
can still sign in, predict, score, appear on the fixture leaderboard, and view
their own score breakdown.

## Persistence

Player display names live in the server-owned `player_profiles` collection:

```ts
{
  (userId, displayName, createdAt, updatedAt);
}
```

There is exactly one profile per user through a unique `userId` index. The
collection does not store email addresses and does not store fixture-scoped
leaderboard aliases.

Direct client insert, update, and remove are denied. Profile changes go through
server methods only.

## Methods

Shared method names live in `imports/shared/playerProfiles/methods.ts`.

- `playerProfiles.getMine` requires a verified signed-in player and returns the
  caller's safe public identity projection.
- `playerProfiles.updateMine` requires a verified signed-in player, accepts only
  `displayName`, validates server-side, and upserts the caller's own profile.

The update method never accepts `userId`, email, roles, service data, auth
metadata, or arbitrary extra fields. There is no admin profile-editing method
in CCPP-012A.

## Public Projection

Client-facing profile methods return:

```ts
PublicPlayerIdentity {
  displayName: string | null
}
```

This projection does not expose email, raw Meteor user documents, user IDs,
roles, passwordless data, login service data, or auth metadata.

Server internals may map user IDs to this safe identity projection while
assembling competitive views. Those user IDs stay server-side.

## Validation

`displayName` is normalized and validated by shared code:

- string input only;
- trim leading/trailing whitespace;
- collapse repeated internal whitespace;
- minimum 2 visible characters;
- maximum 30 visible characters;
- reject blank-only names;
- reject Unicode control characters (`\p{Cc}`);
- reject Unicode format-control characters (`\p{Cf}`), including invisible and
  bidirectional controls such as U+200B, U+202E, and U+2060;
- preserve ordinary Unicode human names and nicknames.

Accepted examples include `Pierre`, `Pete`, `John Smith`, `Big Dave`,
`Scrum Lord`, `José`, and `Thabo Mokoena`.

Display names are not globally unique. Two players can both use `John`; internal
identity remains `userId`, and leaderboard rows remain distinct through opaque
row IDs.

CCPP-012A implements only a narrow reserved-name rule for exact normalized
impersonation names: `Rugby Rooster`, `Admin`, `Administrator`, and `System`.
Profanity filtering, moderation queues, fuzzy impersonation detection, handles,
avatars, and public profile pages are deferred future operational/product work.

## Batch Resolver

`imports/server/playerProfiles/service.ts` exposes
`resolvePublicPlayerIdentities(userIds)`.

It deduplicates the requested user IDs, performs one `player_profiles` query for
the batch, and returns a server-side map from user ID to
`PublicPlayerIdentity`. Missing profiles are normal and resolve to
`{ displayName: null }`.

The resolver never queries one player at a time and never falls back to email.

## Leaderboard Policy

Fixture leaderboard ranking remains unchanged. CCPP-012A changes only label
resolution:

- current signed-in player: `You`;
- another player with `displayName`: that display name;
- another player without a profile/name: the existing fixture-scoped
  `Rooster XXXXXXXX` alias.

The alias remains derived server-side from fixture ID plus user ID. It is not
stored, is different across fixtures, and never exposes raw user IDs or email.

Name changes are derived on fresh leaderboard loads. Prediction documents,
score projections, match results, and leaderboard rows are not rewritten with
display names.

## Account Page

`/account` includes a compact `Public player name` section for verified signed
in players. It loads the current name, saves without a full page reload,
displays success and validation/error feedback, and reflects the normalized
saved value in the input.

The copy explicitly says the name may be shown to other Rugby Rooster players
on leaderboards and competitive views. It does not imply account email is
public.

## Deferred

CCPP-012A does not implement leagues, social features, avatars, handles,
username uniqueness, public profile pages, onboarding gates, moderation tools,
profanity filtering, duplicate-name UI, score-breakdown redesign, or animation
work.
