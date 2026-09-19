# TEMP 009C3A Resume

## Scope

CCPP-009C3A finishes the controlled resize-replacement path for the
development-only Kaplay Match Result preview. Rugby Rooster remains a separate
standalone prediction game, and this task does not start 009D.

## Source Paths Inspected

- `AGENTS.md`
- `imports/ui/predictions/PredictionPresentationHost.tsx`
- `imports/ui/predictions/kaplay/previewAttempt.ts`
- `imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx`
- `imports/ui/predictions/kaplay/matchResultRuntime.ts`
- `docs/AUDIT_009C3_Resize_Interaction_Verification.md`
- `docs/TEMP_009C3_Resume.md`
- `docs/PLATFORM_Kaplay_Predictions.md`
- `docs/PLATFORM_Testing.md`
- `docs/MAP_System.md`
- `docs/CORE_Predictions.md`

Also inspected the focused host tests, e2e resize/reduced-motion helpers,
installed Kaplay source map, and package scripts before source edits.

## Current Deadline And Generation Ownership

- `PredictionPresentationHost.tsx` owns a host preview attempt keyed by
  session/retry and starts one deadline before the outer preview loader begins.
- That original timer is cleared when the first runtime becomes ready.
- `startRuntime(...)` can later move the same host attempt from `ready` back to
  `loading` for a logical viewport replacement, but it does not create a new
  live post-ready deadline.
- `remainingTimeMs()` still reads from the original startup deadline, so a
  post-ready replacement can inherit an expired budget even though no timer is
  enforcing completion.
- The current pre-factory guard checks the parent attempt's loading/current
  state, then passes `remainingInitializationMs`; it does not give each runtime
  start a separately owned identity before allocation.
- The existing `activeRuntimeStartId` protects adoption of late handles and
  stale rejection, but an older queued start can still allocate if a newer
  replacement has put the parent attempt back into `loading`.

## Intended Minimal Correction

- Keep the initial startup policy as one shared budget for preview-module load
  plus first runtime initialization.
- Add a small runtime-generation owner inside the existing host attempt rather
  than a second timeout framework.
- Start a bounded replacement cycle when a post-ready logical viewport
  replacement is first requested; do not refresh that cycle on repeated
  measurements.
- Coalesce superseded pending geometry to the newest eligible generation while
  retaining the current cycle's remaining budget.
- Guard before factory allocation, before initial snapshot/update, before ready
  publication, before input/failure dispatch, and during cleanup so obsolete
  generations cannot affect the current runtime.
- Add the narrow adapter cancellation/teardown contract needed to clean a
  partially initialized Kaplay engine without assuming `quit()` has asynchronous
  completion semantics.
- Preserve positive initial measurement, selection/session state, Standard
  fallback, deliberate retry, and the existing automatic development access.

## Completed Work

- `git status --short` inspected; worktree was clean at start.
- Required AGENTS and initial platform/audit docs read.
- Current host source gap verified against the checked-in code.
- This checkpoint file created before source edits.
- Implemented bounded startup/replacement cycles in
  `imports/ui/predictions/PredictionPresentationHost.tsx`.
- Added per-runtime generation identity, abort ownership, pre-allocation checks,
  stale adoption/failure guards, and bounded teardown waiting.
- Added adapter `abortSignal`, partial-initialization disposal, and
  `disposalComplete` reporting in
  `imports/ui/predictions/kaplay/matchResultRuntime.ts`.
- Added focused React DOM regressions for post-ready replacement deadlines,
  stalled replacement fallback, rapid supersession, already-initializing
  supersession cleanup, and non-refreshing replacement timers.
- Updated the focused Playwright file to persist resize measurements before
  capture attempts and record capture failures separately.
- Ran both permitted current-source focused browser batches. Both ended
  `7 passed / 2 failed`; dirty saved-session passed, while resize and
  reduced-motion remain unresolved.
- Updated platform/core/system docs and created
  `docs/AUDIT_009C3A_Bounded_Resize_Runtime_Closeout.md`.

## Checks And Evidence

- `meteor npm run test:unit -- tests/unit/match-result-motion.test.ts tests/unit/prediction-presentation-host.test.ts`
  - Passed: 2 files, 58 tests.
- `meteor npm run typecheck`
  - Passed after source/test changes.
- Planned browser batch:
  - Evidence: `/tmp/rugby-rooster-ccpp009c3a-browser-20260919`.
  - Exit code `1`, duration `170335ms`, result `7 passed / 2 failed`.
  - Dirty saved-session case passed.
  - Resize persisted its first measurement but timed out before first pointer
    selection after capture operations stayed pending until page close.
  - Reduced-motion reached readiness after removing reduced motion but timed out
    at full-page screenshot capture.
- Correction browser batch:
  - Evidence:
    `/tmp/rugby-rooster-ccpp009c3a-browser-correction-20260919`.
  - Exit code `1`, duration `167866ms`, result `7 passed / 2 failed`.
  - Dirty saved-session case passed again.
  - Resize persisted its first measurement but timed out before first pointer
    selection; capture status recorded missing visible canvas.
  - Reduced-motion reached readiness after removing reduced motion, then canvas
    bitmap capture found no visible canvas.
- `meteor npm run lint`
  - Passed.
- `meteor npm run lint:project`
  - Passed; project invariant check passed.
- `./node_modules/.bin/prettier --check ...changed files...`
  - Passed after formatting touched TypeScript files.
- `git diff --check`
  - Passed.
- Review ZIP:
  - `rugby-rooster-ccpp009c3a-bounded-resize-browser-closeout-eomd-20260919.zip`
  - `unzip -t` passed.
  - Representative PNGs opened with `identify`.
  - Representative WebMs probed with `ffprobe` as VP8 `924 x 667`.
  - Originals remained present.
- Historical CCPP-009C3 evidence remains unchanged:
  - focused unit/component checks passed with 53 tests;
  - a zero-case browser launch was recorded;
  - a later focused browser run recorded `7 passed / 2 failed` across 9 cases;
  - the corrected dirty saved-session browser case passed;
  - resize timed out during its first screenshot;
  - reduced-motion reactivation fell back to Standard;
  - the later positive-measurement source correction was not browser-rerun.

## Remaining Browser-Run Budget

- CCPP-009C3A planned combined focused browser batch: `0` remaining.
- Conditional additional browser batch after a directly justified source/test
  correction: `0` remaining.
- Zero-case launch failures count as attempts.
- This budget must survive remote compaction or future resume.

## Exact Next Action

Stop after reporting the implementation, checks, browser outcome, unresolved
resize/reduced-motion limitations, capture/evidence status, and review ZIP
path. Do not start 009D or another browser rerun.
