# CCPP-011A Resume Checkpoint

## Inspected Source Paths

- `AGENTS.md`
- `docs/CORE_Scoring_Rules.md`
- `docs/PLATFORM_Scoring_Engine.md`
- `docs/CORE_Predictions.md`
- `docs/PLATFORM_Predictions.md`
- `docs/CORE_Match_Results.md`
- `docs/PLATFORM_Match_Results.md`
- `docs/CORE_Prediction_Questions.md`
- `docs/PLATFORM_Prediction_Question_Configuration.md`
- `docs/PLATFORM_Testing.md`
- `docs/MAP_System.md`
- `docs/CORE_Build_Plan.md`
- `imports/shared/scoring/types.ts`
- `imports/shared/scoring/engine.ts`
- `imports/shared/matchResults/types.ts`
- `imports/shared/matchResults/validation.ts`
- `imports/shared/predictions/types.ts`
- `imports/shared/predictions/validation.ts`
- `imports/server/predictions/server.ts`
- `imports/server/matchResults/server.ts`
- `imports/server/fixtures/testSupport.ts`
- `imports/server/predictions/predictions.app-test.ts`
- `imports/server/matchResults/matchResults.app-test.ts`
- `imports/shared/scoring/validation.ts`
- `imports/shared/predictions/methods.ts`
- `server/main.ts`

## Actual Scoring-Engine Interface

The existing framework-independent engine is imported from
`/imports/shared/scoring` and called as:

```ts
scoreFixture({
  ruleset,
  prediction,
  observations,
  calculationMode: 'if-ended-now' | 'final',
});
```

It returns `FixtureScoreResult` with `startingPoints`, `totalDeductions`,
zero-floored `score`, `calculationStatus`, `pendingQuestionIds`, `ruleset`, and
structured `breakdown`. It validates rulesets, predictions, observations, final
readiness, pending observations, disabled questions, custom Number/Choice, and
custom Void through existing scoring validation.

## Canonical Sources

- Fixture/ruleset: `fixtures.rulesetSnapshot` on a published fixture is the
  authoritative frozen ruleset for both prediction and result settlement.
- Prediction: `predictions` collection stores one owned
  `PredictionEntryDocument` per `{ userId, fixtureId }`, the normalized
  `prediction`, small `ruleset` identity, and integer `revision`.
- Result: `match_results` collection stores at most one
  `MatchResultDocument` per fixture, with `observations`, integer `revision`,
  and `observations.matchStatus` (`provisional` or `confirmed`).
- No score persistence currently exists on predictions or in a player score
  collection.

## Implemented Projection Shape

Shared serializable type:

```ts
PlayerFixtureScoreProjection {
  fixtureId: string;
  predictionRevision: number;
  resultRevision: number | null;
  status: 'awaiting_result' | 'provisional' | 'final' | 'cancelled';
  startingPoints: number;
  currentScore: number | null;
  finalScore: number | null;
  resolvedDeduction: number;
  pendingCount: number;
  ruleset: RulesetResultReference;
  components: PlayerFixtureScoreComponent[];
}
```

`components` retain stable engine data: `key`, `questionId`, `status`
(`resolved`, `pending`, or `void`), `deduction`, `type`, `label`, and engine
`items`. If a fixture is cancelled, 011A returns a clear non-score
`cancelled` projection with null scores, because cancelled fixture scoring
remains unresolved.

## Implementation Progress

- Added shared player fixture score projection module:
  - `imports/shared/playerFixtureScores/types.ts`
  - `imports/shared/playerFixtureScores/errors.ts`
  - `imports/shared/playerFixtureScores/projection.ts`
  - `imports/shared/playerFixtureScores/index.ts`
- Added owner-only method constant
  `PREDICTION_METHODS.getMyFixtureScore = 'predictions.getMyFixtureScore'`.
- Added server score service and Meteor method:
  - `imports/server/playerFixtureScores/service.ts`
  - `imports/server/playerFixtureScores/server.ts`
  - registered from `server/main.ts`.
- Added focused tests:
  - `tests/unit/player-fixture-score.test.ts`
  - `imports/server/playerFixtureScores/playerFixtureScores.app-test.ts`
  - imported from `imports/server/app-tests.ts`.
- No score collection, prediction score field, worker, leaderboard, UI, or
  animation work was added.

## Tests/Checks

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

## Blockers

- None known yet.

## Exact Next Action

Create and inspect
`rugby-rooster-ccpp011a-player-fixture-score-eomd-20260920.zip`, then report
final status.
