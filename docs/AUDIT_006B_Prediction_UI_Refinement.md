# AUDIT 006B Prediction UI Refinement

## Scope

CCPP-006B corrected three standard React prediction UI issues:

- Derived predicted rugby match scores are shown clearly in the review area.
- Player-facing prediction labels use fixture team display names instead of
  generic Team 1 / Team 2 wording where names are available.
- Conversion inputs are locally bounded so conversions cannot intentionally be
  entered above the corresponding predicted tries.

This milestone did not implement the future sequential prediction flow, Kaplay,
animations, custom questions, authentication changes, fixture administration
changes, match-result administration, live match lifecycle, leaderboards, Rugby
Rooster scoring against actual results, AI, service-worker caching, or the
deferred full-auth browser-suite navigation issue.

## UI Changes

Changed `imports/ui/pages/PredictionEntryPage.tsx`:

- Replaced player-facing side labels such as `Team 1: Springbokke` with the
  fixture team display name alone.
- Updated scoring team headings, numeric input accessible labels, match-result
  options, first-try options, half-time-leader options, review cards, selected
  result display, derived-result display, and read-only saved-entry review output
  to use fixture team names.
- Kept internal select values and prediction payload values as the existing
  domain identifiers `team1`, `team2`, and `draw`.
- Changed review score cards from generic team-score labels to per-team review
  cards that display `Predicted score: <number>` when valid.
- Added unavailable score/result states for invalid or incomplete scoring input,
  including the available validation reason.
- Added dynamic `max` attributes to conversion inputs based on the same team's
  predicted tries.
- Added local-state clamping so entering conversions above tries clamps
  conversions to tries, and reducing tries below the current conversion count
  immediately clamps conversions down for that team only.

## Shared Scoring

No scoring rule changes were made.

The UI continues to reuse the shared scoring helpers exported from
`imports/shared/scoring`:

- `deriveTeamScore`
- `deriveMatchResult`
- `ScoringValidationError`

No new scoring formula was added to the React component. No persisted prediction
shape or domain enum was renamed.

## Tests

Changed `tests/e2e/predictions.spec.ts`:

- Added browser coverage proving prediction controls use fixture team names,
  generic Team 1 / Team 2 control labels/options are absent, and visible labels
  still map to internal `team1` / `team2` values.
- Added browser coverage proving conversion max attributes are team-specific,
  conversions clamp when entered above tries, reducing tries clamps conversions,
  and the opposite team is not changed.
- Added browser coverage proving valid scoring inputs display predicted rugby
  scores and derived winner/draw states, while incomplete input displays
  unavailable score/result states instead of numeric scores.
- Updated existing prediction browser tests to use fixture-team accessible labels
  and the new review text while preserving submit/revisit, edit, locked
  saved-entry, and stale conflict assertions.

Changed `tests/unit/predictions.test.ts`:

- Added coverage proving sanitized prediction payloads preserve internal
  team-side values.
- Added coverage proving server/shared validation still rejects conversions
  greater than tries if a client bypasses the UI.

Existing server-side conversion validation tests were not removed.

## Commands Executed

- `meteor npm exec prettier -- --write imports/ui/pages/PredictionEntryPage.tsx tests/e2e/predictions.spec.ts tests/unit/predictions.test.ts docs/TEMP_006B_Resume.md`
  - Result: passed; files formatted.
- `meteor npm exec prettier -- --write imports/ui/pages/PredictionEntryPage.tsx tests/e2e/predictions.spec.ts tests/unit/predictions.test.ts docs/CORE_Predictions.md docs/PLATFORM_Predictions.md docs/PLATFORM_Testing.md docs/MAP_System.md docs/AUDIT_006B_Prediction_UI_Refinement.md docs/TEMP_006B_Resume.md`
  - Result: passed; changed source, tests, and docs used Prettier output.
- `meteor npm exec vitest run --config vitest.config.mts tests/unit/predictions.test.ts`
  - Result: passed, 6 tests.
- `meteor npm run typecheck`
  - Result: passed.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts`
  - Interim result: failed while adapting the browser suite. Failures were
    selector/timing issues introduced by the test updates, not accepted
    product-contract failures. They were fixed before final verification.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts -g "edits a saved prediction before kickoff"`
  - Result: passed, 1 test.
- `meteor npm run test:unit`
  - Result: passed, 94 tests across 10 files.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts`
  - Final result: passed, 8 tests.
- `meteor npm run lint:project`
  - Result: passed.
- `meteor npm run format:check`
  - Result: failed on unrelated existing formatting issues listed in Known
    Unrelated Failures.
- `meteor npm exec prettier -- --check imports/ui/pages/PredictionEntryPage.tsx tests/e2e/predictions.spec.ts tests/unit/predictions.test.ts docs/CORE_Predictions.md docs/PLATFORM_Predictions.md docs/PLATFORM_Testing.md docs/MAP_System.md docs/AUDIT_006B_Prediction_UI_Refinement.md docs/TEMP_006B_Resume.md`
  - Result: passed for all CCPP-006B changed files.
- `meteor npm run lint`
  - Result: passed.
- `git diff --check`
  - Result: passed.
- `zip -r rugby-rooster-ccpp006b-prediction-ui-refinement-eomd-20260915.zip ...`
  - Result: passed; archive created/refreshed from an explicit file list.
- `unzip -l rugby-rooster-ccpp006b-prediction-ui-refinement-eomd-20260915.zip`
  - Result: passed; archive contents inspected.

## Final Verification

- Focused prediction unit file: passed, 6 tests.
- Full unit suite: passed, 94 tests.
- Focused prediction browser spec: passed, 8 tests.
- TypeScript: passed.
- ESLint: passed.
- Project invariant check: passed.
- Repo-wide formatting: failed only on unrelated existing files; changed-file
  formatting check passed.
- Whitespace diff check: passed.

## Known Unrelated Failures

`meteor npm run format:check` still reports unrelated formatting issues in:

- `docs/AUDIT_004A_Database_Isolation_Verification.md`
- `docs/AUDIT_004A_Login_Navigation_Fix.md`
- `imports/server/auth/mongoConnectionIdentity.ts`
- `imports/shared/auth/testDatabaseIdentity.ts`
- `playwright.config.ts`
- `scripts/test-environment.mjs`
- `tests/unit/test-launchers.test.ts`

Those files were not edited for CCPP-006B. The known deferred full-auth
browser-suite navigation issue was not investigated.

## Review Archive

- `rugby-rooster-ccpp006b-prediction-ui-refinement-eomd-20260915.zip`
- Contents were inspected with `unzip -l`.
- The archive includes changed source, changed tests, changed docs, this audit,
  the resume checkpoint, and small unchanged shared scoring/prediction context.
- The archive excludes secrets, local settings, dependencies, Meteor local state,
  generated builds, caches, and unrelated archives.
