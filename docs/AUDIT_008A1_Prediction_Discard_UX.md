# AUDIT 008A1 Prediction Discard UX

## Scope

CCPP-008A1 refined the accepted prediction edit/review replacement action
without redesigning prediction persistence, revision handling, custom questions,
authentication, fixtures, or the guided sequence.

Required outcomes:

- Normal editable Review action uses `Discard changes`.
- Clean Review state disables discard.
- Dirty Review state confirms before replacing unsaved local answers.
- Stale conflict recovery uses `Load latest saved prediction`.
- Existing replacement semantics continue to restore the latest persisted
  prediction and captured revision without creating a new revision.

## Implementation Summary

- Added `predictionFormsEqual(...)` to compare the answer-bearing
  `PredictionFormState` fields only.
- Normalized the latest persisted entry through the existing form helpers before
  dirty-state comparison.
- Added inline Review confirmation with `Keep editing` and `Discard changes`.
- Kept conflict recovery direct and labelled it `Load latest saved prediction`.
- Disabled normal `Discard changes` while the form matches the loaded persisted
  prediction.
- Updated server conflict copy so the displayed error no longer asks players to
  reload a saved entry.
- Replaced the nearby player-facing saved-entry revision sentence with
  `You're editing your saved prediction.`

## Files Changed

- `imports/ui/pages/PredictionEntryPage.tsx`
- `imports/ui/predictions/standardPredictionState.ts`
- `imports/server/predictions/server.ts`
- `tests/e2e/predictions.spec.ts`
- `tests/unit/prediction-sequence.test.ts`
- `docs/CORE_Predictions.md`
- `docs/PLATFORM_Predictions.md`
- `docs/PLATFORM_Prediction_Sequence.md`
- `docs/PLATFORM_Testing.md`
- `docs/TEMP_008A1_Resume.md`
- `docs/AUDIT_008A1_Prediction_Discard_UX.md`

## Behavior Notes

- Dirty-state detection covers match result, scoring values, cards, standard
  categorical predictions, and custom Number/Choice answers.
- Dirty-state detection ignores sequence location, message variants, feedback,
  and other presentation-only state.
- `Keep editing` leaves local values and current Review context intact and
  performs no server write.
- Confirmed discard restores the latest persisted entry, updates the captured
  revision, and performs no server write.
- Conflict recovery keeps stale local values visible until the player chooses
  `Load latest saved prediction`.

## Tests And Checks

| Check                                                                                                                                  | Result                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meteor npm run test:unit -- tests/unit/prediction-sequence.test.ts`                                                                   | Passed: 1 file, 20 tests.                                                                                                                                                                                                                                                                                                             |
| `meteor npm run test:unit -- tests/unit/predictions.test.ts tests/unit/prediction-sequence.test.ts`                                    | Passed: 2 files, 31 tests.                                                                                                                                                                                                                                                                                                            |
| `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts -g "discards dirty saved\|discards unsaved custom\|stale revision conflict"` | Passed: 3 browser tests.                                                                                                                                                                                                                                                                                                              |
| `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts -g "submits valid predictions"`                                              | Passed: 1 browser test covering clean saved Review, disabled `Discard changes`, and old reload-label absence.                                                                                                                                                                                                                         |
| `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts -g "discards dirty saved\|dirty local values lock\|stale revision conflict"` | Passed: 3 browser tests during stabilization, including the existing locked persisted display coverage.                                                                                                                                                                                                                               |
| `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts -g "answers custom Number and Choice questions"`                             | Passed: 1 browser test during stabilization.                                                                                                                                                                                                                                                                                          |
| `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts`                                                                             | Final full focused prediction-spec attempt: 14 passed, 1 failed in existing custom-fixture setup while waiting for `window.Meteor.call` during admin helper login. The failed setup path was separately run and passed with the focused custom sequence command above; the CCPP-008A1 discard/conflict tests passed in targeted runs. |
| `meteor npm run typecheck`                                                                                                             | Passed.                                                                                                                                                                                                                                                                                                                               |
| `meteor npm run lint`                                                                                                                  | Passed after replacing a synchronous state-setting effect with event-driven confirmation closing.                                                                                                                                                                                                                                     |
| `meteor npm run lint:project`                                                                                                          | Passed.                                                                                                                                                                                                                                                                                                                               |
| `meteor npm exec prettier -- --check <changed files>`                                                                                  | Passed.                                                                                                                                                                                                                                                                                                                               |
| `git diff --check`                                                                                                                     | Passed.                                                                                                                                                                                                                                                                                                                               |

All npm/Meteor commands emitted the existing npm warning about unknown env config
`nodedir`.

## Review Archive

Created and inspected:

- `rugby-rooster-ccpp008a1-prediction-discard-ux-eomd-20260917.zip`

The archive contains 11 explicit files: changed prediction UI/session source,
the relevant prediction conflict source, changed tests, changed prediction docs,
and the CCPP-008A1 audit/resume docs. It excludes settings, secrets,
`node_modules`, `.meteor/local`, generated builds, caches, and unrelated
archives.

## Out Of Scope

- Prediction revision model redesign.
- Prediction persistence shape changes.
- Custom-question model changes.
- Scoring, result settlement, leaderboards, Kaplay, animations, fixture
  management, authentication, Postmark, admin result entry, or custom-question
  administration.
- CCPP-008B result work.
