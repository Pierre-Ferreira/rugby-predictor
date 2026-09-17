# CCPP-008B Resume Checkpoint

## Scope

Implement the authoritative admin match-result and prediction-question settlement
workflow for published, non-cancelled Rugby Rooster fixtures.

Out of scope: player score persistence, leaderboard/ranking/winners, live match
event capture, live fixture lifecycle states, public provisional scores, Kaplay,
AI, broad auth redesign, and broad UI restyling.

## Docs / Source Inspected

- `AGENTS.md`
- `docs/CORE_Scoring_Rules.md`
- `docs/PLATFORM_Scoring_Engine.md`
- `docs/CORE_Prediction_Questions.md`
- `docs/PLATFORM_Fixtures.md`
- `imports/shared/scoring/types.ts`
- `imports/shared/scoring/derived.ts`
- `imports/shared/scoring/engine.ts`
- `imports/shared/scoring/validation.ts`

## Existing Scoring Observation Model Discovered

- Shared domain already has `FixtureObservations`.
- Shared observation values use `ObservedValue<T>` with `pending`,
  `provisional`, and `confirmed` statuses.
- Match observation status is `provisional` or `confirmed`.
- Calculation modes already distinguish `if-ended-now` and `final`.
- Final scoring already rejects non-confirmed match status/observations.
- Actual team score and match result are derived from normalized component
  observations.
- First-try consistency is validated against supplied try observations.
- Custom Number/Choice questions already exist in ruleset snapshots and
  prediction answers.

## Canonical Product Findings

- Penalty tries are normalized before scoring as one try plus one conversion.
- Pending is distinct from explicit zero.
- Extra-time treatment remains unresolved in `CORE_Scoring_Rules.md`; the engine
  scores the supplied observation set.
- Detailed card-event normalization, including second-yellow-to-red and card
  upgrade handling, remains unresolved.
- Custom settlement was anticipated as Pending, Settled, or Void, but not yet
  implemented before this milestone.

## Persistence Approach

Planned: add one authoritative result document per fixture with a unique
fixture relation, stored observations, integer result revision, server-owned
timestamps/actor metadata, and optional ruleset identity reference copied from
the published fixture snapshot. The fixture `rulesetSnapshot` remains
authoritative for validation and required observation shape.

## Void-Domain Approach

Planned: narrow extension so custom observations may be `void` while built-in
numeric and categorical observations continue to reject `void`. Void custom
observations must contain no value, are not pending, do not block final
calculation, and score as zero deduction in the scoring breakdown.

## Files Changed

- `docs/TEMP_008B_Resume.md`
- `imports/shared/scoring/types.ts`
- `imports/shared/scoring/validation.ts`
- `imports/shared/scoring/engine.ts`
- `imports/shared/matchResults/*`
- `imports/api/matchResults/collection.ts`
- `imports/server/matchResults/*`
- `server/main.ts`
- `imports/server/app-tests.ts`

## Methods / Publications Implemented

- `matchResults.admin.saveProvisional`
- `matchResults.admin.confirmFinal`
- `matchResults.admin.fixtureContext`
- `matchResults.admin.summaries`
- `test.matchResults.reset`

## Result UI Status

Implemented first pass:

- `/admin/fixtures/:fixtureId/results` admin route.
- Existing admin fixture list shows result state and a Results action for
  published fixtures.
- Result page captures result revision independently from reactive updates.
- Provisional save keeps blanks pending and zero as observed zero.
- Final confirmation uses a browser confirmation and becomes read-only after
  success.
- Cancelled/draft fixtures render read-only/ineligible states.
- Custom Void checkbox clears the official value and states that it deducts no
  points.

## Tests Already Run / Results

- `npm run typecheck` - passed after fixes and reruns.
- `npm run test:unit -- tests/unit/scoring-engine.test.ts tests/unit/routes.test.ts`
  - passed before final route-test addition, 39 tests.
  - rerun after formatting/route addition, passed, 40 tests.
- `npm run test:unit` - passed, 12 files and 131 tests.
- `npm run test:integration -- --grep "match result administration"` - first
  run needed loopback escalation; after test-helper/data fixes, passed, 65
  server tests.
- `npm run test:e2e -- tests/e2e/results.spec.ts` - first run failed due to an
  ambiguous Void checkbox locator; reruns passed, 2 Chromium tests.
- `npm run lint` - passed after refactoring result-page state initialization.
- `npm run lint:project` - passed.
- `npm run format:check` - failed on pre-existing unrelated formatting issues in
  older files.
- Changed-file Prettier check - passed.

## Remaining Work

- Package review ZIP.

## Known Issues

- None discovered yet beyond documented unresolved product questions.

## Explicit Out Of Scope

No persisted Rugby Rooster player scores, leaderboard, ranking, winners, score
jobs, public live deductions, live rugby event capture, live match lifecycle,
Kaplay, sprites, animations, broad platform UI refresh, auth redesign, Postmark,
or service-worker caching.
