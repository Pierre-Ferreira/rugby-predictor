# AUDIT 009B1 Initialization Recovery And Storage Safety

Date: 2026-09-18

## Scope

CCPP-009B1 repairs recovery defects in the CCPP-009B development/test Kaplay
Match Result preview:

- protected acquisition of browser preference storage;
- one host-owned loading attempt from preview-module load through runtime
  readiness;
- genuine outer loader retry after recoverable first-load rejection;
- late runtime handle disposal and stale callback isolation;
- focused regression evidence for dirty saved-session preservation through
  renderer failure.

Standard remains the ordinary experience. Kaplay remains an explicitly enabled
non-production Match Result preview only. No CCPP-009C artwork, shove
animation, remaining question screens, Review animation, scoring, settlement,
authentication, service-worker, or production rollout work was started.

## Implementation Summary

`presentationPreference.ts` now acquires `window.localStorage` inside
`acquireAnimationPreferenceStorage()`. Absence of `window`, a throwing
`localStorage` getter, malformed values, `getItem` failure, and `setItem`
failure all leave prediction entry usable. When persistence is unavailable, the
mounted UI retains the selected Animations On/Off value in memory across
rerenders.

`PredictionPresentationHost.tsx` now owns a complete preview attempt. The
attempt starts its deadline before the preview component loader runs, invokes
the loader through a small injectable boundary, and passes a narrow controller
to `KaplayMatchResultPreview`. Retry creates a new attempt and calls the loader
again instead of reusing a permanently rejected `React.lazy` wrapper.

The host-owned attempt tracks identity, session key, retry version, deadline,
loaded component, runtime-start generation, current runtime handle, and cleanup
state. Readiness clears the deadline. Failure, timeout, cancellation, retry
replacement, unsupported-step handoff, Off, reduced motion, read-only/session
departure, and unmount clear the deadline and dispose any adopted runtime. Late
runtime handles from obsolete attempts are disposed once and are not published
as ready. Late rejections are handled without reviving stale failure UI.

`KaplayMatchResultPreview.tsx` now owns only the DOM/canvas bridge and snapshot
translation. It requests runtime startup through the host controller and keeps
runtime callbacks guarded by both the controller identity and the current
supported Match Result step.

`matchResultRuntime.ts` still performs the actual dynamic `kaplay` import and
engine setup. It now tears down the Kaplay context if setup throws after the
context exists but before a handle is returned.

`test.predictions.currentUserEntry` was added under the existing isolated-test
helper gate. It returns only the signed-in test user's current-run prediction
entry for a fixture so browser tests can verify saved revision and payload. It
is not registered outside the isolated test-helper environment and is not a
production API or client global.

## Retry And Permanent-Failure Limits

The outer preview loader is deliberately invoked again on explicit Retry, and a
recoverable first rejection can be followed by a successful second controlled
load. This does not guarantee recovery from every browser module-cache failure,
permanently missing chunk, or broken module evaluation. When loading remains
impossible, Standard remains usable and the failure remains latched until Retry
or deliberate On selection.

## Prior-Run Reported Results

The interrupted run reported these results before remote compaction removed the
final command output from the visible transcript:

| Check / scenario                                                                                                       | Reported result                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:unit -- tests/unit/prediction-presentation-host.test.ts`                                                 | Passed after initial ownership changes: 1 file, 4 tests.                                                                                                                    |
| `npm run test:unit -- tests/unit/prediction-presentation-host.test.ts`                                                 | Passed after expanded storage/loader/lifecycle regressions: 1 file, 15 tests.                                                                                               |
| `npm run test:unit -- tests/unit/prediction-presentation-host.test.ts tests/unit/prediction-presentation-mode.test.ts` | Passed: 2 files, 21 tests.                                                                                                                                                  |
| `npm run typecheck`                                                                                                    | Passed earlier in the implementation run.                                                                                                                                   |
| `npm run test:e2e -- tests/e2e/kaplay-prediction-preview.spec.ts -g "preserves a dirty"`                               | First failed on an assertion expecting `First Half` while the UI renders `First half`; the assertion was corrected.                                                         |
| `npm run test:e2e -- tests/e2e/kaplay-prediction-preview.spec.ts -g "renders a real"`                                  | Passed: 1 Chromium test, real Kaplay preview path.                                                                                                                          |
| `npm run test:e2e -- tests/e2e/kaplay-prediction-preview.spec.ts -g "preserves a dirty"`                               | Passed when run alone after fixture setup was shortened.                                                                                                                    |
| Combined Kaplay browser runs                                                                                           | Repeatedly failed the dirty saved-session scenario with an observed same-URL reload; the other four combined Kaplay cases passed. The complete file was not reported green. |
| Standard submit/revisit, persisted-lock, and conflict browser slice                                                    | Passed.                                                                                                                                                                     |
| Final static commands immediately before compaction                                                                    | Invoked, but their outcomes were not present in the transcript and were not assumed.                                                                                        |

The same-URL reload is recorded as an observation only. This audit does not
attribute it to HMR, authentication, server warm-up, or unrelated test
infrastructure.

## Dirty-Session Evidence

The new focused browser scenario creates a saved prediction at known revision
`N` with built-in answers, one custom Number answer, and one custom Choice
answer. It then makes unsaved Standard edits to a built-in answer and both
custom answers, enters Match Result through normal Review edit controls,
enables the actual Kaplay preview, interacts with the real canvas, triggers a
controlled `webglcontextlost`, and verifies Standard resumes at the same Match
Result edit location without a page reload in the preservation segment.

Before explicit save, the private isolated-test helper confirms the saved entry
is still revision `N` with the original persisted values, proving no automatic
prediction write occurred. The test then continues through Standard, verifies
dirty values on Review, saves explicitly, and confirms the saved revision
advances to `N + 1` with the dirty values.

## Known Limitations

- The animated preview still covers Match Result only.
- Retry does not promise recovery from permanent browser module-cache or broken
  application-code failures.
- The selected-label overlap and narrow-canvas readability findings from 009B
  remain deferred to 009C.
- The dirty-session scenario remains unresolved in the combined Kaplay browser
  file. The focused dirty scenario was reported passing alone, but repeated
  combined runs observed a same-URL reload that destroyed dirty in-memory
  edits. The failing test and dirty-answer assertions were retained.

## Final Verification

Closeout first preserved the available local `test-results` snapshot under
`artifacts/ccpp009b1-eomd-evidence/pre-closeout-test-results/`. The only local
file present there was `.last-run.json` with `{"status":"passed","failedTests":[]}`;
it did not identify the command or test source. No local failure screenshots,
error-context files, logs, or raw browser traces were present to copy from
`test-results` or `playwright-report`.

The closeout source change was limited to `PredictionPresentationHost.tsx`:
render-time ref writes/reads were replaced with effect-updated refs and a
state-carried attempt controller to satisfy `react-hooks/refs`. No browser
behavior, assertions, retries, or dirty-answer requirements were weakened.

Checks actually run during this closeout:

| Check                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Result                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Passed before the lint correction.                                                                             |
| `npm run lint`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Initially failed with seven `react-hooks/refs` errors in `PredictionPresentationHost.tsx`; corrected directly. |
| `npm run lint:project`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Passed before the lint correction.                                                                             |
| `git diff --check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Passed before the lint correction.                                                                             |
| `./node_modules/.bin/prettier --check docs/AUDIT_009B1_Initialization_Recovery_Storage.md docs/TEMP_009B1_Resume.md docs/MAP_System.md docs/PLATFORM_Kaplay_Predictions.md docs/PLATFORM_Prediction_Session.md docs/PLATFORM_Testing.md imports/server/fixtures/testSupport.ts imports/server/predictions/testSupport.ts imports/shared/predictions/methods.ts imports/ui/predictions/PredictionPresentationHost.tsx imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx imports/ui/predictions/kaplay/matchResultRuntime.ts imports/ui/predictions/kaplay/previewAttempt.ts imports/ui/predictions/presentationPreference.ts tests/e2e/kaplay-prediction-preview.spec.ts tests/unit/prediction-presentation-host.test.ts` | Passed before the lint correction.                                                                             |
| `npm run test:unit -- tests/unit/prediction-presentation-host.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Passed after the lint correction: 1 file, 15 tests.                                                            |
| `npm run typecheck`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Passed after the lint correction.                                                                              |
| `npm run lint`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Passed after the lint correction.                                                                              |
| `npm run lint:project`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Passed after the lint correction.                                                                              |
| `git diff --check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Passed after the lint correction.                                                                              |
| Same changed-file Prettier check listed above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Passed after the lint correction.                                                                              |

Browser tests were not rerun during closeout. The combined dirty-session Kaplay
browser failure remains open for review; no page reload, skip, retry loop,
prewarm, or assertion weakening was added.

## Review Archive

Created and inspected:

`rugby-rooster-ccpp009b1-initialization-recovery-storage-eomd-20260918.zip`

The archive includes source, tests, docs, manifests, test configuration,
isolated-test helper context, and the sanitized closeout evidence directory. It
does not include local private settings, credentials, `node_modules`,
`.meteor/local*`, generated app builds/caches, or raw browser traces. The
packaged documentation was refreshed after recording archive completion.

This archive is an EOMD review candidate only. It does not mark CCPP-009B1
accepted, and CCPP-009C was not started.
