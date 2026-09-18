# CCPP-009C Visual Foundation & Rooster Shove Audit

## Status

Continuation verification and EOMD packaging complete.

Continuation update, 2026-09-18: the missing-artwork blocker recorded below is
historical. The supplied source PNGs are now available under
`assets/source/rooster/`; the prepared runtime frames, atlas, manifests,
motion helpers, runtime integration, focused tests, and prior browser evidence
exist in the current worktree. This audit remains the 009C audit record and is
being updated in place rather than restarting the milestone.

Continuation closeout results:

- the final runtime-lifetime correction was verified by a focused React host
  regression using the real `KaplayMatchResultPreview` and a controlled runtime
  factory;
- the browser input helper path now separates canvas pointer input for Kaplay
  visual selection, keyboard focus/Space for accessibility selection, and
  visible radio checks for Standard-only paths;
- the source artwork was not regenerated during this continuation;
- one continuation browser batch was attempted and preserved, but it exited
  before Playwright executed test cases;
- visual evidence was inspected from prepared frame contact sheets,
  transparency sheets, run/push GIF strips, existing screenshots, and existing
  short WebM metadata/contact sheets.

Review ZIP:
`rugby-rooster-ccpp009c-visual-foundation-rooster-shove-eomd-20260918.zip`.
The archive was inspected with `zipinfo -t`; it contains 108 files and passed
the ZIP integrity summary.

## Continuation Source Changes

- `imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx`
  - keeps latest session actions in a ref so runtime callbacks dispatch current
    commands without making the runtime-start effect depend on changing action
    object identity;
  - derives effective choice visibility from current selection state instead
    of using an extra synchronous effect;
  - initializes the runtime snapshot ref from the current React snapshot, so
    ordinary selection, focus, Change my selection, and rerender updates flow
    through `attempt.updateSnapshot(...)` and do not recreate/dispose the ready
    runtime.
- `tests/unit/prediction-presentation-host.test.ts`
  - adds a regression that mounts the real preview adapter through
    `PredictionPresentationHost`, resolves a controlled runtime, selects
    choices, restores choices, rerenders normally, verifies one runtime request
    and no disposal during selection updates, then verifies Off disposes and On
    can initialize a new attempt.
- `tests/e2e/kaplay-prediction-preview.spec.ts`
  - replaces the generic hidden-radio click helper with `chooseVisibleRadio`;
  - uses `clickCanvasChoice(...)` for Match Result visual-selection setup;
  - keeps keyboard tests on focus plus Space;
  - asserts picked status and semantic selected answer agree where canvas input
    is used.
- `scripts/prepare-rooster-shove-assets.mjs`
  - changes the terminal status output from `console.log` to `console.info`
    for repo lint policy compliance only. The prepared pixel outputs were not
    regenerated in this continuation.

## Continuation Verification

Checks actually run after the final runtime/input corrections:

- `npm run test:unit -- tests/unit/prediction-presentation-host.test.ts tests/unit/match-result-motion.test.ts`
  - passed after the final correction: 2 files, 27 tests.
- `npm run typecheck`
  - passed after the final source edits.
- `npm run lint`
  - initially failed on `react-hooks/set-state-in-effect` and
    `react-hooks/exhaustive-deps` in `KaplayMatchResultPreview.tsx`; passed
    after deriving effective visibility and removing the fallback snapshot
    dependency from the runtime-start effect.
- `npm run lint:project`
  - initially failed because copied Playwright `error-context.md` files under
    `artifacts/` violated the prefixed Markdown location invariant;
  - passed after preserving those copied contexts as `.txt`.
- `git diff --check`
  - passed before final documentation updates; final rerun is still required
    after packaging documentation is written.

One continuation browser batch was attempted:

- `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=artifacts/ccpp009c-continuation-browser-20260918 npm run test:e2e -- kaplay-prediction-preview.spec.ts`
  - failed with exit code 1 after about 2.4s;
  - continuation evidence is in
    `artifacts/ccpp009c-continuation-browser-20260918/`;
  - `playwright-test-results/.last-run.json` in that evidence directory reports
    `failedTests: []`, indicating this launch did not reach executable test
    cases;
  - process snapshots show Playwright spawning Meteor, then Playwright closing
    while Meteor was still starting/compiling;
  - no second browser batch was run.

Previously reported checks from the interrupted 009C log remain historical and
are not claimed as verifying the final continuation edit. The continuation
browser result also does not verify the final effect/input-helper changes.

## Visual Evidence Reviewed

Available and inspected:

- extracted-frame contact sheet:
  `artifacts/ccpp009c-review/rooster-shove-contact-sheet.png`;
- transparency checks:
  `artifacts/ccpp009c-review/rooster-transparency-light.png` and
  `artifacts/ccpp009c-review/rooster-transparency-dark.png`;
- asset-level run/push GIFs:
  - `artifacts/ccpp009c-review/rooster-run-loop-normal.gif`
  - `artifacts/ccpp009c-review/rooster-run-loop-slow.gif`
  - `artifacts/ccpp009c-review/rooster-push-run-loop-normal.gif`
  - `artifacts/ccpp009c-review/rooster-push-run-loop-slow.gif`
  - `artifacts/ccpp009c-review/rooster-run-to-push-review.gif`;
- generated inspection strips:
  `artifacts/ccpp009c-continuation-visual-inspection-20260918/`;
- existing browser screenshots:
  - `test-results/ccpp009c/desktop-default-match-result-preview.png`
  - `test-results/ccpp009c/narrow-match-result-preview.png`
  - `test-results/ccpp009c/standard-after-fallback.png`.

Observed from actual opened images:

- asset frames enter head-first and show visible leg cycling;
- push frames keep the rooster's hands forward through the push/run exit;
- transparency sheets show complete character silhouettes on light and dark
  backgrounds, with known source matte halos preserved rather than erased;
- desktop and narrow preview screenshots are readable;
- Standard after interruption is readable and does not show Draw/feedback
  overlap.

Evidence limitations:

- existing WebM recordings
  `test-results/ccpp009c/match-result-shove-normal-speed.webm` and
  `test-results/ccpp009c/match-result-shove-slow-review.webm` exist, but
  FFprobe reports durations of about 0.25s and 0.22s; extracted contact sheets
  did not show the rooster shove, so they are insufficient for full integrated
  animation approval;
- no successful continuation browser run produced fresh integrated recordings;
- asset-only GIFs prove prepared frame sequencing, not integrated browser
  behavior.

## EOMD Package Contents

The review ZIP includes:

- original source artwork under `assets/source/rooster/`;
- preparation script and final prepared frames/atlas/manifests;
- Match Result motion/layout/runtime/preview source;
- relevant host/session/presentation context source;
- focused unit and browser spec files;
- updated docs and this audit/checkpoint record;
- asset-review GIFs/contact sheets/transparency checks;
- existing browser screenshots and short recordings;
- continuation visual-inspection contact sheets;
- continuation browser launch summary and sanitized prior failure evidence.

The review ZIP excludes dependency folders, application build/cache folders,
raw Playwright `trace.zip` files, private settings, unrelated review archives,
and repository originals were not removed.

## Historical Initial Status

The first 009C pass was blocked before implementation.

CCPP-009C requires two supplied source images before the sprite preparation,
motion inspection, Match Result shove integration, browser evidence, and review
package can be completed:

- `cartoon_rooster_running_sprite_sheet.png`
- `rooster_animation_loops_reference_sheet.png`

At that time, neither file was available in this repository or in the searched
local workspace paths.

## Inspection Completed

- Read `AGENTS.md`.
- Read the current prediction, Kaplay preview, prediction-session, asset-map,
  testing, and system-map docs.
- Verified installed Kaplay version from `node_modules/kaplay/package.json`:
  `3001.0.19`.
- Inspected the previous CCPP-009B4 review archive:
  `rugby-rooster-ccpp009b4-development-kaplay-defaults-eomd-20260918.zip`.
- Inspected the current Match Result preview/runtime boundary:
  - `imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx`
  - `imports/ui/predictions/kaplay/matchResultRuntime.ts`
  - `tests/unit/prediction-presentation-host.test.ts`

At the first blocked inspection, the preview was still the accepted 009B4
one-screen Match Result runtime: it drew a simple canvas scene, kept a visible
DOM choice bridge, and had no rooster sprite asset loading yet. That statement
is historical; the current worktree now includes the 009C rooster atlas loading
and shove runtime.

## Asset Search Evidence

The required files were not found by:

- repository file search for rooster/sprite/asset paths;
- exact-name search under `/home/pierreferreira`;
- exact-name search under `/tmp` before protected system temp directories
  returned permission-denied entries;
- listing the previous CCPP-009B4 review archive contents.

No substitute mascot artwork was downloaded, generated, copied from another
product, or invented.

## Current Implementation Inventory

The current implementation includes:

- preserved source art:
  - `assets/source/rooster/cartoon_rooster_running_sprite_sheet.png`
  - `assets/source/rooster/rooster_animation_loops_reference_sheet.png`
- reproducible preparation script:
  `scripts/prepare-rooster-shove-assets.mjs`;
- prepared runtime frames:
  `public/assets/rooster/match-result/frames/`;
- runtime atlas and public manifest:
  - `public/assets/rooster/match-result/rooster-shove-atlas.png`
  - `public/assets/rooster/match-result/rooster-shove-manifest.json`
- generated TypeScript-side manifest:
  `imports/ui/predictions/kaplay/roosterShoveManifest.generated.json`;
- motion/layout helper:
  `imports/ui/predictions/kaplay/matchResultMotion.ts`;
- integrated runtime and preview changes:
  - `imports/ui/predictions/kaplay/matchResultRuntime.ts`
  - `imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx`;
- focused unit/browser coverage:
  - `tests/unit/match-result-motion.test.ts`
  - `tests/unit/prediction-presentation-host.test.ts`
  - `tests/e2e/kaplay-prediction-preview.spec.ts`;
- motion-review evidence:
  `artifacts/ccpp009c-review/`;
- pre-continuation evidence preservation:
  `artifacts/ccpp009c-continuation-preserved-20260918/`.

## Historical Work Not Started

Because the supplied source art is absent, the following 009C deliverables were
not started:

- source-art copy and preservation;
- transparent frame extraction;
- runtime atlas and animation metadata;
- run/pushRun motion-review harness;
- Match Result visual rewrite;
- continuous rooster shove integration;
- focused unit/browser animation tests;
- screenshots, recordings, or review archive.

This follows the task instruction to identify missing required inputs and avoid
inventing asset paths or replacement artwork.

## Current Next Action

Complete focused verification and EOMD packaging from the current worktree.
Do not regenerate the prepared frames unless current evidence shows a specific
remaining defect or the preparation source changes.

## Historical Next Action

Place both original supplied PNGs in the repository or provide their exact
accessible local paths, then resume from `docs/TEMP_009C_Resume.md`.

The next pass should preserve the originals unchanged, produce a reproducible
small asset pack, checkpoint motion evidence before integration, and continue
with the four requested checkpoints A through D.

## Verification

No application, asset, motion, or browser tests were run because implementation
did not begin.

Lightweight documentation checks run:

- `git diff --check` - passed.
- `meteor npm run lint:project` - passed; command emitted npm's existing
  `Unknown env config "nodedir"` warning before the project invariant check
  passed.
