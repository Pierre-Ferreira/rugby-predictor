# CCPP-009C3B Evidence Capture And Confirmed Teardown Audit

## Status

CCPP-009C3B is packaged for review, not accepted. The implementation and
documentation closeout are complete for the current source, but the focused
Kaplay browser file is not green.

Final recorded browser result for this milestone:

- Planned full-app browser batch: `7 passed / 2 failed`.
- Correction full-app browser batch: `8 passed / 1 failed`.
- Remaining failure: resize synchronization after desktop-to-compact
  replacement.

No further browser runs were performed during this continuation.

## Scope

CCPP-009C3B corrected two reviewed 009C3A interpretation issues:

- Evidence capture now treats the semantic Match Result bridge as required and
  the checked radio input as optional. An initially unselected ready scene
  returns `selectedValue: null` without waiting for `input:checked`.
- Runtime teardown completion now means the installed Kaplay cleanup
  notification, not a requested `quit()` call or a later browser frame.

Rugby Rooster remains a standalone rugby prediction game. No Rugby Tracker /
Rucks and Mauls requirements, branding, routes, permissions, subscription
tiers, collections, or architecture were introduced.

## Source Changes

- `tests/support/kaplay-layout-evidence.ts`
  - Adds `readKaplayMatchResultSelectedValue(page, { timeoutMs })`.
  - Waits for the required
    `data-testid="kaplay-match-result-choice-bridge"` element.
  - Reads `bridge.querySelector('input:checked')?.value ?? null`.
- `tests/e2e/kaplay-layout-evidence-helper.spec.ts`
  - Covers the helper without a Meteor app session.
  - Cases: unselected bridge returns `null`; `team1`, `team2`, and `draw`
    return their selected value; missing bridge rejects; closed page rejects.
- `tests/e2e/kaplay-prediction-preview.spec.ts`
  - Uses the helper for layout evidence selected-value reads.
  - Adds stage markers around scene readiness, optional selected-value reads,
    bitmap capture, and resize evidence persistence.
  - Adds `waitForHitTestableChoices(...)` after `Change my selection` in the
    reduced-motion mobile path. This was the narrow correction between the
    `7/9` and `8/9` batches.
- `imports/ui/predictions/kaplay/matchResultRuntime.ts`
  - Registers `k.onCleanup(confirmDisposalComplete)` immediately after Kaplay
    context creation when available.
  - Settles `disposalComplete` only from that native cleanup callback.
  - Rejects `disposalComplete` if `quit()` throws, `onCleanup` is unavailable,
    or cleanup callback registration fails.
  - Keeps partial-start cancellation on the same teardown path.
- `imports/ui/predictions/PredictionPresentationHost.tsx`
  - Persists pending runtime teardown across attempted replacements.
  - Waits for known adopted-handle and partial-initialization cleanup before
    allocating replacement work.
  - Keeps rejected cleanup as a failure path rather than permission to allocate
    another runtime.
- `tests/unit/match-result-runtime.test.ts`
  - Adds controlled-engine teardown confirmation coverage for cleanup callback
    settlement, single settlement, `quit()` rejection, missing cleanup support,
    partial-start cancellation, and pre-allocation cancellation.
- `tests/unit/prediction-presentation-host.test.ts`
  - Adds React host regressions for pending cleanup, rejected cleanup,
    cleanup-deadline fallback, Off-before-cleanup, and partial-initialization
    cleanup before superseded allocation.

## Installed Kaplay Cleanup Findings

Installed Kaplay version: `3001.0.19`.

The installed declaration exposes `onCleanup(action: () => void): void`. The
installed source map shows `quit()` scheduling cleanup on `frameEnd`; that path
calls `app.quit()`, clears graphics resources, destroys the graphics context
wrapper, and then runs registered cleanup callbacks.

Therefore:

- requested teardown is `ctx.quit()`;
- confirmed teardown is the installed `ctx.onCleanup(...)` notification;
- a later browser frame, removed canvas, or caught exception is not enough
  evidence of completed Kaplay cleanup.

## Verification History

Prior-run reported checks from the interrupted 009C3B transcript:

- Helper browser check:
  - Initial no-Meteor Playwright launch failed before helper code ran because
    Chromium could not launch in the sandbox.
  - Escalated rerun passed 6 helper cases.
- Focused source checks:
  - The focused unit run passed 69 tests across motion, runtime adapter, and
    React host coverage after the controlled harness correction.
  - TypeScript test typing was corrected.
  - `meteor npm run typecheck` passed.
  - Focused tests were invoked again after typing corrections.
  - Changed-file formatting and another typecheck completed before the
    full-app browser run.
- Full-app browser history:
  - Planned batch: `7 passed / 2 failed`.
  - Reduced-motion test then received the narrow selectable-choice wait after
    `Change my selection`.
  - Final correction batch: `8 passed / 1 failed`.
  - Reduced motion and dirty saved-session recovery passed.
  - Resize remained unresolved.

Checks executed in this continuation:

- `meteor npm run typecheck` - passed.
- `meteor npm run lint` - passed.
- `meteor npm run lint:project` - passed.
- `meteor npm exec prettier -- --write <changed files>` - passed; all files
  unchanged.
- `meteor npm exec prettier -- --check <changed files>` - passed.
- `git diff --check` - passed.

## Browser Evidence

Original evidence roots preserved before closeout checks:

- `/tmp/rugby-rooster-ccpp009c3b-browser-20260919`
- `/tmp/rugby-rooster-ccpp009c3b-browser-correction-20260919`

Private preservation copy:

- `/tmp/rugby-rooster-ccpp009c3b-eomd-preserved-20260919`

### Planned Batch

Evidence root:

- `/tmp/rugby-rooster-ccpp009c3b-browser-20260919`

Recorded result:

- Command: `playwright test tests/e2e/kaplay-prediction-preview.spec.ts --workers=1 --retries=0`
- Exit: code `1`, duration `65564ms`, time `2026-09-19T17:02:13.500Z`.
- Result: `7 passed / 2 failed`.

Passed:

- automatic development Kaplay access;
- active Draw / Change my selection / Continue;
- Off during active shove;
- slowed shove review recording;
- delayed initialization / controlled failure / context loss recovery;
- dirty saved custom prediction recovery;
- keyboard selection with legacy `enabled:false`.

Failed resize:

- Initial desktop synchronized layout was recorded.
- Initial desktop bitmap and crop capture passed.
- `selectedValue` for the unselected bridge returned `null`.
- After the first desktop pointer selection and `390px` resize, the run marked
  `kaplay-layout-evidence:scene-readiness-start`.
- The exact failure was
  `page.waitForFunction: Timeout 15000ms exceeded` at the synchronized-layout
  wait in `collectKaplayLayoutEvidence(...)`.
- The failure snapshot showed Standard fallback with
  `Animations couldn't continue. Your answers have been kept.` and the selected
  Team 2 answer.
- No `pageErrors` or `failedRequests` were recorded in the browser JSON. The
  underlying host/runtime failure reason was not captured.

Failed reduced motion:

- Standard while reduced motion was requested had already been exercised in the
  journey.
- The exact failure was
  `Kaplay choice layout is not currently hit-testable` during the 360px Draw
  click after the test changed selection.
- The failure snapshot showed the semantic Kaplay bridge with Team 1 checked.
- This failure was addressed by waiting for hit-testable choices after the
  visible `Change my selection` action.

### Correction Batch

Evidence root:

- `/tmp/rugby-rooster-ccpp009c3b-browser-correction-20260919`

Recorded result:

- Command: `playwright test tests/e2e/kaplay-prediction-preview.spec.ts --workers=1 --retries=0`
- Exit: code `1`, duration `114585ms`, time `2026-09-19T17:17:26.400Z`.
- Result: `8 passed / 1 failed`.

Passed in this final batch:

- automatic development Kaplay access;
- active Draw / Change my selection / Continue;
- Off during active shove;
- slowed shove review recording;
- reduced-motion Standard block plus restored-motion mobile coverage;
- delayed initialization / controlled failure / context loss recovery;
- dirty saved custom prediction recovery;
- keyboard selection with legacy `enabled:false`.

Remaining failed resize:

- Initial desktop synchronized layout succeeded at `2026-09-19T17:15:45.539Z`.
- Optional selected-value read succeeded with `selectedValue: null` at
  `2026-09-19T17:15:45.568Z`.
- Initial desktop measurement and bitmap/crop capture were persisted.
- Desktop pointer selection for Team 2 was recorded.
- The viewport was changed to 390px at `2026-09-19T17:15:45.769Z`.
- Compact 390 scene readiness started at `2026-09-19T17:15:45.784Z` and
  reached `kaplay-layout-evidence:scene-readiness-success` at
  `2026-09-19T17:15:45.804Z`.
- The exact failure was the overall Playwright test timeout while waiting for
  `getByTestId('kaplay-match-result-canvas').boundingBox()` at
  `collectKaplayLayoutEvidence(...)`.
- The failure snapshot again showed Standard fallback with
  `Animations couldn't continue. Your answers have been kept.` and the selected
  Team 2 answer.
- No `pageErrors` or `failedRequests` were recorded. The browser JSON includes
  ordinary HMR websocket-closed logs, React DevTools info, and one Kaplay
  multiple-initialization warning. The underlying host/runtime failure reason
  was not captured.

Standard fallback remains an unresolved resize failure, not resize acceptance.

Reduced-motion mobile evidence from the correction batch:

- `browser-artifacts/mobile-layout-measurements.json` records 390px and 360px
  synchronized compact layouts.
- 390px initial choices: 314px canvas width, 312.25px canvas height,
  16.136px labels, target heights above 47px, `selectedValue: null`.
- 390px Draw rejected and settled measurements recorded `selectedValue: "draw"`.
- 360px initial choices: 284px canvas width, 282.421875px canvas height,
  16px labels, minimum target height `44px`.
- 360px Draw rejected and settled measurements recorded `selectedValue: "draw"`.
- Screenshots include 390px/360px preview, choice-area, rejected, crop, and
  settled images.

Successful motion evidence:

- `browser-artifacts/match-result-shove-normal-speed.webm`
- `browser-artifacts/match-result-shove-slow-review.webm`

## Evidence Available And Missing

Available:

- complete retained runner stdout/stderr and exit records for both batches;
- sanitized launch manifests, runner JSONL, browser JSON summaries, and
  request/console/page-error summaries;
- failed resize screenshots, error contexts, and videos;
- first-batch reduced-motion failure screenshot/error context/video;
- resize measurements from both batches through the initial desktop step;
- final reduced-motion mobile measurements and screenshots at 390px and 360px;
- successful motion recordings from the current browser batches;
- helper and focused-unit outcomes as prior-run reported in
  `docs/TEMP_009C3B_Resume.md`.

Missing:

- no retained log records the underlying host/runtime error that caused the
  resize Standard fallback;
- no successful compact-resize acceptance after Team 2 selection exists in the
  retained browser evidence;
- raw Playwright traces are preserved privately in the evidence roots but are
  excluded from the review archive because they may contain session material.

## Review Package

Archive path:

`rugby-rooster-ccpp009c3b-nonblocking-evidence-confirmed-teardown-eomd-20260919.zip`

Archive verification:

- `unzip -t rugby-rooster-ccpp009c3b-nonblocking-evidence-confirmed-teardown-eomd-20260919.zip`
  passed with no errors.
- `unzip -l` listed 143 entries and showed source, run, planned evidence, and
  correction evidence folders.
- Representative PNGs opened with `identify`:
  - correction reduced-motion 390px preview:
    `mobile-390-match-result-preview.png` at `316 x 314`;
  - correction reduced-motion 360px preview:
    `mobile-360-match-result-preview.png` at `284 x 282`;
  - correction resize failure screenshot: `test-failed-1.png` at `390 x 760`;
  - planned reduced-motion failure screenshot: `test-failed-1.png` at
    `360 x 760`.
- Representative WebMs probed with `ffprobe` as VP8 at `924 x 667`:
  - `match-result-shove-normal-speed.webm`;
  - `match-result-shove-slow-review.webm`.
- Archive exclusion check found no `trace.zip`, `node_modules`,
  `.meteor/local`, `config/local`, or `.env` entries.
- Original source/test/doc files and both original `/tmp` evidence roots
  remained present after packaging.
- Archive size observed with `ls -lh`: `5.8M`.
- After recording package verification, the audit/checkpoint docs were
  refreshed and the archive was updated with the final copies.
