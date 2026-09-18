# AUDIT 009A Shared Prediction Session

## Scope

CCPP-009A extracted the editable prediction session and renderer-facing
contract, then connected the existing Standard React presentation to that
contract. Rugby Rooster remains separate from Rugby Tracker / Rucks and Mauls.

This milestone did not implement Kaplay, canvas rendering, animations, renderer
switching, animation preferences, fallback machinery, browser draft
persistence, scoring changes, result changes, fixture administration changes,
authentication changes, service workers, or leaderboards.

## Implementation Summary

- Added `imports/ui/predictions/predictionSession.ts` as the shared editable
  prediction session owner.
- Kept route parsing, authentication/loading states, fixture subscriptions,
  unavailable-fixture handling, and locked/cancelled persisted saved-entry
  display in `imports/ui/pages/PredictionEntryPage.tsx`.
- Connected the existing Standard presentation to
  `PredictionSessionRendererState` and `PredictionSessionActions`.
- Preserved the existing Standard structure, styling, labels, controls, Review
  sections, Edit actions, discard/conflict UI, and submit/revise buttons.
- Kept one authoritative mutable `PredictionFormState` for built-in and custom
  answers.
- Moved session-owned navigation guards, message variant ownership, dirty-state
  comparison, discard/reload behavior, captured expected revision, submission
  feedback, duplicate submit guard, and stale session response guard into the
  session module.
- Kept read-only kickoff/cancel display rendering from persisted entry data
  rather than dirty local answers.
- Added focused unit coverage for the shared action/state contract and
  renderer-consumer replacement using the real session reducer/derivation.
- Recorded the current repository asset inventory in
  `docs/MAP_Rooster_Assets.md`.

## Files Changed

- `imports/ui/predictions/predictionSession.ts`
- `imports/ui/pages/PredictionEntryPage.tsx`
- `tests/unit/prediction-session.test.ts`
- `docs/PLATFORM_Prediction_Session.md`
- `docs/MAP_Rooster_Assets.md`
- `docs/CORE_Predictions.md`
- `docs/PLATFORM_Predictions.md`
- `docs/PLATFORM_Prediction_Sequence.md`
- `docs/CORE_Build_Plan.md`
- `docs/PLATFORM_Testing.md`
- `docs/MAP_System.md`
- `docs/TEMP_009A_Resume.md`
- `docs/AUDIT_009A_Shared_Prediction_Session.md`

## Behavior Notes

- Account/fixture identity determines the editable session lifetime.
- Current step, message variant, presentation type, reactive entry revision,
  and kickoff timestamp do not recreate the session.
- Reactive entry updates can show changed-entry state and update the persisted
  comparison source, but they do not overwrite dirty local answers or advance
  the captured expected revision.
- Successful save and explicit load-latest/discard are the accepted paths that
  update the captured revision.
- Blank custom Number answers remain blank strings until valid input is entered
  or submission payload construction validates them.
- A renderer cannot bypass known Continue guards by calling the Continue action
  directly.
- Renderer replacement preserves answers, location, Review edit context,
  message variants, captured revision, conflict state, and submission state
  because those values are owned above the renderer subtree.

## Asset Inventory

The repository currently contains app icon assets only:

- `public/favicon.svg`
- `public/icons/apple-touch-icon.png`
- `public/icons/rr-icon-192.png`
- `public/icons/rr-icon-512.png`
- `public/icons/rr-icon-source.svg`
- `public/icons/rr-maskable-512.png`
- `public/icons/rr-maskable-source.svg`

No Rooster expression sheets, shove storyboards, transparent poses, runtime
sprite frames, or atlases were found. Missing run/push/shove animation assets
remain a future visual-stage requirement and do not block 009A.

## Tests And Checks

| Check                                                                                                                                                                                                                                                                                       | Result                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meteor npm run typecheck`                                                                                                                                                                                                                                                                  | Passed after the extraction. Existing npm `nodedir` warning emitted.                                                                                                               |
| `meteor npm run test:unit -- tests/unit/prediction-session.test.ts`                                                                                                                                                                                                                         | Passed: 1 file, 6 tests. Existing npm `nodedir` warning emitted.                                                                                                                   |
| `meteor npm run test:unit -- tests/unit/prediction-session.test.ts tests/unit/prediction-sequence.test.ts tests/unit/predictions.test.ts`                                                                                                                                                   | Passed: 3 files, 37 tests. Existing npm `nodedir` warning emitted.                                                                                                                 |
| `meteor npm run typecheck`                                                                                                                                                                                                                                                                  | Passed again after unit coverage. Existing npm `nodedir` warning emitted.                                                                                                          |
| `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts -g "guides Intro\|warns after score-building\|submits valid predictions\|discards dirty saved\|answers custom Number\|discards unsaved custom\|edits a saved prediction\|shows persisted saved entry\|preserves unsaved answers"` | Passed: 9 Chromium tests in about 2.5 minutes. Existing npm `nodedir` and `NO_COLOR`/`FORCE_COLOR` warnings emitted.                                                               |
| `meteor npm exec prettier -- --write <changed files>`                                                                                                                                                                                                                                       | Passed and formatted changed code/docs. Existing npm `nodedir` warning emitted.                                                                                                    |
| `meteor npm run test:unit -- tests/unit/prediction-session.test.ts tests/unit/prediction-sequence.test.ts tests/unit/predictions.test.ts`                                                                                                                                                   | Final run passed: 3 files, 37 tests. Existing npm `nodedir` warning emitted.                                                                                                       |
| `meteor npm run typecheck`                                                                                                                                                                                                                                                                  | Final run passed. Existing npm `nodedir` warning emitted.                                                                                                                          |
| `meteor npm exec prettier -- --check <changed files>`                                                                                                                                                                                                                                       | Passed. Existing npm `nodedir` warning emitted.                                                                                                                                    |
| `git diff --check`                                                                                                                                                                                                                                                                          | Passed.                                                                                                                                                                            |
| `meteor npm run lint:project`                                                                                                                                                                                                                                                               | Passed. Existing npm `nodedir` warning emitted.                                                                                                                                    |
| `meteor npm run lint`                                                                                                                                                                                                                                                                       | Initial final run failed on React Hooks ref-access lint in `predictionSession.ts`; fixed by moving ref updates into effects. Rerun passed. Existing npm `nodedir` warning emitted. |
| `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts -g "guides Intro\|warns after score-building\|submits valid predictions\|discards dirty saved\|answers custom Number\|discards unsaved custom\|edits a saved prediction\|shows persisted saved entry\|preserves unsaved answers"` | Final rerun after the lint fix passed: 9 Chromium tests in about 2.3 minutes. Existing npm `nodedir` and `NO_COLOR`/`FORCE_COLOR` warnings emitted.                                |

## Out Of Scope

- Kaplay runtime, canvas, scenes, animation, sprites, sprite atlases, visual
  production, renderer switching, fallback machinery, and animation preferences.
- Browser draft persistence or autosave.
- Prediction server API redesign, revision scheme changes, or persistence shape
  changes.
- Scoring rules, result settlement, leaderboards, fixture administration,
  authentication, Postmark, PWA/service-worker work, or UI redesign.

## Review Archive

Created and inspected:

- `rugby-rooster-ccpp009a-shared-prediction-session-eomd-20260917.zip`

Archive inspection listed 23 intended files: the shared session source, Standard
route/renderer source, relevant prediction helpers and submission context,
focused unit/browser tests, updated/new docs, audit, and resume checkpoint. The
archive excludes credentials, settings, `node_modules`, `.meteor/local`, caches,
and generated test/build output. Original repository files were verified still
present after ZIP creation.
