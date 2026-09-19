# CCPP-009C3B Resume And Closeout Checkpoint

## Scope

CCPP-009C3B applies two corrections only after reviewed CCPP-009C3A:

- Nonblocking optional-selection evidence: the Kaplay layout evidence helper
  must read the required semantic bridge and return `selectedValue: null`
  immediately when no radio is checked.
- Confirmed runtime teardown: `disposalComplete` must represent the installed
  Kaplay cleanup notification, not a requested `quit()` or a later browser
  frame.

Rugby Rooster remains a separate development product. No Rugby Tracker / Rucks
and Mauls architecture, branding, routes, permissions, or features are in
scope.

This checkpoint has been refreshed after the remote-compaction continuation.
009C3B is packaged for review only; it does not declare browser acceptance and
does not start CCPP-009D.

## Inspected Source Paths

- `AGENTS.md`
- `tests/e2e/kaplay-prediction-preview.spec.ts`
- `imports/ui/predictions/kaplay/matchResultRuntime.ts`
- `imports/ui/predictions/PredictionPresentationHost.tsx`
- `imports/ui/predictions/kaplay/previewAttempt.ts`
- `imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx`
- `tests/unit/prediction-presentation-host.test.ts`
- `tests/unit/match-result-motion.test.ts`
- `docs/AUDIT_009C3A_Bounded_Resize_Runtime_Closeout.md`
- `docs/PLATFORM_Kaplay_Predictions.md`
- `docs/PLATFORM_Testing.md`
- `docs/MAP_System.md`
- `docs/CORE_Predictions.md`
- `package.json`
- `package-lock.json`
- `node_modules/kaplay/package.json`
- `node_modules/kaplay/dist/types.d.ts`
- `node_modules/kaplay/dist/kaplay.mjs`
- `node_modules/kaplay/dist/kaplay.mjs.map`

Initial `git status --short` output was empty.

## Installed Versions And Cleanup API Findings

- `package.json` declares `kaplay` as `^3001.0.19`.
- The installed package is `node_modules/kaplay/package.json` version
  `3001.0.19`.
- The installed declaration `node_modules/kaplay/dist/types.d.ts` declares
  `onCleanup(action: () => void): void` as a cleanup function that runs when
  `quit()` is called.
- The installed bundle source map shows `../src/kaplay.ts` registers
  `onCleanup` callbacks in an internal `gc` array.
- The installed source ordering in `../src/kaplay.ts` is:
  `quit()` registers `game.events.onOnce("frameEnd", ...)`; inside that
  callback it calls `app.quit()`, clears GL bindings/resources, destroys the
  graphics context wrapper, then runs the registered cleanup callbacks.
- The installed source map shows `../src/app/app.ts` `quit()` sets the app
  stopped flag and removes canvas/document/window listeners.
- Therefore a browser frame, removed canvas, caught exception, or request to
  quit is not confirmed teardown. The native cleanup signal is the installed
  `ctx.onCleanup(...)` callback after Kaplay's own frame-end cleanup path runs.

## Completed Changes

- Created this checkpoint file.
- Extracted the Kaplay selected-value evidence read to
  `tests/support/kaplay-layout-evidence.ts`.
- Updated `collectKaplayLayoutEvidence()` so the semantic bridge is required
  and the checked input is optional inside that bridge.
- Added `tests/e2e/kaplay-layout-evidence-helper.spec.ts` for the lightweight
  no-Meteor Playwright regression.
- Updated the Kaplay runtime adapter to register `ctx.onCleanup(...)`
  immediately after context creation and settle `disposalComplete` only from
  that installed cleanup notification.
- Updated the host teardown consumer so rejected cleanup is not converted into
  successful permission to allocate another runtime, and pending cleanup remains
  visible across host attempts.
- Added focused controlled-engine adapter tests in
  `tests/unit/match-result-runtime.test.ts`.
- Added focused real React host handoff/deadline/obsolete-work regressions in
  `tests/unit/prediction-presentation-host.test.ts`.
- Applied the narrow reduced-motion browser-test correction after the planned
  batch: wait for selectable choices after `Change my selection` before the
  next canvas click.
- Preserved both CCPP-009C3B full-app browser evidence directories before
  closeout checks:
  - `/tmp/rugby-rooster-ccpp009c3b-browser-20260919`
  - `/tmp/rugby-rooster-ccpp009c3b-browser-correction-20260919`
  - preservation copy:
    `/tmp/rugby-rooster-ccpp009c3b-eomd-preserved-20260919`

## Checks And Evidence

Prior-run reported checks from the interrupted transcript:

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:9 meteor npm exec playwright test tests/e2e/kaplay-layout-evidence-helper.spec.ts --workers=1 --retries=0`
  - First sandboxed attempt failed before test execution because Chromium
    crashed at launch with
    `sandbox_host_linux.cc:41 ... Operation not permitted`.
  - Escalated rerun passed: 6 tests, 6 passed.
- `meteor npm run test:unit -- tests/unit/match-result-runtime.test.ts tests/unit/prediction-presentation-host.test.ts tests/unit/match-result-motion.test.ts`
  - First run failed 4 adapter tests because the controlled
    `requestAnimationFrame` harness flushed before the loaded-asset await had
    resumed to schedule readiness.
  - After the harness correction, passed: 3 files, 69 tests.
- `meteor npm run typecheck`
  - First run failed on new test typing issues only.
  - After type cleanup, passed.

Full-app browser history retained for review:

- Planned batch:
  - Evidence root: `/tmp/rugby-rooster-ccpp009c3b-browser-20260919`
  - Exit: code `1`, duration `65564ms`,
    time `2026-09-19T17:02:13.500Z`.
  - Result: `7 passed / 2 failed`.
  - Failed resize before compact synchronized-read success after the 390px
    resize.
  - Failed reduced motion because the second 360px click happened before
    choices were hit-testable after `Change my selection`.
- Correction batch:
  - Evidence root:
    `/tmp/rugby-rooster-ccpp009c3b-browser-correction-20260919`
  - Exit: code `1`, duration `114585ms`,
    time `2026-09-19T17:17:26.400Z`.
  - Result: `8 passed / 1 failed`.
  - Reduced motion and dirty saved-session recovery passed.
  - Resize remained unresolved. The run reached synchronized compact 390px
    scene readiness, then timed out waiting for the Kaplay canvas bounding box
    while the failure snapshot showed Standard fallback.

Closeout continuation checks executed:

- `meteor npm run typecheck` - passed.
- `meteor npm run lint` - passed.
- `meteor npm run lint:project` - passed.
- `meteor npm exec prettier -- --write <changed files>` - passed; all files
  unchanged.
- `meteor npm exec prettier -- --check <changed files>` - passed.
- `git diff --check` - passed.

Verification checkpoints:

- A. Correct optional-selection read and run a lightweight helper regression:
  complete.
- B. Correct confirmed teardown and run focused adapter/host tests: complete.
- C. Run the combined focused Kaplay browser file, finish docs, and package:
  complete with unresolved resize evidence for review.

## Browser Run Budget

Remaining CCPP-009C3B full-app browser budget: zero.

The lightweight DOM/helper regression is separate from the full-app batch
budget. Zero-case app launches count as attempts. The previous CCPP-009C3A
`7 passed / 2 failed` browser results are historical and are not CCPP-009C3B
verification.

## Closeout Package

Archive path:

`rugby-rooster-ccpp009c3b-nonblocking-evidence-confirmed-teardown-eomd-20260919.zip`

The archive is expected to include the corrected source/tests, relevant
unchanged Kaplay/session context, completed docs, sanitized evidence from both
full-app browser batches, failed resize context, final reduced-motion mobile
measurements/screenshots, successful motion recordings, atlas/manifest assets,
and an evidence/package manifest. Raw Playwright trace ZIPs, dependencies,
Meteor build caches, private settings, credentials, and unrelated archives are
excluded.

Package verification:

- `unzip -t` passed with no errors.
- `unzip -l` listed 143 entries.
- Representative PNGs opened with `identify`:
  - 390px mobile preview: `316 x 314`;
  - 360px mobile preview: `284 x 282`;
  - correction resize failure screenshot: `390 x 760`;
  - planned reduced-motion failure screenshot: `360 x 760`.
- Representative successful motion WebMs probed with `ffprobe` as VP8 at
  `924 x 667`.
- Archive exclusion check found no raw trace ZIPs, dependencies, Meteor local
  caches, local config, or `.env` entries.
- Original source/test/doc files and both original evidence roots remained
  present after packaging.
- Archive size observed with `ls -lh`: `5.8M`.
- After recording package verification, this checkpoint and the audit were
  refreshed and the archive was updated with the final copies.
