# AUDIT 007A - Ruleset-Aware Prediction Copy And Review Cleanup

## Scope

CCPP-007A was a narrow cleanup of the accepted CCPP-007 standard sequential
prediction experience. It did not redesign the sequence engine, scoring engine,
prediction persistence, authentication, fixtures, routing, Kaplay, custom
questions, admin configuration, settlement, or leaderboards.

## Implementation

- Ruleset-aware deduction copy:
  - `teamNumericDeductionRate(...)` now returns a rate only when the matching
    built-in numeric question is enabled.
  - `categoricalIncorrectDeduction(...)` now returns a deduction only when the
    matching built-in categorical question is enabled.
  - Card deduction/body copy derives from enabled card questions only, so a
    disabled yellow-card or red-card question cannot drive active card copy.

- Review cleanup:
  - Review hides the Cards section when both card questions are disabled.
  - Review hides disabled card rows inside a partially active Cards section.
  - Review hides the Other Predictions section when First Try,
    Highest-Scoring Half, and Half-Time Leader are all disabled.
  - Review row Edit actions continue to resolve through active sequence
    destinations and are not rendered for disabled rows.

- Intro starting-points interpolation:
  - Intro copy is built with `buildPredictionIntroMessage(...)`, defaulting to
    the shared `STARTING_POINTS` scoring configuration and
    `formatPredictionPoints(...)`.
  - The starting-points rule itself was not changed.

- Half-Time wording:
  - Half-Time Leader variants now use:
    - `Who will lead at half-time?`
    - `Who'll be ahead at half-time?`
    - `Who leads at half-time?`
  - Half-Time Leader draw presentation uses `Half-time Draw`.
  - Match Result draw presentation remains `Draw`.

- Result-consistency navigation:
  - Once score/result consistency is known and a warning is active from Drop
    Goals onward, forward step navigation is disabled.
  - Back remains enabled.
  - The warning's Edit match result and Edit scores actions remain enabled.
  - The UI does not silently change selected result or score totals.

## Tests Added Or Changed

- `tests/unit/prediction-sequence.test.ts`
  - Disabled numeric/categorical questions do not supply deduction copy.
  - Partial card enablement uses only enabled card copy.
  - Cards step/edit target behavior follows active card enablement.
  - Optional disabled rows have no edit target.
  - Intro copy can be built from a supplied starting-points value and the
    exported intro uses `STARTING_POINTS`.
  - Half-Time Leader variants use explicit half-time wording.
  - Half-Time Leader `draw` displays `Half-time Draw`; Match Result `draw`
    remains `Draw`.

- `tests/e2e/predictions.spec.ts`
  - Result/score warnings now assert disabled Continue for selected-team versus
    other-team-higher, selected-team versus drawn score, and draw versus unequal
    score cases.
  - Correction paths through Edit match result and Edit scores remain usable and
    re-enable Continue when consistent.
  - Review hides empty Cards and Other Predictions sections for disabled
    ruleset questions.
  - Partial card enablement shows only active card inputs/Review rows and
    active card deduction copy.
  - Existing first-try browser coverage now follows the explicit correction path
    when score changes make the previously selected Draw inconsistent.
  - The isolated fixture browser-test helper accepts
    `disabledBuiltInQuestionIds` for test-only published ruleset snapshots.

## Commands Executed

- `meteor npm run test:unit -- tests/unit/prediction-sequence.test.ts`
  - Passed: 17 tests.

- `meteor npm run test:e2e -- predictions.spec.ts`
  - First run: 9 passed, 3 failed.
  - Failures:
    - two local browser/Meteor readiness/navigation symptoms;
    - one existing first-try test path now blocked by the intended new
      post-drop-goal Continue gate.

- `meteor npm run test:e2e -- predictions.spec.ts -g "applies first-try|preserves unsaved"`
  - Passed: 2 tests after updating the first-try correction path.

- `meteor npm run test:e2e -- predictions.spec.ts`
  - Rerun: 11 passed, 1 failed.
  - Failure: `shows persisted saved entry after dirty local values lock at kickoff`
    timed out waiting for the Intro button before sequence entry.

- `meteor npm run test:e2e -- predictions.spec.ts -g "shows persisted saved entry"`
  - Passed: 1 test, confirming the prior full-spec failure was a local readiness
    timeout rather than a deterministic product regression.

- `meteor npm exec prettier -- --write <CCPP-007A changed files>`
  - Passed; formatted/checkpointed changed files only.

- `meteor npm run test:unit`
  - Passed: 111 tests across 11 files.

- `meteor npm run typecheck`
  - Passed.

- `meteor npm run lint`
  - Passed.

- `meteor npm run lint:project`
  - Passed.

- `meteor npm run format:check`
  - Failed only on seven unrelated pre-existing files:
    - `docs/AUDIT_004A_Database_Isolation_Verification.md`
    - `docs/AUDIT_004A_Login_Navigation_Fix.md`
    - `imports/server/auth/mongoConnectionIdentity.ts`
    - `imports/shared/auth/testDatabaseIdentity.ts`
    - `playwright.config.ts`
    - `scripts/test-environment.mjs`
    - `tests/unit/test-launchers.test.ts`

- `meteor npm exec prettier -- --check <CCPP-007A changed files>`
  - Passed; all CCPP-007A changed files use Prettier style.

- `git diff --check`
  - Passed; no whitespace errors in tracked diff.

- `meteor npm run test:e2e -- predictions.spec.ts`
  - Final full-spec rerun: 11 passed, 1 failed.
  - Failure: existing `edits a saved prediction before kickoff while preserving
other answers` reached saved entry revision 2 with updated Review values but
    timed out waiting for the transient `Prediction updated.` status after a
    local reload/remount.

- `meteor npm run test:e2e -- predictions.spec.ts -g "edits a saved prediction"`
  - Passed: 1 test.

## Review Archive

- Created
  `rugby-rooster-ccpp007a-ruleset-aware-prediction-cleanup-eomd-20260916.zip`
  in the repository root.
- Inspected with `unzip -l`; archive contains 18 files:
  - changed sequential prediction UI source;
  - sequence/message/state/scoring config used for active steps and
    interpolation review;
  - isolated fixture test helper;
  - changed unit and Playwright tests;
  - changed prediction/testing/system docs;
  - `docs/AUDIT_007A_Ruleset_Aware_Prediction_Cleanup.md`;
  - `docs/TEMP_007A_Resume.md`.
- Confirmed originals remain present after packaging.
