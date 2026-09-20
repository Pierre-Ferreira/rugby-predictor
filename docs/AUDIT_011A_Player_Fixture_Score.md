# CCPP-011A Player Fixture Score Audit

## Scope

CCPP-011A implements deterministic player fixture-score projection after
accepted CCPP-010C. Animation and prediction-presentation refinement are paused.
No leaderboard, ranking, score card UI, player breakdown UI, AI report, live
event ingestion, score persistence, cache, or worker was added.

## Implementation

- Added shared projection types and adapter under
  `imports/shared/playerFixtureScores/`.
- Added owner-only Meteor method `predictions.getMyFixtureScore`.
- Added server service `imports/server/playerFixtureScores/service.ts` that
  fetches canonical fixture, prediction, and result data before scoring.
- Registered the server method from `server/main.ts`.
- Added pure unit tests in `tests/unit/player-fixture-score.test.ts`.
- Added isolated app-tests in
  `imports/server/playerFixtureScores/playerFixtureScores.app-test.ts`.

## Behaviour

Scores are derived from:

- `fixtures.rulesetSnapshot`;
- the current user's persisted `predictions` entry;
- the current `match_results` document for the fixture.

The projection uses the existing `scoreFixture(...)` engine. It does not
hard-code deduction constants, duplicate scoring formulas, persist totals, or
mutate predictions when results change.

Lifecycle states:

- `awaiting_result`: saved prediction exists, no result exists, scores are
  `null`.
- `provisional`: current score is based only on resolved observations, pending
  remains pending, final score is `null`.
- `final`: confirmed result scores through engine final mode, final readiness is
  enforced by the existing engine contract, and final/current score match.
- `cancelled`: non-score projection with null scores.

Custom Void components deduct zero, are not pending, and remain visible in the
structured component data. Pending and explicit zero remain distinct through
actual match-result normalization.

## Security

The method requires a verified signed-in player. It accepts only a fixture ID,
selects the current user's prediction server-side, fetches result observations
server-side, and does not accept a user ID, prediction payload, result payload,
or deduction data from the client.

No player score collection, leaderboard collection, or prediction score field
was introduced.

## Verification

- `meteor npm run test:unit -- tests/unit/player-fixture-score.test.ts` -
  passed, 1 file / 8 tests.
- `meteor npm run test:unit -- tests/unit/player-fixture-score.test.ts tests/unit/scoring-engine.test.ts tests/unit/predictions.test.ts tests/unit/match-results.test.ts` -
  passed, 4 files / 54 tests.
- `meteor npm run test:integration` - passed, 74 server tests.
- `meteor npm run typecheck` - passed.
- `meteor npm run lint` - passed.
- `meteor npm run lint:project` - passed.
- Changed-file Prettier check - passed.
- `git diff --check` - passed.

No browser tests were run because CCPP-011A adds no player score UI.

## EOMD

Archive path:
`rugby-rooster-ccpp011a-player-fixture-score-eomd-20260920.zip`.
