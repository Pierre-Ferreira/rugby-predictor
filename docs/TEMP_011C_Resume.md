# CCPP-011C Resume

## Current Scope

Implement the signed-in player's own fixture score breakdown. Animation, AI,
leagues, prizes, score persistence, and other players' detailed predictions
remain out of scope.

Closeout status: implementation and retained focused browser evidence already
exist. Documentation, final static checks, and EOMD packaging are the active
closeout work.

## Inspected Source Paths

- `AGENTS.md`
- `docs/PLATFORM_Player_Fixture_Scoring.md`
- `docs/AUDIT_011A_Player_Fixture_Score.md`
- `docs/PLATFORM_Fixture_Leaderboard.md`
- `docs/AUDIT_011B_Fixture_Leaderboard.md`
- `docs/CORE_Scoring_Rules.md`
- `docs/CORE_Predictions.md`
- `docs/CORE_Prediction_Questions.md`
- `docs/PLATFORM_Predictions.md`
- `docs/PLATFORM_Match_Results.md`
- `docs/PLATFORM_Prediction_Sequence.md`
- `docs/PLATFORM_Testing.md`
- `docs/MAP_System.md`
- `docs/CORE_Build_Plan.md`
- `README.md`
- `imports/shared/playerFixtureScores/types.ts`
- `imports/shared/playerFixtureScores/projection.ts`
- `imports/server/playerFixtureScores/service.ts`
- `imports/server/playerFixtureScores/server.ts`
- `imports/shared/scoring/types.ts`
- `imports/shared/scoring/engine.ts`
- `imports/shared/scoring/rulesets.ts`
- `imports/shared/predictions/sequence.ts`
- `imports/shared/predictions/methods.ts`
- `imports/shared/routes.ts`
- `imports/ui/App.tsx`
- `imports/ui/pages/FixtureLeaderboardPage.tsx`
- `imports/ui/pages/GameDetailPage.tsx`
- `imports/ui/pages/PredictionEntryPage.tsx`
- `imports/ui/fixtures/fixtureUi.ts`
- `imports/ui/auth/useAuthState.ts`
- `imports/ui/auth/methodCall.ts`
- `tests/unit/player-fixture-score.test.ts`
- `tests/unit/routes.test.ts`

## Actual 011A Projection / Component Structure

`PlayerFixtureScoreProjection` contains `fixtureId`, `predictionRevision`,
`resultRevision`, `status`, `startingPoints`, `currentScore`, `finalScore`,
`resolvedDeduction`, `pendingCount`, `ruleset`, and `components`.

Each `PlayerFixtureScoreComponent` contains `key`, `questionId`, `label`,
`type`, `status`, `deduction`, and the engine `items` array.

Item shape comes directly from `QuestionScoreBreakdown['items']`:

- numeric items: optional `team`, `prediction`, `observed`, `difference`,
  `rate`, `deduction`, `status`;
- categorical items: `prediction`, `observed`, `incorrectDeduction`,
  `deduction`, `status`.

Engine statuses preserve item-level mixed states. A component with one pending
item becomes projection-level `pending`, but the individual resolved item still
retains its deduction and observed value.

## Existing Method Suitability

`predictions.getMyFixtureScore` already returns enough authoritative score and
item data for the breakdown. It is owner-only: the client supplies only a
fixture ID, and the server loads `{ fixtureId, userId }` for the authenticated
verified player. No new score-breakdown Meteor method is planned.

## Projection Enrichment

No scoring enrichment is currently planned. If presentation needs a safe field,
prefer adding it to the shared 011A projection without changing scoring
authority.

## Presentation Mapping Strategy

Add a framework-independent view-model module that consumes `{ fixture,
scoreProjection }` and:

- uses the 011A projection as score/deduction/status authority;
- sequences components to match prediction order;
- groups yellow/red cards under one Cards section while retaining separate
  item rows;
- resolves team labels, Draw, No Tries Today, First/Second/Equal half labels;
- resolves custom question text and custom choice option labels from the
  fixture ruleset snapshot;
- represents item-level `pending`, `void`, zero deduction, and deduction states
  explicitly;
- emits compact summary fields for awaiting, provisional, final, cancelled,
  and no-prediction states.

The view model must not call scoring primitives or recompute deductions.

## Route Decision

Use `/games/:fixtureId/my-score` to avoid implying any leaderboard row can be
opened. Add a route helper and a signed-in player page using the existing
public layout/sign-in flow.

## Tests / Results

- `meteor npm run test:unit -- tests/unit/player-score-breakdown.test.ts tests/unit/routes.test.ts tests/unit/auth-helpers.test.ts` -
  passed, 3 files / 27 tests.
- `meteor npm run test:unit -- tests/unit/player-score-breakdown.test.ts tests/unit/player-fixture-score.test.ts tests/unit/routes.test.ts tests/unit/auth-helpers.test.ts` -
  passed, 4 files / 35 tests.
- `meteor npm run typecheck` - passed.
- `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=/home/pierreferreira/Desktop/rugby-predictor/test-results/ccpp011c-player-score-breakdown meteor npm run test:e2e -- tests/e2e/player-score-breakdown.spec.ts --workers=1 --retries=0` -
  first failed in sandbox before reporter output; `.last-run.json` had no
  failed tests and no screenshots.
- Same focused Playwright command rerun outside sandbox - passed, 1 Chromium
  test / 1 passed, with screenshots:
  `provisional-desktop-score-breakdown.png`,
  `partially-pending-tries-section.png`, `deduction-row.png`,
  `custom-void-section.png`, `final-desktop-score-breakdown.png`,
  `mobile-390.png`, and `mobile-360.png`.

## Resume State Classification

The retained browser artifacts were written at 2026-09-20 21:36:38-21:36:39
Africa/Johannesburg. Current runtime/presentation source files inspected during
resume are older than those artifacts:

- `imports/shared/playerFixtureScores/breakdownViewModel.ts` - 21:28:33.
- `imports/ui/pages/PlayerScoreBreakdownPage.tsx` - 21:32:38.
- `tests/e2e/player-score-breakdown.spec.ts` - 21:34:42.

The focused spec's `Window.Meteor` declaration correction therefore predates
the retained passing browser journey. The only visible file timestamp after the
screenshots is this resume document. Classification for the latest identifiable
post-evidence edit is A, documentation/test-only. Preserve the existing
browser evidence; no Playwright rerun is justified by current source state.

During closeout, changed-file Prettier formatting made static cleanup edits to
the new score-breakdown source/tests. That is category B, static/lint cleanup
with no visible runtime behavior change. Retain the existing browser evidence
and record that it predates the closeout formatting pass.

## Implemented Behaviour

- Owner-only score breakdown uses `predictions.getMyFixtureScore`.
- No second Meteor scoring method and no duplicate scoring algorithm were
  added.
- The React page consumes the existing CCPP-011A structured projection.
- Route: `/games/:fixtureId/my-score`.
- Safe auth return path accepts the route.
- Current-user leaderboard/saved prediction contexts link to the route.
- The page performs immediate fetch plus manual Refresh.
- Visible-page polling runs about every 15 seconds while awaiting/provisional
  and stops on final, cancelled, hidden, or unmounted.
- Last-good breakdown remains visible on refresh failure.
- There is no other-player score-detail access.

## Presentation Contract

`buildPlayerScoreBreakdownViewModel(...)` maps presentation only. It handles
ordering, section labels, team names, custom prompt/option labels, status
labels, summary fields, item-level Pending/Void/resolved display, and zero-floor
copy. It does not call scoring primitives, calculate deductions, decide
correctness, or rebuild `currentScore` / `finalScore`.

Important item-level behavior is preserved: a partially pending component keeps
resolved rows visible. Example: Tries can show Springboks predicted `4`, actual
`5`, deduction `-50`, while All Blacks remains Pending.

The authoritative CCPP-011A `team-score` component is displayed as `Predicted
Score` after Drop Goals. The UI does not hide that deduction and does not
recalculate it.

## Documentation Status

Created/updated for closeout:

- `docs/PLATFORM_Player_Score_Breakdown.md`
- `docs/AUDIT_011C_Player_Score_Breakdown.md`
- `docs/TEMP_011C_Resume.md`
- `docs/CORE_Product.md`
- `docs/PLATFORM_Player_Fixture_Scoring.md`
- `docs/PLATFORM_Fixture_Leaderboard.md`
- `docs/PLATFORM_Match_Results.md`
- `docs/CORE_Predictions.md`
- `docs/PLATFORM_Predictions.md`
- `docs/PLATFORM_Testing.md`
- `docs/MAP_System.md`
- `docs/CORE_Build_Plan.md`
- `README.md`

## Final Closeout Checks

- `meteor npm run test:unit -- tests/unit/player-score-breakdown.test.ts tests/unit/routes.test.ts tests/unit/auth-helpers.test.ts` -
  passed, 3 files / 27 tests.
- `meteor npm run typecheck` - passed.
- `meteor npm run lint` - passed.
- `meteor npm run lint:project` - passed.
- `./node_modules/.bin/prettier --check <changed closeout docs/source/tests>` -
  passed.
- `git diff --check` - passed.

No focused Playwright rerun was performed during closeout because the retained
browser evidence already covered the implemented behavior and the later
closeout edits were documentation/test-only or static formatting cleanup. No
server integration rerun was performed because no server/shared scoring
contract changed after the previously accepted state.

## EOMD Package

- Archive path:
  `rugby-rooster-ccpp011c-player-score-breakdown-eomd-20260920.zip`.
- Included shared breakdown/view-model source, My Score page, route/auth
  wiring, current-user link entry points, relevant CCPP-011A projection/method
  context, focused unit tests, focused browser spec, retained screenshots,
  browser result logs, updated docs, and `COMMAND_RESULTS_011C.txt`.
- `unzip -t rugby-rooster-ccpp011c-player-score-breakdown-eomd-20260920.zip` -
  passed with no compressed-data errors.
- `zipinfo -1 rugby-rooster-ccpp011c-player-score-breakdown-eomd-20260920.zip` -
  confirmed source, tests, docs, command summary, browser logs, and screenshots
  were present.
- Screenshot files opened/validated with `file`; dimensions were
  `1280x3608`, `976x253`, `934x84`, `976x186`, `1280x3592`, `390x5670`, and
  `360x5694`.
- The archive excludes credentials, raw emails, private settings,
  `node_modules`, `.meteor/local`, caches/builds, unrelated animation evidence,
  and historical archives.
- Original repository files remained in place; packaging copied/archived only.
- After the checkpoint/audit packaging notes were added, the archive was
  refreshed and `unzip -t` passed again with no compressed-data errors.

## Browser Budget

Used: one focused browser batch was retained from the implementation pass after
the type declaration correction. Closeout should not rerun Playwright unless a
post-evidence runtime/presentation behavior change materially affects the
breakdown shown in the retained screenshots.

## Exact Next Action

CCPP-011C closeout is complete. Stop; do not begin AI, leagues, prizes,
another user's breakdown, score persistence, or animation work.
