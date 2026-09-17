# CCPP-008B1 Resume Checkpoint

## Scope

Narrow corrective milestone for CCPP-008B:

- add raw observation-envelope validation before lifecycle normalization;
- reject unknown raw statuses, built-in Void, custom Void with values, and
  unknown nested observation fields;
- preserve server-owned provisional/final lifecycle normalization and accepted
  custom Void behavior;
- fix read-only cancelled-provisional result wording so provisional results are
  not labelled confirmed.

Explicitly out of scope: match-result architecture redesign, observation
lifecycle redesign, custom Void redesign, scoring changes, result concurrency
redesign, authorization redesign, prediction entries, player score persistence,
leaderboards, Kaplay, live events, fixture redesign, auth redesign, Postmark,
leagues, sponsorships, quizzes, and AI.

## Files Inspected

- `AGENTS.md`
- `docs/CORE_Match_Results.md`
- `docs/PLATFORM_Match_Results.md`
- `docs/PLATFORM_Testing.md`
- `docs/TEMP_008B_Resume.md`
- `docs/AUDIT_008B_Match_Results_Settlement.md`
- `imports/shared/matchResults/validation.ts`
- `imports/shared/scoring/validation.ts`
- `imports/server/matchResults/server.ts`
- `imports/server/matchResults/matchResults.app-test.ts`
- `imports/ui/pages/AdminFixtureResultsPage.tsx`
- `tests/e2e/results.spec.ts`
- `tests/unit/scoring-engine.test.ts`
- `tests/unit/match-results.test.ts`
- `package.json`

## Raw Validation Approach

Implemented in `imports/shared/matchResults/validation.ts` before lifecycle
normalization:

1. validate raw observation object keys and incoming statuses before
   normalization;
2. allow custom Void only for known active custom Number/Choice observations and
   only without `value`;
3. reject unknown nested fields before normalization can drop them;
4. then run existing `normalizeResultObservations(...)` and authoritative
   observation validation unchanged.

Allowed incoming non-void observation statuses are `pending`, `provisional`,
and `confirmed`; final persisted lifecycle still comes from the method mode.
Custom observations additionally allow `void` with no `value`. Built-in
observations reject `void`.

## Files Changed

- `docs/TEMP_008B1_Resume.md`
- `imports/shared/matchResults/validation.ts`
- `imports/server/matchResults/matchResults.app-test.ts`
- `imports/ui/pages/AdminFixtureResultsPage.tsx`
- `tests/unit/match-results.test.ts`
- `tests/e2e/results.spec.ts`
- `docs/CORE_Match_Results.md`
- `docs/PLATFORM_Match_Results.md`
- `docs/PLATFORM_Testing.md`
- `docs/AUDIT_008B1_Raw_Observation_Validation.md`

## Tests Run / Results

Passed:

- `meteor npm run test:unit -- tests/unit/match-results.test.ts tests/unit/scoring-engine.test.ts`
  - 2 files, 35 tests passed.
- `meteor npm run test:integration -- --grep "match result administration"`
  - 67 server tests passed.
- `meteor npm run test:e2e -- tests/e2e/results.spec.ts`
  - final rerun: 3 Chromium tests passed.
- `meteor npm run typecheck`
  - final post-format rerun passed.
- `meteor npm run lint`
- `meteor npm run lint:project`
- Changed-file Prettier check with `meteor npm exec prettier -- --check <changed files>`
- `git diff --check`
- Review ZIP created and inspected:
  `rugby-rooster-ccpp008b1-raw-observation-validation-eomd-20260917.zip`
  contains 12 expected files, and the original files remain present.

Failed:

- `meteor npm run format:check`
  - unrelated older files still reported by repo-wide Prettier:
    `docs/AUDIT_004A_Database_Isolation_Verification.md`,
    `docs/AUDIT_004A_Login_Navigation_Fix.md`,
    `imports/server/auth/mongoConnectionIdentity.ts`,
    `imports/shared/auth/testDatabaseIdentity.ts`, `playwright.config.ts`,
    `scripts/test-environment.mjs`, and `tests/unit/test-launchers.test.ts`.

Interim browser reruns failed while hardening local test-token retry behavior,
making the cancelled-result setup deterministic, and tightening score text
selectors. Final focused browser run passed.

## Read-Only Label Fix Status

Implemented in `ReadOnlyResultSummary`: confirmed results render `Confirmed
result summary`; read-only provisional results render `Provisional result
summary`.

## Remaining Work

- None for CCPP-008B1 after final status check.

## Explicit Out Of Scope

No player scoring, leaderboard, ranking, winners, score jobs, public live
deductions, live event capture, live match lifecycle, Kaplay, sprites, platform
UI redesign, result correction/reopen workflow, custom-question redesign,
fixture redesign, auth redesign, Postmark, leagues, sponsorships, quizzes, or
AI.
