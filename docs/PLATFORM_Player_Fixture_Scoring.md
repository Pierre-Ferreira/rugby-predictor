# Rugby Rooster Player Fixture Scoring Platform

CCPP-011A adds deterministic player fixture-score projection. It does not add
score persistence, score jobs, or public result publication. CCPP-011B consumes
this projection for a derived fixture leaderboard without adding a second
scoring path, and CCPP-011C consumes the same projection for the signed-in
player's own score breakdown.

## Model

Player fixture score is derived, not stored:

```text
persisted prediction
+ fixture frozen ruleset snapshot
+ current match result
-> existing scoring engine
-> PlayerFixtureScoreProjection
```

There is no `player_scores` collection and prediction documents are not mutated
when result data changes. Result corrections naturally recalculate because the
method reads the current result document each time.

## Canonical Inputs

- Fixture and ruleset: `fixtures.rulesetSnapshot` is the authoritative frozen
  ruleset. Mutable defaults and draft question configuration are never used to
  score a saved prediction.
- Prediction: `predictions` stores the current user's normalized
  `prediction`, small ruleset identity, and `revision`.
- Match result: `match_results` stores the current official `observations` and
  `revision` for the fixture.

The projection adapter verifies that the prediction and result belong to the
fixture and that their stored ruleset identities match the fixture snapshot. If
canonical persisted data is inconsistent, scoring fails instead of guessing.

## Projection

Shared source lives under `imports/shared/playerFixtureScores/`.

`PlayerFixtureScoreProjection` includes:

- `fixtureId`
- `predictionRevision`
- `resultRevision`
- `status`
- `startingPoints`
- `currentScore`
- `finalScore`
- `resolvedDeduction`
- `pendingCount`
- `ruleset`
- `components`

Component rows keep stable engine data: question key, question ID, question
type, component status, deduction, label, and the engine item array. CCPP-011C
maps those components into player-facing labels and rows without recalculating
score totals or deductions.

## Lifecycle

`awaiting_result` means the player has a saved prediction but no match result
document exists. `currentScore` and `finalScore` are `null`; `startingPoints`
remains metadata and is not presented as earned score.

`provisional` means a result exists with `observations.matchStatus:
'provisional'`. The adapter calls the existing scoring engine in
`if-ended-now` mode. Resolved observations contribute deductions, pending
observations do not, and `finalScore` remains `null`.

`final` means the result is confirmed. The adapter calls the existing scoring
engine in `final` mode, so the engine enforces final readiness. `currentScore`
and `finalScore` are the same zero-floored value and `pendingCount` is `0`
except for engine-supported non-scoring Void components.

`cancelled` means the fixture is cancelled. CCPP-011A does not invent refund,
competition, or abandoned-match scoring rules. The projection is a non-score
outcome with null scores and no components.

## Pending, Zero, And Void

Pending is not zero and not correct. The match-result normalizer stores blank
admin fields as `{ status: 'pending' }`; explicit `0` is a resolved observed
value. The score projection preserves that distinction through the engine
breakdown.

Custom Number and Choice observations use stable custom question IDs. Custom
Choice scoring uses stable option IDs, not labels. Custom Void is supported only
where the result/scoring domain allows it; Void components deduct `0`, are not
pending, and do not block final projection.

## Meteor Method

Owner-only player method:

- `predictions.getMyFixtureScore`

Input is a fixture ID. The method requires a verified signed-in player, fetches
that user's own saved prediction by `{ fixtureId, userId }`, fetches the
canonical result server-side, and returns either:

- `null` when the current user has no saved prediction for the fixture; or
- `PlayerFixtureScoreProjection` for the current user's prediction.

The client cannot supply prediction contents, observed result values, result
revision, another user ID, or scoring deductions. The method returns only the
derived projection, not another user's prediction or admin-only result metadata.

## Leaderboard Reuse

CCPP-011B reuses `calculatePlayerFixtureScoreProjection(...)` for every
eligible saved prediction in a fixture leaderboard. The leaderboard layer does
not call scoring primitives directly, duplicate deduction constants, reapply
the zero floor, or persist score/rank data.

For one fixture, 011B loads the canonical fixture, current match result, and
saved predictions server-side, then ranks the resulting 011A projections in
memory. Result corrections naturally update leaderboard scores and places on
the next leaderboard request.

## Score Breakdown Reuse

CCPP-011C reuses the owner-only `predictions.getMyFixtureScore` method for the
signed-in player's own `/games/:fixtureId/my-score` page. The page calls the
existing method again for manual Refresh and visible-page polling, so result
corrections are reflected without a page reload.

The score-breakdown view model consumes this projection as authority. It
handles presentation concerns such as prediction sequence order, team names,
custom question labels, custom Choice stable-option label resolution,
Pending/Void/resolved display, and zero-floor explanation. It does not call
scoring primitives, calculate deductions, decide correctness independently, or
rebuild `currentScore` / `finalScore`.

Item-level status is preserved. A partially pending team component can display
one resolved team row with its deduction and another team row as Pending. Blank
official observations stay Pending; explicit observed zero values remain
resolved zeros.

The authoritative `team-score` component remains visible in 011C as a
`Predicted Score` section after Drop Goals. The UI labels the existing
projection data and does not recalculate the derived rugby score deduction.
