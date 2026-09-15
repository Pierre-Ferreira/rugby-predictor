# AUDIT 006A - Locked Prediction Display

## Summary

CCPP-006A corrects a client presentation issue in the prediction page. When a
verified player has a saved prediction, changes answers locally without saving,
and the fixture becomes read-only because kickoff passes, the locked "Saved
prediction" display now shows the persisted saved entry instead of dirty local
form values.

The accepted CCPP-006 server contract remains unchanged. This task did not add
autosave, drafts, Kaplay, animation toggles, match results, scoring persistence,
leaderboards, leagues, AI, service-worker caching, authentication changes,
fixture redesign, or HMR changes.

## Implementation Changes

- Updated `imports/ui/pages/PredictionEntryPage.tsx` so
  `ReadOnlyPrediction` derives its review form from `currentEntry.prediction`.
- Removed the mutable edit form from the read-only saved-entry props.
- Preserved the existing no-entry locked state: if no persisted prediction entry
  exists, the locked view does not fabricate one from local form state.
- Preserved existing edit-session behavior: local unsaved answers still remain
  in the edit form during ordinary method failures, stale revision conflicts,
  and reactive entry updates while the fixture remains editable.
- Left server kickoff enforcement, ownership, publication, revision, and ruleset
  validation contracts unchanged.

## Regression Test

Updated `tests/e2e/predictions.spec.ts`:

- The locked-entry browser test now loads persisted prediction A, revisits it,
  changes local form values to unsaved prediction B, keeps the page open, moves
  fixture kickoff to a near-future time through the existing isolated admin test
  path, waits for the page to transition to read-only, and verifies that the
  locked saved display shows persisted score A and not unsaved score B.

## Prediction Presentation Architecture

Updated `docs/CORE_Predictions.md` and `docs/PLATFORM_Predictions.md` to record
the agreed future architecture:

- Rugby Rooster will have a default animated Kaplay prediction experience.
- Rugby Rooster will also have a complete standard non-animated prediction
  experience.
- The standard experience is the resilient fallback for disabled animations,
  reduced-motion preference, unsuitable device/browser capability, Kaplay
  initialization failure, and Kaplay runtime failure.
- Both experiences must share one prediction domain/state model, including
  answers, validation/rules, fixture ruleset snapshot interpretation,
  navigation/step semantics where applicable, and the server submission
  contract.
- Switching or falling back must preserve answers, and successful submission
  must never depend on animation completion.
- Player-facing controls should use animation terminology such as "Animations
  On" and "Animations Off," not implementation terms such as "React mode."

CCPP-006A documents this architecture only. It does not implement Kaplay,
animation controls, capability detection, reduced-motion detection, sprite
loading, lazy-loading, runtime fallback machinery, animation lifecycle, or
hidden-page pausing.

## Files Changed

- `imports/ui/pages/PredictionEntryPage.tsx`
- `tests/e2e/predictions.spec.ts`
- `docs/CORE_Predictions.md`
- `docs/PLATFORM_Predictions.md`
- `docs/PLATFORM_Testing.md`
- `docs/MAP_System.md`
- `docs/AUDIT_006A_Locked_Prediction_Display.md`
- `docs/TEMP_006A_Resume.md`

## Verification

Commands run:

- `git diff --check` - passed.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts --grep "shows persisted saved entry after dirty local values lock at kickoff"` - passed 1 Chromium test.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts` - passed 5 Chromium tests.
- `meteor npm run test:unit -- --run tests/unit/predictions.test.ts` - passed 1 file / 4 tests.
- `meteor npm run typecheck` - passed.
- `meteor npm run lint` - passed.
- `meteor npm run lint:project` - passed; repeated after final audit/map docs were added and still passed.
- `meteor npm run test:integration` - passed 49 server tests.
- `meteor npm run format:check` - failed on seven pre-existing unrelated formatting issues listed below.
- `meteor npm exec prettier -- --check imports/ui/pages/PredictionEntryPage.tsx tests/e2e/predictions.spec.ts docs/CORE_Predictions.md docs/PLATFORM_Predictions.md docs/PLATFORM_Testing.md docs/MAP_System.md docs/AUDIT_006A_Locked_Prediction_Display.md docs/TEMP_006A_Resume.md` - passed.

Observed non-failing command noise:

- npm warned `Unknown env config "nodedir"` during Meteor npm commands.
- Meteor reported that 3.5.2 is available while the project remains on the
  installed/pinned Meteor 3.5.1 release.
- Some Meteor/Playwright subprocesses warned that `NO_COLOR` is ignored because
  `FORCE_COLOR` is set.
- The integration test intentionally logs one mocked passwordless delivery
  failure while verifying error handling.

## Known Unrelated Issues

- The known intermittent full-auth-browser-suite navigation issue remains
  deferred and was not investigated or changed in CCPP-006A.
- Repository-wide `meteor npm run format:check` still reports pre-existing
  unrelated formatting issues in:
  `docs/AUDIT_004A_Database_Isolation_Verification.md`,
  `docs/AUDIT_004A_Login_Navigation_Fix.md`,
  `imports/server/auth/mongoConnectionIdentity.ts`,
  `imports/shared/auth/testDatabaseIdentity.ts`, `playwright.config.ts`,
  `scripts/test-environment.mjs`, and
  `tests/unit/test-launchers.test.ts`. These files were not modified for
  CCPP-006A.

## Review Archive

Created and inspected:

- `rugby-rooster-ccpp006a-locked-prediction-display-eomd-20260915.zip`
