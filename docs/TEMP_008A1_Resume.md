# TEMP 008A1 Resume

## Scope

CCPP-008A1 is a narrow prediction-edit UX refinement after accepted CCPP-008A.
The required work is limited to player-facing wording for the saved-entry
replacement action, a safe discard confirmation when local prediction edits are
dirty, conflict-specific recovery wording, focused tests, documentation, and a
review archive.

## Files Inspected

- `AGENTS.md`
- `docs/CORE_Predictions.md`
- `docs/PLATFORM_Predictions.md`
- `docs/PLATFORM_Prediction_Sequence.md`
- `docs/PLATFORM_Testing.md`
- `imports/ui/pages/PredictionEntryPage.tsx`
- `package.json`
- `tests/e2e/predictions.spec.ts`
- `tests/unit/predictions.test.ts`
- `tests/unit/prediction-sequence.test.ts`
- `imports/server/predictions/server.ts`

## Files Changed

- `docs/CORE_Predictions.md`
- `docs/PLATFORM_Predictions.md`
- `docs/PLATFORM_Prediction_Sequence.md`
- `docs/PLATFORM_Testing.md`
- `docs/AUDIT_008A1_Prediction_Discard_UX.md`
- `docs/TEMP_008A1_Resume.md`
- `imports/server/predictions/server.ts`
- `imports/ui/pages/PredictionEntryPage.tsx`
- `imports/ui/predictions/standardPredictionState.ts`
- `tests/e2e/predictions.spec.ts`
- `tests/unit/prediction-sequence.test.ts`

## Dirty-State Approach

Implemented with `predictionFormsEqual(...)` in
`imports/ui/predictions/standardPredictionState.ts`.

The prediction page projects the latest persisted entry, or a blank form when
there is no entry, through the existing `formFromPrediction(...)`,
`emptyFormForRuleset(...)`, and `normalizeInitialPredictionForm(...)` helpers.
It compares that persisted-form projection with the current editable
`PredictionFormState`.

The comparison covers:

- match result;
- tries, conversions, penalty kicks, drop goals;
- yellow and red cards;
- first try, highest-scoring half, and half-time leader;
- custom Number and Choice answers by custom question ID.

It intentionally ignores transient presentation state such as current sequence
location, selected message variants, feedback, and notices.

## Wording Changes

- Normal review action: `Discard changes`
- Clean normal review state: `Discard changes` is disabled.
- Dirty confirmation: `Discard your unsaved changes and restore the last saved prediction?`
- Confirmation actions: `Keep editing` and `Discard changes`
- Conflict recovery action: `Load latest saved prediction`
- Nearby player-facing revision wording changed from the technical saved-entry
  revision sentence to `You're editing your saved prediction.`
- Server conflict text now says `Load the latest saved prediction` instead of
  `Reload the saved entry`.

## Tests And Checks Run

- `meteor npm run test:unit -- tests/unit/prediction-sequence.test.ts`
  - Passed: 1 file, 20 tests.
- `meteor npm run test:unit -- tests/unit/predictions.test.ts tests/unit/prediction-sequence.test.ts`
  - Passed: 2 files, 31 tests.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts -g "submits valid predictions"`
  - Passed: 1 browser test covering the clean saved Review state, disabled
    `Discard changes`, and absence of the old reload-label button.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts -g "discards dirty saved|discards unsaved custom|stale revision conflict"`
  - Passed: 3 browser tests covering dirty built-in discard confirmation,
    custom Number/Choice discard restoration, stale conflict wording, explicit
    latest-saved loading, and revision/no-write probes.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts -g "discards dirty saved|dirty local values lock|stale revision conflict"`
  - Passed: 3 browser tests during stabilization, including the existing locked
    persisted display coverage.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts -g "answers custom Number and Choice questions"`
  - Passed: 1 browser test during stabilization.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts`
  - Final full focused prediction-spec attempt: 14 passed, 1 failed in existing
    custom-fixture setup while waiting for `window.Meteor.call` during admin
    helper login. The failed setup path passed separately with the focused
    custom sequence command above; the CCPP-008A1 discard/conflict tests passed
    in targeted runs.
- `meteor npm run typecheck`
  - Passed.
- `meteor npm run lint`
  - Passed.
- `meteor npm run lint:project`
  - Passed.
- `meteor npm exec prettier -- --check <changed files>`
  - Passed.
- `git diff --check`
  - Passed.

All npm/Meteor commands emitted the existing npm warning about unknown env config
`nodedir`.

## Remaining Work

None for CCPP-008A1.

## Review Archive

Created and inspected:

- `rugby-rooster-ccpp008a1-prediction-discard-ux-eomd-20260917.zip`

Archive contents are limited to changed prediction UI/session source, relevant
prediction conflict source, changed/new tests, changed prediction docs, and the
008A1 audit/resume docs.

## Explicit Out Of Scope

- Prediction revision model redesign.
- Prediction persistence shape changes.
- Custom-question model changes.
- Scoring, result settlement, leaderboards, Kaplay, animations, fixture
  management, authentication, Postmark, admin result entry, or custom-question
  administration.
- CCPP-008B result work.
