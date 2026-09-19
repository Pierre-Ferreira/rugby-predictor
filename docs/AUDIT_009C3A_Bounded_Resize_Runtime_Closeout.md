# CCPP-009C3A Bounded Resize Runtime Closeout Audit

## Status

The bounded runtime-replacement implementation and focused unit/type
verification are complete. Browser closeout is not complete: both permitted
current-source focused browser batches executed nine cases and ended
`7 passed / 2 failed`. The corrected dirty saved-session journey passed in both
batches, but the resize and reduced-motion journeys remain unresolved.

## Correction Note Added 2026-09-19

CCPP-009C3B corrected two conclusions from this audit without rewriting the
historical `7 passed / 2 failed` results:

- The `collectKaplayLayoutEvidence()` selected-answer read used
  `[data-testid="kaplay-match-result-choice-bridge"] input:checked`, which made
  an initially unselected but ready scene wait for a checked radio. The later
  screenshot/canvas and closed-page symptoms were not sufficient evidence that
  the capture API itself caused the delay.
- A visible semantic radio bridge alone does not establish Standard fallback.
  CCPP-009C3B now records selected value by reading the required bridge and
  treating the checked descendant as optional, while still failing when the
  required scene or bridge is missing.
- The prior adapter description treated a browser frame after `ctx.quit()` as
  disposal completion. CCPP-009C3B changed the contract so completion is the
  installed Kaplay cleanup notification, observed via `ctx.onCleanup(...)`.
- The 009C3B review package and final current-source browser result are
  recorded in
  `docs/AUDIT_009C3B_Evidence_Capture_Confirmed_Teardown.md`; this note keeps
  the historical 009C3A `7 passed / 2 failed` browser results unchanged.

## Scope

CCPP-009C3A was limited to the existing development/test Kaplay Match Result
surface:

- keep the prepared artwork, compact layout, continuous shove, and shared
  prediction-session architecture;
- keep initial startup as one shared outer-loader plus first-runtime budget;
- give post-ready logical-viewport replacement a bounded cycle;
- prevent obsolete runtime generations from allocating, adopting, dispatching,
  or reporting failure after supersession;
- inspect installed Kaplay initialization/quit behavior and add only the
  minimal adapter coordination needed for safe replacement;
- preserve dirty saved-session behavior and report browser screenshot/capture
  failures separately from interaction assertions.

No prediction session reducer, server API, artwork, Review/submission
animation, additional Kaplay screen, dependency upgrade, process-cleanup
redesign, or production rollout was added.

## Source Changes

- `imports/ui/predictions/PredictionPresentationHost.tsx`
  - Replaced the single immutable attempt deadline with mutable startup and
    replacement cycles owned by the same host attempt.
  - Preserved first startup semantics: preview module load and first runtime
    initialization share one overall budget.
  - Starts a fresh bounded replacement cycle only after a runtime has genuinely
    become ready and a later runtime start is requested.
  - Keeps repeated/superseded replacement work under the current replacement
    cycle instead of refreshing the deadline.
  - Adds per-runtime generation identity with an `AbortController`, canvas/stage
    eligibility checks, and adoption/failure guards.
  - Waits for known adopted-handle or partial-initialization disposal completion
    before allocating a replacement, bounded by the active cycle.
  - Keeps timeout/failure fallback on Standard with preserved session state and
    deliberate retry.
- `imports/ui/predictions/kaplay/matchResultRuntime.ts`
  - Adds optional `abortSignal` and `onDisposalComplete(...)` to the factory
    input.
  - Adds optional `disposalComplete` to the runtime handle.
  - Checks cancellation before test delays, after dynamic import, before Kaplay
    context creation, and while waiting for the required atlas.
  - Disposes a partially initialized Kaplay context if its generation is
    aborted before returning a ready handle.
  - Exposes disposal completion using the installed Kaplay `quit()` behavior:
    cleanup is requested with `quit()` and observed through the next frame.
- `tests/unit/prediction-presentation-host.test.ts`
  - Adds regressions for fresh post-ready replacement budgets, stalled
    replacement fallback, queued supersession before factory allocation,
    already-initializing supersession cleanup, and non-refreshing replacement
    timers.
- `tests/e2e/kaplay-prediction-preview.spec.ts`
  - Persists resize measurements before capture attempts.
  - Records capture results separately from measurement/interactions.
  - Adds bounded capture attempts and later switches critical resize/reduced
    evidence capture to canvas bitmap export after Playwright screenshot
    transport still consumed the journey in the planned batch.

## Installed Kaplay Findings

Installed Kaplay version: `3001.0.19`.

Inspected installed source via `node_modules/kaplay/dist/kaplay.mjs.map`:

- `kaplay(...)` warns and calls the previous global context's `quit()` when a
  second context is created while `_k.k` still exists.
- `quit()` registers cleanup on the next `frameEnd`.
- That cleanup calls `app.quit()`, clears GL bindings, destroys graphics
  resources, and runs registered cleanup callbacks.
- `app.quit()` synchronously sets the app stopped flag, removes canvas/document
  and window listeners, and disconnects the resize observer.
- The frame loop skips update/frame-end work while the document is hidden, so
  replacement must remain bounded rather than waiting indefinitely for hidden
  page cleanup.

The implementation therefore waits for known disposal completion before
replacement allocation, but the active startup/replacement cycle timeout still
decides fallback if the handoff cannot finish in time.

## Verification

Focused checks before browser execution:

- `meteor npm run test:unit -- tests/unit/match-result-motion.test.ts tests/unit/prediction-presentation-host.test.ts`
  - Passed: 2 files, 58 tests.
- `meteor npm run typecheck`
  - Passed.

Planned focused browser batch:

- Command:
  `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=/tmp/rugby-rooster-ccpp009c3a-browser-20260919 meteor npm run test:e2e -- tests/e2e/kaplay-prediction-preview.spec.ts --workers=1 --retries=0`
- Exit: code `1`, duration `170335ms`.
- Result: `7 passed / 2 failed` across 9 cases.
- Passed: default access, three-choice active shove, Off during shove, slow
  review recording, controlled failure/context loss, dirty saved custom
  prediction, and keyboard/legacy-enabled-false.
- Failed resize:
  - Initial measurement was persisted before capture.
  - Playwright screenshot and crop capture both stayed pending until the page
    closed at test timeout.
  - The test timed out before the first pointer click.
- Failed reduced motion:
  - Standard while reduced motion was requested passed.
  - Removing reduced motion reached `waitForKaplayReady`.
  - The first full-page screenshot stayed pending until the test timeout.

Correction browser batch after a directly justified capture-path correction:

- Command:
  `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=/tmp/rugby-rooster-ccpp009c3a-browser-correction-20260919 meteor npm run test:e2e -- tests/e2e/kaplay-prediction-preview.spec.ts --workers=1 --retries=0`
- Exit: code `1`, duration `167866ms`.
- Result: `7 passed / 2 failed` across 9 cases.
- Dirty saved custom prediction passed again.
- Failed resize:
  - Initial measurement JSON was persisted.
  - Canvas bitmap capture reported `kaplay-match-result-canvas` not visible.
  - The test still timed out before the first pointer click.
- Failed reduced motion:
  - Standard while reduced motion was requested passed.
  - Removing reduced motion reached `waitForKaplayReady`.
  - Canvas bitmap capture then reported the canvas not visible; the DOM snapshot
    showed the Standard radio bridge rather than a visible Kaplay canvas.

No further browser batches remain under the CCPP-009C3A budget.

## Evidence

Fresh evidence roots:

- `/tmp/rugby-rooster-ccpp009c3a-browser-20260919`
- `/tmp/rugby-rooster-ccpp009c3a-browser-correction-20260919`

Retained useful artifacts include:

- `playwright-stdout.log`, `playwright-stderr.log`, `exit.json`,
  `launch-manifest.json`, `runner-output.jsonl`, sanitized browser JSON, and
  Playwright failure artifacts for both browser attempts.
- Successful recordings:
  - `browser-artifacts/match-result-shove-normal-speed.webm`
  - `browser-artifacts/match-result-shove-slow-review.webm`
- Successful screenshots from passing cases:
  - `browser-screenshots/desktop-default-match-result-preview.png`
  - `browser-screenshots/desktop-default-match-result-selected.png`
  - `browser-screenshots/standard-after-fallback.png`
  - `browser-screenshots/standard-after-interruption.png`
- Resize measurement JSON from both attempts, with capture failure status.

Raw Playwright traces remain in the evidence roots for local diagnosis but are
excluded from the review archive.

## Remaining Limitations

- Browser resize acceptance is unresolved. The final run persisted the first
  desktop measurement but still timed out before any pointer selection.
- Browser reduced-motion reactivation is unresolved. The final run reached
  ready once after reduced motion was removed, but a visible canvas was absent
  by the capture step.
- Browser screenshot/canvas capture failures are recorded separately; they are
  not treated as successful visual acceptance.
- Mocked/runtime React tests are passing, but this audit does not declare
  completion from mocked runtime tests alone.

## Review Package

Created review ZIP:

`rugby-rooster-ccpp009c3a-bounded-resize-browser-closeout-eomd-20260919.zip`

Archive verification:

- `unzip -t rugby-rooster-ccpp009c3a-bounded-resize-browser-closeout-eomd-20260919.zip`
  passed with no errors.
- Representative PNGs opened with `identify`:
  - `desktop-default-match-result-preview.png` at `1280 x 1628`;
  - resize failure `test-failed-1.png` at `1280 x 900`.
- Representative WebMs probed with `ffprobe` as VP8 at `924 x 667`:
  - `match-result-shove-normal-speed.webm`;
  - `match-result-shove-slow-review.webm`.
- Original evidence files remained present after packaging.
- Archive size observed with `ls -lh`: `6.8M`.

The package includes changed host/runtime/test/docs files, relevant unchanged
session/layout/Kaplay context, the source and public Rooster shove
atlas/manifest, focused tests, sanitized logs and browser JSON from both
current-source browser attempts, resize measurement JSON, successful
screenshots/recordings from passing cases, and useful failure screenshots/videos
for the unresolved resize and reduced-motion cases. It excludes dependencies,
Meteor build caches, raw Playwright trace ZIPs, raw process snapshots,
credentials, private settings, and unrelated archives.
