# Rugby Rooster Kaplay Prediction Platform

## Purpose

CCPP-009B adds a bounded development/test preview of the Kaplay prediction
runtime. Standard remains the default presentation for ordinary use. The
preview covers one real screen only: the Match Result step.

The implementation proves lazy loading, mode switching, reduced-motion
handling, failure fallback, cleanup, and shared-session integration. It does
not implement rooster artwork, the shove animation, all prediction scenes,
animated Review/submission, or production default activation.

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
- `ctx.onError(...)` and `ctx.onLoadError(...)` for runtime and asset-load
  failure handling.

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

There is no barrel export that imports Kaplay eagerly.

## Activation

The preview is controlled by:

```json
{
  "public": {
    "rugbyRooster": {
      "kaplayPredictionPreview": {
        "enabled": true
      }
    }
  }
}
```

Absent or false means unavailable. `Meteor.isProduction` also keeps the preview
unavailable, so a production settings file cannot turn it on accidentally.
Stored browser preferences and query parameters cannot override the disabled
application gate.

Safe local activation:

1. Add `public.rugbyRooster.kaplayPredictionPreview.enabled: true` to a local
   development settings file.
2. Start Meteor with that settings file on a loopback URL.
3. Sign in normally and open a published fixture prediction route.
4. Start the prediction sequence, reach Match Result, and use the DOM
   `Animations` control.

The isolated Playwright settings enable the gate and additionally set
`testControls: true` for narrow client-only fault injection. That setting is
only used by preview browser tests and does not mutate prediction answers or
call server methods.

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
- Preview disabled -> Standard.
- Unsupported step -> Standard.
- Runtime failure -> Standard until explicit retry or deliberate On selection.
- Match Result + enabled gate + explicit On + no reduced motion + healthy
  runtime -> Kaplay preview.

No stored preference defaults to Off. Explicit On/Off is retained in
`localStorage` under `rugby-rooster:prediction-animations`. Acquisition of
`window.localStorage` itself is protected, so a throwing browser storage getter
is treated as unavailable storage. Storage getter exceptions, missing storage,
malformed values, `getItem` failures, and `setItem` failures fall back to Off
or no-op persistence and never block prediction entry. If persistence is
unavailable, the mounted UI still keeps the player's current On/Off choice in
memory across rerenders.

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

This is a focused bridge for the first screen, not a full accessibility
redesign of every future animated scene.

## Test Coverage

Unit coverage:

- `tests/unit/prediction-presentation-mode.test.ts`
- `tests/unit/prediction-presentation-host.test.ts`

The presentation host tests use real React effects/state with controlled
preview loaders, runtime promises, timers, and per-handle disposal counters.
They cover storage acquisition failure, unavailable persistence retention,
outer import timeout/retry, one shared deadline budget, late module/runtime
resolution, late rejection, retry isolation, unmount disposal, timer cleanup,
and Strict Mode replay.

Browser coverage:

- `tests/e2e/kaplay-prediction-preview.spec.ts`

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

CCPP-009B2 keeps the browser-test success/failure distinction strict:
success-path assertions require the real stage, visible canvas, and actual
canvas interaction. Standard fallback is accepted only after a test has
deliberately triggered a renderer failure. The dirty saved-session failure test
must first reach a real ready runtime and interact with the canvas before
checking Standard recovery and persisted-revision preservation.

## Limitations

- Match Result is the only Kaplay screen.
- No rooster sprite, shove animation, or production artwork is included.
- No Review/submission animation is included.
- No FPS benchmark or automatic quality tier is included.
- No production/default rollout is included.
- Test-only failure controls are client-only and gated by isolated preview
  settings; they are not a production admin or fault-injection system.
