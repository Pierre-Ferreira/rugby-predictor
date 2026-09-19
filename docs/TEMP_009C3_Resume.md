# TEMP 009C3 Resume

## Scope

CCPP-009C3 closes resize coordinate synchronization for the Kaplay match-result prediction screen and verifies the corrected dirty-session interaction. Rugby Rooster remains a standalone development product.

## Source Paths

- `imports/ui/predictions/kaplay/matchResultRuntime.ts`
- `imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx`
- `imports/ui/predictions/kaplay/matchResultMotion.ts`
- `imports/ui/predictions/kaplay/previewAttempt.ts`
- `imports/ui/predictions/PredictionPresentationHost.tsx`
- `tests/unit/match-result-motion.test.ts`
- `tests/unit/prediction-presentation-host.test.ts`
- `tests/e2e/kaplay-prediction-preview.spec.ts`

## Installed Runtime

- Kaplay version observed from `node_modules/kaplay/package.json`: `3001.0.19`.
- Installed declarations expose `width()`, `height()`, `canvas`, `quit()`, `onResize(...)`, `onError(...)`, and `onLoadError(...)`.
- `KAPLAYOpt` exposes initial `width`, `height`, `stretch`, `letterbox`, `pixelDensity`, and `canvas`.
- No declared logical-size setter was found. `onResize(...)` is an observer hook, not a logical viewport mutation API.

## Synchronization Approach

- Runtime startup is deferred until the canvas shell has a positive measured CSS width.
- React computes the content-driven projected stage from that measurement.
- The runtime is initialized with that projected logical stage.
- If the projected stage dimensions change, the existing host-owned attempt starts a new runtime generation and disposes the obsolete handle through the existing generation rules.
- If stage dimensions remain equal, ordinary snapshot/focus/message/selection and compact-to-compact width changes use the existing runtime update/draw path.
- Runtime pointer input uses the inverse of the rendered-content transform and ignores letterbox bars or stale-stage transitions.

## Completed Changes

- Created this checkpoint file.
- Updated `imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx`.
- Updated `imports/ui/predictions/kaplay/matchResultRuntime.ts`.
- Updated `imports/ui/predictions/PredictionPresentationHost.tsx`.
- Added focused projection and React lifecycle regressions.
- Added a real-browser resize journey to the focused Kaplay Playwright spec.
- Corrected the focused spec evidence directory/prefix to `ccpp009c3`.
- Created `docs/AUDIT_009C3_Resize_Interaction_Verification.md`.

## Browser-Run Budget

- Focused browser batch attempts used: 2.
- Maximum additional correction batch after an evidenced correction: 1.
- Zero-case launch failures count as attempts.
- Browser budget is exhausted for this task.

## Evidence And Outcomes

- `meteor npm run test:unit -- tests/unit/match-result-motion.test.ts tests/unit/prediction-presentation-host.test.ts`
  - Passed before browser: 2 files, 53 tests.
  - Passed after post-browser measurement-deferral correction: 2 files, 53 tests.
- `meteor npm run typecheck`
  - Passed before browser.
  - Passed after post-browser measurement-deferral correction.
- `meteor npm run lint`
  - Passed after final docs.
- `meteor npm run lint:project`
  - Passed after final docs.
- `./node_modules/.bin/prettier --check ...changed files...`
  - Passed after final docs.
- `git diff --check`
  - Passed after final docs.
- Browser attempt 1:
  - Evidence root: `/tmp/rugby-rooster-ccpp009c3-browser-20260919`.
  - Exit code `1`, duration `1953ms`, no executed case IDs.
  - Sandbox-restricted process evidence included `ps EPERM` and `ss` netlink permission denial.
- Browser attempt 2:
  - Evidence root: `/tmp/rugby-rooster-ccpp009c3-browser-rerun-20260919`.
  - Exit code `1`, duration `117190ms`.
  - Result: `7 passed / 2 failed` across 9 focused Kaplay cases.
  - Corrected dirty saved-session case passed.
  - New resize journey timed out before writing the four-point measurement JSON.
  - Reduced-motion/mobile evidence case fell back to Standard after a Kaplay multiple-initialization warning; this motivated deferring runtime startup until positive measurement.
- Review ZIP:
  - `rugby-rooster-ccpp009c3-resize-interaction-verification-eomd-20260919.zip`.
  - `unzip -t` passed.
  - Representative WebMs probed as VP8 `924 x 667`.
  - Representative PNGs probed at `1280 x 1628` and `1280 x 900`.

## Exact Next Action

- Stop after reporting the implementation, checks, fresh browser outcome, unresolved resize browser acceptance, evidence paths, and review ZIP path.
