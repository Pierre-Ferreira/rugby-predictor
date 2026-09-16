# CCPP-007 Resume Checkpoint

## Milestone Scope

CCPP-007 replaces the current all-at-once standard React prediction form with a
guided, question-by-question standard prediction experience.

In scope:

- Intro screen outside numbered prediction progress.
- Declarative built-in prediction sequence for enabled standard questions.
- Shared sequence/message configuration usable by future presentation layers.
- Stable per-session message variant selection without server persistence.
- One shared prediction form state across Intro, steps, Review, Edit, and submit.
- Running predicted rugby match scores using existing shared scoring helpers.
- Result/score consistency warning after score-producing questions are complete.
- First-try consistency constraints derived from predicted tries.
- Review screen with Edit navigation and final submit/revise.
- Focused unit/browser tests and documentation.

Out of scope:

- Kaplay, animation, sprites, reduced-motion switching, lazy loading, and runtime
  animation fallback.
- Custom-question schemas, persistence, admin CRUD, official-answer entry,
  settlement, scoring, prediction storage changes, or admin configuration.
- Optional-question admin controls.
- Scoring-rule changes.
- Result administration, live match lifecycle, leaderboards, leagues, venues,
  sponsorships, quizzes, AI, service workers, and auth redesign.

## Repository And Docs Inspected

- `AGENTS.md`
- `docs/CORE_Predictions.md`
- `docs/PLATFORM_Predictions.md`
- `docs/CORE_Scoring_Rules.md`
- `docs/CORE_Build_Plan.md`
- `docs/PLATFORM_Testing.md`
- `docs/MAP_System.md`
- `imports/ui/pages/PredictionEntryPage.tsx`
- `imports/shared/scoring/derived.ts`
- `imports/shared/scoring/rulesets.ts`
- `imports/shared/scoring/types.ts`
- `imports/shared/scoring/validation.ts`
- `imports/shared/predictions/validation.ts`
- `imports/server/predictions/server.ts`
- `tests/unit/predictions.test.ts`
- `tests/e2e/predictions.spec.ts`
- `rugby-rooster-ccpp007-standard-sequential-predictions-eomd-20260916.zip`

## Implementation Plan

1. Add shared sequence/message modules under `imports/shared/predictions/`.
2. Keep scoring, validation, and deduction rates sourced from existing scoring
   ruleset snapshots and helper functions.
3. Refactor `PredictionEntryPage.tsx` around active sequence items, current
   location (`intro`, numbered step ID, `review`), and shared form state.
4. Add reusable standard UI pieces for progress, step shell, choice controls,
   team numeric controls, consistency warnings, and Review sections.
5. Preserve existing submit/revise/reload/conflict/read-only semantics.
6. Add focused unit tests for sequence/message architecture and browser tests for
   navigation, scoring steps, consistency, first-try constraints, existing entry
   editing, and regression behavior.
7. Update durable docs, create CCPP-007 audit, run checks, and create review zip.

## Sequence Architecture Selected

Planned architecture:

- Built-in step definitions expose stable IDs, kinds, required ruleset question
  IDs, review section IDs, and message IDs.
- `activePredictionSteps(ruleset)` returns the ordered enabled numbered steps.
- Navigation/progress/review consume the active ordered list instead of hard-coded
  totals.
- Intro and Review are outside numbered progress.
- Future optional or custom question milestones can append or insert sequence
  items without rewriting progress/navigation/review, but CCPP-007 will not
  define custom-question persistence, scoring, settlement, or admin config.

## Files Changed

- `docs/TEMP_007_Resume.md` (created)
- `imports/shared/scoring/derived.ts`
- `imports/shared/predictions/index.ts`
- `imports/shared/predictions/sequence.ts`
- `imports/shared/predictions/messages.ts`
- `imports/ui/predictions/standardPredictionState.ts`
- `imports/ui/pages/PredictionEntryPage.tsx`
- `tests/unit/prediction-sequence.test.ts`
- `tests/e2e/predictions.spec.ts`

## Steps Completed

- Confirmed working tree was clean before CCPP-007 changes.
- Read required prediction/scoring/testing/system docs.
- Inspected current prediction page, scoring helpers, validation, and tests.
- Created this early checkpoint before substantial implementation changes.
- Added shared built-in prediction sequence definitions and navigation helpers.
- Added shared prediction message catalog with stable variant selection,
  ruleset-derived deduction text, and team-name interpolation support.
- Exposed the existing rugby-score component values from the shared scoring
  helper and used them in `deriveTeamScore`.
- Refactored `/games/:fixtureId/predict` into the guided standard sequence:
  Intro, active numbered steps, result warnings, Review, Edit, Return to Review,
  submit/revise, reload, conflict handling, and read-only saved display.
- Added focused unit coverage for sequence/message/state helpers.
- Replaced the focused prediction browser spec with sequential-flow coverage.

## Tests Already Run

- `meteor npm run typecheck` - passed.
- `meteor npm run test:unit -- --run tests/unit/prediction-sequence.test.ts` -
  passed `1` file and `8` tests.
- `meteor npm run test:unit` - passed `11` files and `102` tests.
- `meteor npm run lint` - passed after removing an unnecessary synchronous
  state update from an effect.
- `meteor npm run lint:project` - passed.
- `meteor npm run test:integration` - passed `49` server tests.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts -g "updates running rugby scores"` -
  passed `1` Chromium test.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts` - first run
  passed `8` tests and failed `1` selector assertion because text `20` also
  appeared in the kickoff date; the selector was tightened.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts` - rerun passed
  `9` Chromium tests.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts -g "shows persisted saved entry"` -
  passed `1` Chromium test after raising the prediction spec timeout to cover
  its two-browser-context setup.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts` - final rerun
  passed `9` Chromium tests.
- `meteor npm run format:check` - failed on seven unrelated pre-existing files:
  `docs/AUDIT_004A_Database_Isolation_Verification.md`,
  `docs/AUDIT_004A_Login_Navigation_Fix.md`,
  `imports/server/auth/mongoConnectionIdentity.ts`,
  `imports/shared/auth/testDatabaseIdentity.ts`, `playwright.config.ts`,
  `scripts/test-environment.mjs`, and `tests/unit/test-launchers.test.ts`.
- Changed-file Prettier check for CCPP-007 code/tests/docs - passed.
- `unzip -l rugby-rooster-ccpp007-standard-sequential-predictions-eomd-20260916.zip` -
  listed 22 archived files.
- `ls -l rugby-rooster-ccpp007-standard-sequential-predictions-eomd-20260916.zip imports/ui/pages/PredictionEntryPage.tsx imports/shared/predictions/sequence.ts docs/AUDIT_007_Standard_Sequential_Predictions.md` -
  confirmed the archive exists and originals remain present.

## Remaining Work

- Update docs and create audit.
- None for CCPP-007 implementation. Final response still needs to report
  outcome and verification.

## Explicitly Out Of Scope

Kaplay, animations, custom-question persistence/admin/scoring, optional-question
admin controls, scoring-rule changes, settlement/result administration,
leaderboards, leagues, sponsorships, quizzes, AI, service-worker caching, auth
redesign, fixture CRUD redesign, and unrelated milestone refactors.

## Unresolved Product Questions Preserved

- Exact treatment of second-yellow dismissals and card upgrades unless already
  resolved by canonical docs.
- Future balancing when fixtures can contain different counts or weights of
  optional/custom questions.
- Future limits/bounds on configurable custom deductions.
- Future official-answer/settlement workflow for custom questions.
