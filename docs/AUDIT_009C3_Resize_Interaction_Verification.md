# CCPP-009C3 Resize Interaction Verification Audit

## Status

Implementation and focused unit/component verification are complete. The fresh
focused browser run executed nine cases and ended `7 passed / 2 failed`; the
corrected dirty saved-session case passed. The new resize journey did not
complete successfully before the browser budget was exhausted, so this audit
does not claim full browser acceptance for resize synchronization.

## Scope

CCPP-009C3 was limited to the existing development/test Kaplay Match Result
surface:

- synchronize the content-driven projected stage, Kaplay logical viewport,
  canvas display geometry, pointer mapping, and focus/debug geometry across
  desktop and compact breakpoints;
- preserve the accepted compact layouts and 009C2 shove playback work;
- verify the corrected dirty saved-session interaction in the fresh focused
  browser run.

No new artwork, additional Kaplay question screens, server APIs, prediction
session redesign, dependency upgrades, or platform UI redesign were added.

## Source Changes

- `imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx`
  - Defers runtime startup until the canvas shell has a positive measured CSS
    width instead of initializing Kaplay from the default desktop width before
    first measurement.
  - Starts or replaces the runtime only when the projected logical stage
    dimensions change.
  - Keeps ordinary snapshot, focus, selection, message, and compact-to-compact
    width updates on the existing runtime/update path.
- `imports/ui/predictions/kaplay/matchResultRuntime.ts`
  - Adds an explicit `initialViewport` contract containing the measured CSS
    width and projected logical stage used for Kaplay initialization.
  - Initializes Kaplay with the current content-driven projected stage instead
    of independently re-projecting from the canvas at construction time.
  - Re-applies the canvas CSS aspect after Kaplay context creation because the
    installed Kaplay implementation writes canvas CSS during setup.
  - Maps pointer input through the rendered content rectangle inside the canvas
    and ignores letterbox bars.
  - Refuses pointer input and draws only a neutral background when the current
    measured projection no longer matches the configured stage.
  - Publishes test-control-gated debug evidence for projected stage,
    synchronized state, engine dimensions, drawing-buffer size, canvas CSS
    bounds, and rendered content bounds.
- `imports/ui/predictions/PredictionPresentationHost.tsx`
  - Allows the existing host-owned attempt to deliberately enter a new runtime
    generation after a ready runtime when a logical viewport replacement is
    requested.
  - Keeps stale runtime starts isolated through the existing generation check
    and disposes late obsolete handles.
- `tests/unit/match-result-motion.test.ts`
  - Adds breakpoint projection and hit-test regression coverage for
    desktop -> compact -> compact -> desktop layouts.
- `tests/unit/prediction-presentation-host.test.ts`
  - Adds controlled measured-width React regressions for breakpoint runtime
    replacement, compact-to-compact no-replacement behavior, ordinary snapshot
    updates, stale callback isolation, Off during replacement, and selected
    answer preservation during resize.
- `tests/e2e/kaplay-prediction-preview.spec.ts`
  - Adds a real browser desktop -> compact -> desktop resize journey using
    actual canvas pointer input, keyboard input, debug engine/layout evidence,
    screenshots, and a resize-during-shove recording attempt.
  - Keeps the 009C2 dirty-session correction: `Change my selection`, wait for
    three hit-testable choices, then actual canvas choice click before forced
    runtime failure.

## Kaplay API Findings

Installed Kaplay version: `3001.0.19`.

Inspected installed declarations and implementation:

- `KAPLAYOpt` declares initial `width`, `height`, `stretch`, `letterbox`,
  `pixelDensity`, and `canvas` options.
- `KAPLAYCtx` declares `width()`, `height()`, `canvas`, `quit()`,
  `onError(...)`, `onLoadError(...)`, and `onResize(...)`.
- No declared logical-size setter such as `setLogicalSize` exists.
- `onResize(...)` registers an observer callback; it does not declare or imply
  a logical viewport mutation API.
- The minified implementation initializes from the supplied options and writes
  canvas CSS during setup, so React reapplies the intended aspect ratio after
  context creation.

## Synchronization Strategy

The selected strategy is controlled runtime replacement only when the required
logical stage dimensions change.

Runtime update path:

- same projected stage width and height;
- compact-to-compact width changes where the content-driven stage remains
  equal;
- selection, focus, message/snapshot updates, restored choices, and ordinary
  rerenders.

Runtime replacement path:

- projected stage dimensions change, for example desktop `720 x 520` to the
  content-driven compact stage, or compact back to desktop.

Input transform:

- Forward transform: projected stage coordinates render into the content
  rectangle inside the actual canvas CSS bounds.
- Inverse transform: pointer CSS coordinates subtract the content-rectangle
  offset and scale through that content rectangle back into stage coordinates.
- Letterbox bars, zero-sized measurements, and stale-stage transitions are not
  interactive.

Motion policy:

- A replacement is seeded from the current snapshot and treats the current
  `selectionEffectId` as baseline, so an existing selected answer is not replayed
  as a new shove.
- If resize interrupts an active shove, the transient effect is cancelled and
  the selected answer presentation survives.

Session preservation:

- Runtime replacement stays below `usePredictionSession(...)` and does not
  remount the shared prediction-session owner.
- The selected answer, custom answers, Review edit context, expected revision,
  saved baseline, dirty/conflict state, and submission state remain session
  state rather than renderer state.
- Resize operations make no prediction writes.

## Verification

Commands run before browser execution:

- `meteor npm run test:unit -- tests/unit/match-result-motion.test.ts tests/unit/prediction-presentation-host.test.ts`
  - Passed before browser: 2 files, 53 tests.
- `meteor npm run typecheck`
  - Passed before browser.

Focused browser execution:

- First attempt:
  - Command:
    `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=/tmp/rugby-rooster-ccpp009c3-browser-20260919 meteor npm run test:e2e -- tests/e2e/kaplay-prediction-preview.spec.ts --workers=1 --retries=0`
  - Exit: code `1`, duration `1953ms`.
  - No stdout/stderr logs were produced.
  - `.last-run.json` recorded `failedTests: []`.
  - Process evidence showed sandbox restrictions such as `ps EPERM` and
    `ss` netlink permission denial.
- Second attempt, run outside the sandbox after the blocked local-loopback
  launch:
  - Command:
    `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=/tmp/rugby-rooster-ccpp009c3-browser-rerun-20260919 meteor npm run test:e2e -- tests/e2e/kaplay-prediction-preview.spec.ts --workers=1 --retries=0`
  - Exit: code `1`, duration `117190ms`.
  - Result: `7 passed / 2 failed`.
  - Executed cases: `9`.
  - Passed cases included the corrected dirty saved custom prediction case.

Failed browser cases:

- `keeps canvas coordinates synchronized across desktop compact desktop resizing`
  - Timed out at `60s` during first evidence screenshot capture after the scene
    became ready.
  - Failure artifact:
    `/tmp/rugby-rooster-ccpp009c3-browser-rerun-20260919/playwright-test-results/kaplay-prediction-preview--7f6a9-op-compact-desktop-resizing-chromium/`
  - No four-point resize measurement JSON was produced.
- `uses Standard when reduced motion blocks automatic activation`
  - After reduced motion was removed, the preview fell back to Standard with
    `Animations couldn't continue. Your answers have been kept.`
  - Browser console included Kaplay's warning about multiple initialization.
  - This failure motivated the post-run source correction that defers runtime
    startup until the first positive measurement. That correction was verified
    by unit/component tests and typecheck, but browser budget prevented a fresh
    browser rerun.

Post-browser correction checks:

- `meteor npm run test:unit -- tests/unit/match-result-motion.test.ts tests/unit/prediction-presentation-host.test.ts`
  - Passed: 2 files, 53 tests.
- `meteor npm run typecheck`
  - Passed.
- `meteor npm run lint`
  - Passed.
- `meteor npm run lint:project`
  - Passed; project invariant check passed.
- `./node_modules/.bin/prettier --check ...changed files...`
  - Passed.
- `git diff --check`
  - Passed.

## Evidence

Fresh browser evidence root:

- `/tmp/rugby-rooster-ccpp009c3-browser-20260919`
- `/tmp/rugby-rooster-ccpp009c3-browser-rerun-20260919`

Useful retained artifacts from the second attempt:

- `playwright-stdout.log`
- `playwright-stderr.log`
- `exit.json`
- `launch-manifest.json`
- `runner-output.jsonl`
- per-test sanitized browser JSON under `browser/`
- successful playback media:
  - `browser-artifacts/match-result-shove-normal-speed.webm`
  - `browser-artifacts/match-result-shove-slow-review.webm`
- successful screenshots:
  - `browser-screenshots/desktop-default-match-result-preview.png`
  - `browser-screenshots/desktop-default-match-result-selected.png`
  - `browser-screenshots/standard-after-fallback.png`
  - `browser-screenshots/standard-after-interruption.png`
- failure artifacts for both failed cases:
  - failure screenshot;
  - video;
  - `error-context.md`;
  - raw trace ZIP retained privately and excluded from the review ZIP.

No completed fresh four-point resize measurement record exists because the new
resize browser journey timed out before it wrote
`resize-interaction-measurements.json`.

## Review Package

Created review ZIP:

`rugby-rooster-ccpp009c3-resize-interaction-verification-eomd-20260919.zip`

Archive verification:

- `unzip -t rugby-rooster-ccpp009c3-resize-interaction-verification-eomd-20260919.zip`
  passed with no errors.
- Representative included WebMs probed with `ffprobe` as VP8 at `924 x 667`.
- Representative included PNGs probed with `identify`:
  - `desktop-default-match-result-preview.png` at `1280 x 1628`;
  - resize-failure `test-failed-1.png` at `1280 x 900`.
- Repository originals remained present after packaging.

The ZIP includes changed source, focused tests, updated docs, relevant unchanged
host/session/context files, the runtime atlas/manifest, source identity, and
sanitized evidence. It excludes `node_modules`, `.meteor/local`, raw Playwright
trace ZIPs, raw process snapshots, credentials, caches, and unrelated archives.

## 009C2 Audit Note

`docs/AUDIT_009C2_Compact_Layout_Playback.md` is corrected with a note that
the normal-speed footage shows left-to-right entry, not entry from the right.
The historical `7 passed / 1 failed` 009C2 browser result is unchanged.

## Remaining Limitations

- Full real-browser resize acceptance remains unresolved until the focused
  Kaplay browser spec is rerun after the measurement-deferral correction.
- The new resize journey's required four records and resize-during-shove
  recording were not obtained in the fresh run.
- The dirty-session correction did pass in the fresh focused browser batch.
