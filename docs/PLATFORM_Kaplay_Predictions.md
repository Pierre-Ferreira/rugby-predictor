# Rugby Rooster Kaplay Prediction Platform

## Purpose

CCPP-009B adds a bounded development/test preview of the Kaplay prediction
runtime. CCPP-009B4 makes the already-built Match Result surface available
automatically in ordinary local development. The preview covers one real screen
only: the Match Result step. CCPP-009C adds the first prepared Rooster shove
visual foundation to that same screen. CCPP-009C1 corrects that screen's
contact-to-push continuity, full-character exit projection, compact readability
projection, and intended browser evidence path. CCPP-009C2 makes the compact
stage height content-driven, propagates that stage through runtime/canvas
sizing, and preserves fresh integrated playback and mobile layout evidence.
CCPP-009C3 synchronizes runtime logical dimensions with measured desktop and
compact layout changes by replacing only the current runtime generation when the
projected stage dimensions genuinely change. CCPP-009C3A bounds post-ready
replacement cycles, adds per-runtime generation ownership before allocation,
and records that focused browser resize/reduced-motion closeout remains
unresolved after the permitted runs. CCPP-009C3B corrects the selected-answer
evidence helper so an unselected ready bridge returns `null`, and changes
runtime teardown completion to the installed Kaplay cleanup notification.

The implementation proves lazy loading, mode switching, reduced-motion
handling, failure fallback, cleanup, and shared-session integration. It does
not implement all prediction scenes, animated Review/submission, or production
activation.

## Dependency

Kaplay is installed from npm as `kaplay@3001.0.19`. The lockfile resolves the
same version.

Implementation uses the installed version's documented and locally declared
APIs:

- `kaplay(gopt?: KAPLAYOpt)` for context creation.
- An explicitly owned `canvas`.
- `global: false` so runtime functions are accessed from the returned context.
- `pixelDensity`, `maxFPS`, `touchToMouse: false`, `loadingScreen: false`, and
  `focus: false` for conservative preview behavior.
- `ctx.quit()` for engine teardown.
- `ctx.onCleanup(...)` as the authoritative installed cleanup-complete
  notification after `quit()` has run Kaplay's frame-end cleanup path.
- `ctx.onError(...)` and `ctx.onLoadError(...)` for runtime and asset-load
  failure handling.
- `ctx.width()` and `ctx.height()` for test-control-gated evidence of the
  configured logical viewport.
- `ctx.onResize(...)` exists as an observer in the installed declarations, but
  no supported logical-size setter is declared. Resize synchronization therefore
  uses bounded runtime replacement for logical viewport changes instead of
  assuming an in-place Kaplay resize API.

CCPP-009B does not load Kaplay from a CDN and does not replace Meteor's
bundler.

## Source Map

- `imports/ui/pages/PredictionEntryPage.tsx` keeps route, auth,
  subscriptions, read-only persisted display, feedback, and the shared session
  owner.
- `imports/ui/predictions/PredictionPresentationHost.tsx` owns preview
  preference/effective-mode switching, the end-to-end preview attempt, the
  outer preview-module loader, deadline, retry, failure latch, and late runtime
  disposal below the shared session owner.
- `imports/ui/predictions/presentationMode.ts` contains the pure preview gate,
  supported-step, and effective-mode projection.
- `imports/ui/predictions/presentationPreference.ts` contains the resilient
  browser-storage preference helper.
- `imports/ui/predictions/reducedMotion.ts` observes
  `prefers-reduced-motion`.
- `imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx` renders the
  one-screen Match Result preview and semantic DOM bridge, and requests runtime
  startup through a host-owned attempt controller.
- `imports/ui/predictions/kaplay/previewAttempt.ts` contains the narrow
  controller contract between the host attempt owner and the preview component.
- `imports/ui/predictions/kaplay/matchResultRuntime.ts` dynamically imports
  Kaplay and owns context setup, canvas drawing, input hit testing, error
  hooks, visibility pause, and teardown.
- `imports/ui/predictions/kaplay/matchResultMotion.ts` owns the 009C
  framework-independent Match Result layout, hit testing, readable compact text
  projection, rooster shove timing, transformed Rooster bounds, rejected-choice
  offset projection, and generated atlas constants.
- `imports/ui/predictions/kaplay/roosterShoveManifest.generated.json` is the
  generated source-side copy of the prepared Rooster atlas manifest.

There is no barrel export that imports Kaplay eagerly.

## Activation

In ordinary non-production development, supported Kaplay prediction screens are
available automatically. No settings JSON edit, query parameter, developer
console command, or first-click On activation is required.

The old development setting
`public.rugbyRooster.kaplayPredictionPreview.enabled` is retired as the
availability gate. Missing, `true`, and legacy `false` values all allow
supported screens in local development. `Meteor.isProduction` still keeps the
preview unavailable, so this is not a production rollout.

Normal local workflow:

1. Start the app normally, for example `npm start` for a plain local run or
   `npm run start:email` when using the local development settings file.
2. Sign in normally and open an editable published fixture prediction route.
3. Intro renders through Standard.
4. Start the prediction sequence and reach Match Result.
5. Kaplay appears automatically when the player has no explicit Off preference
   and reduced motion is not requested.
6. Continue to the remaining unimplemented scenes, which use Standard.

The player-facing `Animations` On/Off control is the normal switch. The
isolated Playwright settings may set `testControls: true` for narrow
client-only fault injection. That setting is separate from UI availability, is
not inferred from development mode or Animations On, and does not mutate
prediction answers or call server methods.

## Ownership

The owner shape is:

```text
Route / authentication / subscriptions
                    |
          usePredictionSession(...)
                    |
          PredictionPresentationHost
             /                 \
         Standard        Kaplay preview
```

`usePredictionSession(...)` remains keyed only by account and fixture. It owns
answers, location, message variants, Review edit context, expected revision,
dirty/discard state, conflict feedback, and submission state.

The Kaplay runtime owns only presentation resources: canvas, KAPLAY context,
draw/update handlers, DOM listeners, hit-test rectangles, a short selection
pulse, and cleanup callbacks. It receives current snapshots from React and
dispatches only `selectBuiltInChoice('matchResult', value)` after current
session and step eligibility checks.

## Effective Mode Policy

The mode projection keeps these separate:

- application preview gate;
- player Animations On/Off preference;
- reduced-motion media preference;
- whether the current step supports Kaplay;
- runtime loading/ready/failed state.

Policy:

- Off -> Standard.
- Reduced motion -> Standard, with a DOM notice when On was requested.
- Production-disabled preview -> Standard.
- Unsupported step -> Standard.
- Runtime failure -> Standard until explicit retry or deliberate On selection.
- Match Result + development availability + default/stored On + no reduced
  motion + healthy runtime -> Kaplay preview.

No stored preference now defaults to On in development. Malformed stored values
are treated as unset and also default to On. Explicit stored On remains On, and
explicit stored Off remains Off. Explicit Off is never erased or renamed by the
application.

Explicit On/Off is retained in `localStorage` under
`rugby-rooster:prediction-animations`. Acquisition of `window.localStorage`
itself is protected, so a throwing browser storage getter is treated as
unavailable storage. Storage getter exceptions, missing storage, malformed
values, `getItem` failures, and `setItem` failures fall back to the in-memory
development default or no-op persistence and never block prediction entry. If
persistence is unavailable, the mounted UI still keeps the player's current
On/Off choice in memory across rerenders.

Standard presentation caused by Intro, unsupported steps, reduced motion,
runtime failure, or read-only state is not written as Off. `Continue without
animations`, selecting Off, and other intentional player actions remain
explicit Off choices.

The stored preference never contains answers, revisions, account identifiers,
fixture identifiers, tokens, or submission data.

## Supported Screen

CCPP-009B supports only the Match Result step.

The preview renders:

- current shared question, helper, deduction, and supporting state;
- the fixture's real first team name;
- the fixture's real second team name;
- Draw;
- current selected state;
- `You picked ...` feedback;
- shared Back, Continue, and Return-to-Review controls where applicable;
- a visible semantic DOM radio bridge for keyboard and assistive technology.

The Match Result shove is intentionally short at `0.76` seconds. Push movement
starts from the actual contact endpoint, so the Rooster and rejected group do
not jump backward at the contact-to-push boundary. The exit calculation uses the
layout stage, manifest contact anchor, sprite scale, rejected-group geometry,
and offscreen margin; full transformed Rooster bounds and rejected-card bounds
are projected clear before the effect expires.

Compact Match Result layout is scale-aware rather than a simple desktop shrink.
The runtime projects text blocks, line wrapping, card bounds, focus bounds, hit
rectangles, and stage height from the same geometry. At 360 px and 390 px
portrait-style canvas widths in unit and browser evidence, selectable card
heights project to at least 44 CSS px and primary labels to at least 16 CSS px.
When a saved answer is already selected, the canvas presents the selected card
as intentionally non-hit-testable; the existing `Change my selection` action
restores the selectable choices before another canvas choice can be made.

Runtime startup waits for a positive measured canvas-shell width. React projects
the content-driven stage from that measured width and passes the projected
logical viewport to the runtime. Ordinary snapshot updates, focus changes,
message changes, selection updates, restored choices, and compact-to-compact
CSS width changes keep the existing runtime when the projected stage dimensions
remain equal. Desktop-to-compact and compact-to-desktop breakpoint changes
replace only the runtime generation below the shared prediction-session owner.

The runtime records the transform used for browser evidence: projected stage
coordinates render into the content rectangle inside the actual canvas CSS
bounds. Pointer input uses the inverse of that transform. Letterbox bars,
zero-sized measurements, and stale-stage transitions are not interactive.

If resize interrupts the short shove effect, the replacement is seeded from the
current selected snapshot and the transient effect is cancelled. The selected
answer remains visible, but the shove is not replayed as a new selection.

Intro, Tries, Conversions, Penalty Kicks, Drop Goals, Cards, First Try,
Highest-Scoring Half, Half-Time Leader, custom questions, Review, and locked
views use Standard in 009B.

When Continue leaves Match Result, the existing session navigation command runs
and the next step renders through Standard. That is a supported stage boundary,
not a runtime error.

## Loading, Failure And Retry

Initialization is bounded by
`KAPLAY_INITIALIZATION_TIMEOUT_MS = 10_000`.

CCPP-009B1 treats the complete path as one host-owned attempt:

```text
eligible preview attempt
        -> preview module load
        -> Kaplay runtime factory
        -> ready usable scene
```

The host starts the deadline before the preview component import begins. The
runtime factory receives only the remaining attempt lifetime as diagnostic
input; it does not get a second full timeout after the outer module finishes
loading. Ordinary rerenders and answer updates do not restart the attempt,
extend its deadline, or recreate the runtime.

After a runtime has genuinely become ready, a later logical-viewport
replacement starts a new bounded replacement cycle using the same timeout
constant. The replacement budget starts when the replacement is requested and
covers teardown coordination, runtime initialization, required asset readiness,
initial snapshot adoption, and synchronized readiness. Repeated measurements or
superseded geometry during the same unresolved replacement do not refresh that
deadline; newer eligible geometry invalidates the obsolete runtime generation
and continues under the same remaining budget. A separate resize after a
successful replacement may begin a new bounded cycle.

On replacement timeout or failure, the host follows the accepted fallback path:
the shared prediction session is preserved, Standard renders at the same
location, and retry remains deliberate through `Retry animations` or an
explicit On selection. A later resize notification does not automatically retry
a failed replacement.

While loading, the host keeps a DOM action available:

`Continue without animations`

That action switches the preference to Off and leaves the player at the same
session location.

Failures handled through the same recovery path include:

- dynamic import rejection;
- initialization exception;
- initialization timeout;
- runtime snapshot update exception during initial adoption;
- runtime snapshot update exception after readiness;
- runtime callback failure;
- KAPLAY `onError`;
- KAPLAY `onLoadError`;
- `webglcontextlost` on the owned canvas.

Recovery disposes owned runtime resources, clears the attempt deadline, renders
Standard at the same session location, and shows:

`Animations couldn't continue. Your answers have been kept.`

The copy intentionally does not claim that answers were saved. The failure is
latched for the current session until `Retry animations` or a deliberate On
selection. Server validation errors, stale prediction conflicts, and failed
saves are not treated as renderer failures.

Explicit Retry starts a fresh host attempt and invokes the preview loader again.
Successful module loads may still be cached by the browser/bundler. Re-invoking
the loader is bounded recovery for recoverable loader failures; it does not
promise recovery from permanently missing chunks, browser module-cache failures,
or broken module evaluation. Standard remains usable when retry cannot recover.

CCPP-009B2 adds regressions for runtime update failures during both adoption and
ready-state snapshot updates. In both cases the host disposes the runtime,
falls back to Standard at the same session location, and preserves the current
prediction answers in the shared session.

CCPP-009B3 verifies the focused Kaplay preview file with isolated evidence
capture. The historical preview/vendor/SockJS 503 responses did not reproduce
in the preserved baseline, so their root cause remains unconfirmed. The failure
that did reproduce was a saved-entry revisit boundary before the dirty Kaplay
segment: the server helper observed the saved row, but the browser initialized
from Intro before the current-entry subscription state was usable. The
correction lives in the shared prediction session rather than the Kaplay
runtime.

## Cleanup And Runtime Safety

Each runtime generation owns its canvas listeners, document visibility listener,
KAPLAY event controllers, context, and cleanup callbacks. Teardown is
idempotent and calls `ctx.quit()` in addition to removing adapter-owned
listeners/controllers.

The host assigns every runtime start a generation identity distinct from the
shared prediction session and the outer preview attempt. Before factory
allocation, before initial snapshot adoption, before ready publication, and
before failure reporting, the host checks that the parent attempt is still
eligible, the runtime generation remains current, it has not been stopped or
aborted, and its canvas/target stage are still usable. Obsolete queued starts
therefore cannot allocate just because a newer generation has put the parent
attempt back into `loading`.

The runtime factory receives an `AbortSignal`. The default Kaplay adapter checks
that signal before artificial test delays, after dynamic import, before context
creation, and while waiting for the required sprite atlas. If a generation is
aborted after a Kaplay context has been allocated but before the ready handle is
returned, the adapter disposes that context through the same idempotent
teardown path.

Installed Kaplay `3001.0.19` schedules `quit()` cleanup on the next `frameEnd`,
and `app.quit()` removes app listeners synchronously from that cleanup
callback. The adapter registers `ctx.onCleanup(...)` immediately after context
creation and exposes `disposalComplete` from that installed cleanup
notification. A requested `quit()`, a later browser frame, a removed canvas, or
a caught exception is not enough to confirm Kaplay cleanup.

Replacement allocation waits for any known adopted-handle or
partial-initialization disposal promise, bounded by the current startup or
replacement cycle. Pending cleanup remains visible across host work. If cleanup
rejects, the host follows the existing Standard fallback path instead of
allocating another runtime. If pending cleanup cannot complete inside the
cycle, Standard fallback wins rather than creating another live context to
escape the wait.

Late success or failure from an obsolete initialization attempt is ignored. If
a late runtime handle is created after the attempt or runtime-start generation
was invalidated, it is disposed immediately and never adopted as ready. Late
rejection is handled without reviving a stale error panel or affecting a newer
healthy retry attempt.

The host clears an attempt's deadline timer on readiness, failure, cancellation,
and disposal. A ready runtime remains owned by its attempt until Off,
unsupported-step handoff, reduced motion, read-only transition, route/session
departure, retry replacement, runtime failure, or unmount disposes it. Strict
Mode setup/cleanup/re-setup invalidates obsolete runtime-start work without
disposing the surviving runtime.

When the measured layout crosses a breakpoint and the projected logical stage
changes, the preview component asks the current attempt to start a new runtime
generation. The host marks the attempt loading for that generation, disposes the
previous adopted handle once, ignores stale callbacks, and disposes any late
obsolete handle that resolves after a newer generation or cancellation. The
shared `usePredictionSession(...)` owner is not remounted for these renderer
replacements.

If the runtime adapter throws after creating a Kaplay context but before
returning a handle, it calls the same engine teardown path before rejecting.

Pointer callbacks re-check the active generation and current session/step
eligibility before dispatching. Touch is handled through pointer events with
`touchToMouse: false`, so one physical activation dispatches one selection.

When the document becomes hidden, adapter update controllers are paused. On
return, the current React snapshot is still the source of truth; no accumulated
interactions are replayed.

## Accessibility

The canvas is not the only control. The Match Result preview includes visible
DOM radio buttons that consume the same state and dispatch the same shared
choice action as canvas pointer input. The question and helper text are DOM
content as well as canvas text. The external Animations control remains outside
the runtime and is usable while loading, failed, unavailable, or reduced-motion
blocked.

Browser evidence reads this bridge as required scene evidence. The checked
radio input is optional: an initially unselected ready bridge returns
`selectedValue: null`; a missing bridge or closed page remains a failed
evidence read.

This is a focused bridge for the first screen, not a full accessibility
redesign of every future animated scene.

## Test Coverage

Unit coverage:

- `tests/unit/match-result-motion.test.ts`
- `tests/unit/match-result-runtime.test.ts`
- `tests/unit/prediction-presentation-mode.test.ts`
- `tests/unit/prediction-presentation-host.test.ts`

The presentation host tests use real React effects/state with controlled
preview loaders, runtime promises, timers, and per-handle disposal counters.
They cover storage acquisition failure, unavailable persistence retention,
outer import timeout/retry, one shared deadline budget, late module/runtime
resolution, late rejection, retry isolation, unmount disposal, timer cleanup,
and Strict Mode replay.

The CCPP-009C3B runtime adapter tests use a controlled Kaplay context to prove
that `disposalComplete` does not settle from `quit()` or a browser frame, does
settle once from `onCleanup`, rejects when `quit()` fails or cleanup support is
missing, and keeps cleanup debt visible for cancellation during required asset
loading. The CCPP-009C3B host tests prove replacement allocation waits for
confirmed cleanup, rejected cleanup falls back to Standard, pending cleanup is
bounded by the existing deadline, Off cancels obsolete replacement work, and a
superseded partially initialized runtime must confirm cleanup before current
allocation.

Browser coverage:

- `tests/e2e/kaplay-prediction-preview.spec.ts`
- `tests/e2e/kaplay-layout-evidence-helper.spec.ts`

The browser spec uses the existing isolated auth/fixture helpers and runs only
against local loopback. It does not send real email or perform broad database
cleanup. CCPP-009B1 adds a same-session dirty saved-prediction scenario intended
to cover a real custom Number answer, custom Choice answer, actual Kaplay
readiness, controlled graphics-context loss, Standard fallback at the same edit
location, no automatic prediction write before explicit save, and a final
revised save that advances the saved revision by one. Current run status for
that scenario is recorded in the CCPP-009B1 audit rather than treated as a
platform guarantee.

Intentional screenshot evidence is written to `test-results/ccpp009b/`.

CCPP-009B4 adds a browser default-access path proving that no
`enabled:true` preview gate or prepopulated On preference is needed: Intro uses
Standard, Match Result loads the real Kaplay canvas automatically, canvas
selection updates shared prediction state, Off is respected when revisiting the
step, and choosing On restores the supported scene.

CCPP-009B2 keeps the browser-test success/failure distinction strict:
success-path assertions require the real stage, visible canvas, and actual
canvas interaction. Standard fallback is accepted only after a test has
deliberately triggered a renderer failure. The dirty saved-session failure test
must first reach a real ready runtime and interact with the canvas before
checking Standard recovery and persisted-revision preservation.

CCPP-009C extends the browser spec for the visual foundation: visual selection
paths use canvas pointer input, keyboard coverage uses focus and Space on the
semantic DOM bridge, and Standard-only paths use visible radio controls. The
009C continuation browser launch on 2026-09-18 exited before Playwright
executed test cases, so the final 009C audit records that browser verification
limitation separately from prior preserved browser evidence.

CCPP-009C1 further updates the browser spec so canvas selection targets the
runtime's actual projected choice rectangles and the canvas recorder waits for
recording start plus finalized media output. The bounded 009C1 browser batches
on 2026-09-18 also exited before executable test cases and produced no fresh
recordings or screenshots; see
`docs/AUDIT_009C1_Shove_Exit_Mobile_Evidence.md`.

CCPP-009C2 records the first successful fresh integrated Match Result playback
evidence for the compact-layout correction. The second permitted focused
browser attempt executed eight tests and recorded `7 passed / 1 failed`,
including normal-speed and slowed WebMs, contact sheets, desktop screenshots,
390 px and 360 px mobile screenshots/crops, and mobile measurement JSON. The
single failure reached the selected-answer presentation and attempted a
selectable canvas click before using `Change my selection`; the test sequence
was corrected after the run and was not rerun because the browser budget was
exhausted. See
`docs/AUDIT_009C2_Compact_Layout_Playback.md`.

CCPP-009C3 adds focused projection and React lifecycle regressions for
desktop-to-compact-to-desktop stage replacement, compact-to-compact updates
without replacement, ordinary snapshot updates without replacement, stale
replacement isolation, Off during replacement, late first measurement, and
selected-answer preservation when resize interrupts motion. Its fresh focused
browser run executed nine Kaplay cases with `7 passed / 2 failed`; the corrected
dirty saved-session case passed, but the new resize journey and a reduced-motion
mobile evidence path failed before a post-run measurement-deferral correction
could be rerun. See
`docs/AUDIT_009C3_Resize_Interaction_Verification.md`.

CCPP-009C3A extends the React lifecycle regressions for post-ready replacement
budgets, stalled replacement fallback, queued pre-allocation supersession,
already-initializing supersession, obsolete abort/disposal behavior, and
non-refreshing replacement timers. The focused unit/component run passed 58
tests. The permitted browser batches both executed nine cases with
`7 passed / 2 failed`: the dirty saved-session case passed, while resize and
reduced-motion remained unresolved. See
`docs/AUDIT_009C3A_Bounded_Resize_Runtime_Closeout.md`.

CCPP-009C3B adds the selected-value evidence helper regression and confirmed
Kaplay cleanup teardown regressions. Its helper check is reported as six passed
cases after an initial sandboxed browser-launch failure. Its focused unit
history is reported as 69 passed tests across motion, runtime adapter, and
React host coverage after a controlled harness correction. The final retained
full-app browser batch executed nine Kaplay cases with `8 passed / 1 failed`:
reduced motion and dirty saved-session recovery passed, while resize remained
unresolved after synchronized compact 390px readiness and later
`boundingBox()` timeout with Standard fallback visible. See
`docs/AUDIT_009C3B_Evidence_Capture_Confirmed_Teardown.md`.

## Limitations

- Match Result is the only Kaplay screen.
- Rooster artwork and a first-pass Match Result shove are included only for the
  009C visual foundation. CCPP-009C2 preserves fresh integrated playback and
  mobile evidence, but the recorded focused browser result remains `7 passed /
1 failed`; the unrerun dirty-session test correction must not be treated as
  full browser acceptance.
- CCPP-009C3 source and focused unit/component checks are complete, and the
  corrected dirty-session browser case passed, but full resize browser
  acceptance remains unresolved until the focused browser spec is rerun after
  the measurement-deferral correction.
- CCPP-009C3A source and focused unit/component checks are complete, and the
  dirty-session browser case continued to pass in both current-source browser
  batches. Full browser acceptance for the resize and reduced-motion journeys
  remains unresolved after the bounded attempts.
- CCPP-009C3B source and static closeout checks are complete, and its final
  retained browser batch improved to `8 passed / 1 failed`. Resize remains
  unresolved and the underlying host/runtime failure reason was not captured in
  the retained sanitized browser evidence.
- No Review/submission animation is included.
- No FPS benchmark or automatic quality tier is included.
- No production rollout is included.
- Test-only failure controls are client-only and gated by isolated test-control
  settings; they are not enabled by ordinary development availability,
  Animations On, or a production admin/fault-injection system.
