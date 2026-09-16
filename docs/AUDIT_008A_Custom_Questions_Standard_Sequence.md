# AUDIT 008A - Custom Questions In The Standard Sequence

## Scope

CCPP-008A makes published custom Number and Choice questions answerable in the
Standard React prediction sequence.

Implemented:

- custom Number and Choice steps after active built-in standard steps;
- dynamic progress/navigation totals including custom questions;
- `customAnswers` capture in the existing prediction entry;
- Review, Edit, revisit, and locked read-only display for custom answers;
- server validation against the fixture's frozen published ruleset snapshot;
- custom question publication support and removal of the temporary CCPP-008
  custom publish gate;
- positive-only custom deductions;
- admin projected player-step count derived from `activePredictionSteps(...)`;
- focused unit, Meteor integration, and browser coverage;
- product/platform documentation updates.

Not implemented:

- official custom answers;
- custom settlement/result capture;
- scoring custom predictions against actual custom answers;
- score balancing/normalization across fixtures;
- leaderboards;
- Kaplay custom screens.

## Domain And Type Changes

`imports/shared/scoring/types.ts` now carries player-safe custom metadata on
custom ruleset questions:

- prompt;
- optional banter/context;
- counting definition;
- order;
- Number min/max and rate;
- Choice option IDs/labels and incorrect deduction.

`imports/shared/scoring/validation.ts` validates this metadata in ruleset
snapshots and validates custom prediction answers against enabled custom
questions. Custom Number answers must be finite safe integers within the frozen
min/max range. Custom Choice answers must match one frozen option ID.

`imports/shared/predictionQuestions/configuration.ts` now projects valid custom
question config into the published ruleset snapshot as `custom-numeric` and
`custom-categorical` scoring-domain questions.

## Deduction Positivity Fix

Custom Number `deductionPerUnit` and Custom Choice `incorrectDeduction` now use
positive safe integer validation. Zero and negative custom deductions are
rejected in shared validation, admin save/publication paths, and tests. The
admin UI now creates custom questions with positive default deductions and uses
`min=1` for custom deduction inputs.

No silent coercion is performed. Existing drafts with zero deductions must be
corrected before save or publication.

## Sequence Changes

`imports/shared/predictions/sequence.ts` now models:

- built-in step definitions;
- dynamic custom steps with IDs shaped as `custom:<questionId>`;
- `activeCustomQuestions(ruleset)`;
- `editStepIdForCustomQuestion(...)`.

The active order is:

1. active built-in standard steps;
2. active custom questions ordered by the frozen custom `order`;
3. Review, outside numbered progress.

Intro remains outside numbered progress.

## Review Changes

`imports/ui/pages/PredictionEntryPage.tsx` renders custom Number and Choice
steps from the frozen snapshot. Custom prompts are fixture-authored, so they do
not use randomized message variants. The view shows frozen prompt, optional
banter/context, standardized deduction text, and `What counts` helper content.

Review now includes a `CUSTOM QUESTIONS` section only when custom questions are
active. Number answers display as numeric values. Choice answers resolve the
saved option ID back to the frozen option label. Edit buttons return to the
specific custom step. Locked/read-only display receives no edit actions and
uses the persisted entry via the existing read-only saved-entry path.

## Publication And Data Boundary Changes

The temporary CCPP-008 server publish gate was removed from
`fixtures.admin.publish`.

Publication now validates the full custom config by building a scoring snapshot.
Valid custom questions freeze prompt, banter/context, counting definition,
answer type, ranges, option IDs/labels, deductions, and order into
`rulesetSnapshot`.

Public fixture list/detail publications still do not expose
`predictionQuestionConfig` or `rulesetSnapshot`. The verified prediction route
receives the published fixture context and frozen `rulesetSnapshot` through the
existing `predictions.fixtureContext` publication.

## Submission And Server Validation

The submission envelope remains narrow:

- `fixtureId`;
- `prediction`;
- optional `expectedRevision`.

Custom answers live under `prediction.customAnswers`, keyed by stable custom
question ID. The server rejects unknown top-level fields, unknown custom answer
IDs, missing custom answers, wrong custom answer types, out-of-range Number
answers, non-integer Number answers, invalid Choice option IDs, and injected
custom definitions/deductions/labels.

Ownership remains server-derived from the authenticated invocation. Revision
updates remain atomic and stale custom-answer revisions use the existing
`prediction-conflict` path.

## Admin Projected Step Count

The admin question configurator no longer counts enabled scoring rules as
player steps. It now derives the displayed projected player step count from
`activePredictionSteps(buildConfiguredRulesetSnapshot(form))`. This avoids
counting Yellow Cards and Red Cards as separate player screens and avoids
counting `team-score` as an entered prediction step.

## Tests And Checks

- `meteor npm run typecheck`
  - Passed after implementation/test updates and again after formatting.

- `meteor npm run test:unit -- tests/unit/prediction-questions.test.ts tests/unit/prediction-sequence.test.ts tests/unit/predictions.test.ts tests/unit/scoring-engine.test.ts`
  - Passed: 4 files, 68 tests.

- `meteor npm run test:unit`
  - Passed: 12 files, 127 tests.

- `meteor npm run test:integration -- --grep "CCPP-005 fixture management|CCPP-006 prediction submission"`
  - Passed: 58 server tests.
  - The integration launcher also ran auth helper/account suites in this
    invocation because of grep forwarding; all included tests passed.

- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts -g "answers custom Number and Choice"`
  - First run failed because the final custom Choice step correctly uses
    `Review predictions` instead of `Continue`.
  - Rerun passed: 1 Chromium test.

- `meteor npm run test:e2e -- tests/e2e/fixtures.spec.ts -g "configures draft prediction questions"`
  - Early reruns failed while asserting browser UI zero-deduction feedback in
    the existing admin flow. Positive custom deduction coverage remains in unit
    and integration tests; the browser test now focuses on saved config,
    projected player step count, conflict preservation, and Reload.
  - Final rerun passed: 1 Chromium test.

- `meteor npm run lint`
  - Passed.

- `meteor npm run lint:project`
  - Passed.

- `meteor npm exec prettier -- --write <CCPP-008A changed files>`
  - Completed.

- `meteor npm exec prettier -- --check <CCPP-008A changed files>`
  - Passed.

- `meteor npm run format:check`
  - Failed only on seven unrelated historical files:
    - `docs/AUDIT_004A_Database_Isolation_Verification.md`
    - `docs/AUDIT_004A_Login_Navigation_Fix.md`
    - `imports/server/auth/mongoConnectionIdentity.ts`
    - `imports/shared/auth/testDatabaseIdentity.ts`
    - `playwright.config.ts`
    - `scripts/test-environment.mjs`
    - `tests/unit/test-launchers.test.ts`

- `git diff --check`
  - Passed.

## Known Unrelated Failures

- Repository-wide `format:check` still fails on the seven unrelated historical
  files listed above. CCPP-008A changed-file Prettier check passed.

## Settlement And Balancing Deferrals

Custom predictions are captured now but not settled. No official custom answers,
pending/settled/void workflow, custom scoring against actual answers, custom
leaderboard behavior, or score normalization was added.

Fixtures may still vary by optional/custom question count and deduction weight.
CCPP-008A does not change the 10,000 starting score, zero floor, or any
cross-fixture balancing policy.

## Review Archive

Created:

- `rugby-rooster-ccpp008a-custom-questions-standard-sequence-eomd-20260916.zip`

The archive was built from explicit source, test, and documentation paths.
`unzip -l` listed 32 files. Originals remained present after archive creation.
