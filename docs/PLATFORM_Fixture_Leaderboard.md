# Rugby Rooster Fixture Leaderboard Platform

CCPP-011B adds a derived player-facing leaderboard for one published fixture.
It ranks saved predictions by reusing the accepted CCPP-011A player
fixture-score projection.

## Model

The fixture leaderboard is derived, not stored:

```text
published fixture
+ current match result
+ saved fixture predictions
+ fixture-scoped player labels
-> CCPP-011A player fixture-score projection per prediction
-> standard competition ranking
-> FixtureLeaderboardProjection
```

There is no leaderboard collection, player score collection, ranking document,
score cache, background ranking job, or Redis/materialized view. Result
corrections recalculate rows on the next method call.

## Canonical Inputs

- Fixture: published fixture plus frozen `rulesetSnapshot`.
- Result: current `match_results` document for the fixture, when present.
- Predictions: all persisted `predictions` entries for the fixture.
- Player labels: fixture-scoped safe aliases derived on the server.

The server loads the fixture once, result once, and predictions in one query.
CCPP-011B does not query per player and does not accept prediction or result
payloads from the client.

Eligible entries are exactly persisted canonical predictions for the fixture.
Unsaved drafts, arbitrary accounts, no-prediction users, and cancelled
non-score rows are not ranked.

## Projection

Shared source lives under `imports/shared/fixtureLeaderboards/`.

`FixtureLeaderboardProjection` includes:

- `fixtureId`
- `status`
- `resultRevision`
- `totalEntries`
- `generatedFromScoreStatus`
- `currentUserParticipating`
- `rows`
- `currentUserRow`
- `page`

Rows expose only:

- `rowId`
- `place`
- `displayLabel`
- `score`
- `pendingCount`
- `isCurrentUser`

Rows do not expose user IDs, emails, prediction payloads, account metadata, raw
match-result documents, or score-breakdown components.

## Lifecycle

`awaiting_result` means saved predictions may exist but no match result exists.
`totalEntries` is available, `rows` is empty, and no rank or fake `10,000`
score is assigned.

`provisional` means a result exists with provisional match status. Rows use the
011A `currentScore`, preserve `pendingCount`, and the player-facing heading is
`If it ended now`.

`final` means the result is confirmed. Rows use the final/current 011A score,
`pendingCount` is zero, and the UI labels the state `Final leaderboard`.

`cancelled` means no leaderboard score or rank is assigned. The response keeps
`totalEntries` but returns no ranking rows.

## Ranking

The leaderboard uses standard competition ranking:

```text
9800, 9500, 9500, 9100 -> 1, 2, 2, 4
10000, 10000, 9300 -> 1, 1, 3
```

Rows sort by score descending, then by deterministic fixture-scoped opaque row
ID. The secondary ordering stabilizes rendering inside ties but never changes
the shared place number.

Ranking is calculated across all eligible entries before pagination, so page 2
keeps global places. Ties may span page boundaries.

## Privacy Labels

No inspected Rugby Rooster account/profile model currently provides an
explicitly safe public player display name. CCPP-011B therefore uses temporary
fixture-scoped aliases:

```text
Rooster XXXXXXXX
```

The alias and row ID are derived server-side from a SHA-256 digest of
`fixtureId + ":" + userId`. The visible alias is stable within a fixture,
different across fixtures, and does not reveal the raw user ID or email.

The signed-in player's visible label is `You`, with `isCurrentUser: true`.

## Pagination And Current User

Method input uses:

- `fixtureId`
- `offset`
- `limit`

Defaults:

- default limit: `50`
- maximum limit: `100`
- offset: non-negative integer

If the current user's row is inside the loaded page, it appears only in `rows`.
If the current user has a saved prediction but is outside the loaded page,
`currentUserRow` returns the same safe row separately for a `Your position`
section. Viewers do not need to have submitted a prediction.

## Meteor Method

Player method:

- `predictions.getFixtureLeaderboard`

The method requires a verified signed-in player. It loads canonical server-side
fixture, result, and prediction documents, generates privacy-safe labels, calls
the shared leaderboard builder, and returns the derived projection.

The client cannot supply another user ID, prediction contents, result contents,
observations, result revision, or deduction values.

Draft or unavailable fixtures are denied/not found under existing fixture
conventions. Cancelled published fixtures return `cancelled`.

## Route And UI

Route:

- `/games/:fixtureId/leaderboard`

The page uses the public/player layout and existing sign-in-required return
path. It shows:

- concise awaiting-result copy without fake rows;
- provisional `If it ended now` rows with pending counts;
- final rows without pending counts;
- shared place numbers for ties;
- visible current-user highlighting with a `YOU` badge;
- a `View my score` link for the signed-in participating player, pointing to
  `/games/:fixtureId/my-score`;
- `Your position` when the current user is outside the loaded page;
- `Load more` pagination;
- manual refresh.

Client-side leaderboard projection and error state are scoped by fixture ID.
When the route changes, the page derives active data for the new fixture instead
of displaying the previous fixture's rows or errors while the next request is in
flight. A refresh failure after a successful load keeps the current fixture's
last good leaderboard visible and shows a small retry status.

While the leaderboard is `awaiting_result` or `provisional`, the page refreshes
approximately every 15 seconds only when the document is visible. Automatic
refresh stops on final/cancelled.

## Deferred

CCPP-011B itself does not implement leagues, tournaments, cumulative totals,
average scores, prizes, QR redemption, AI commentary, score-breakdown UI,
persistent score caches, background jobs, or leaderboard animations.

CCPP-011C adds the separate current-player score-breakdown route. It does not
change CCPP-011B leaderboard ranking, pagination, privacy labels, or projection
shape.
