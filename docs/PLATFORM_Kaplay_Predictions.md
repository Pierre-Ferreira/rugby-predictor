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
  preference/effective-mode switching below the shared session owner.
- `imports/ui/predictions/presentationMode.ts` contains the pure preview gate,
  supported-step, and effective-mode projection.
- `imports/ui/predictions/presentationPreference.ts` contains the resilient
  browser-storage preference helper.
- `imports/ui/predictions/reducedMotion.ts` observes
  `prefers-reduced-motion`.
- `imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx` renders the
  one-screen Match Result preview and semantic DOM bridge.
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
`localStorage` under `rugby-rooster:prediction-animations`. Storage exceptions,
missing storage, and malformed values fall back to Off and never block
prediction entry.

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

While loading, the host keeps a DOM action available:

`Continue without animations`

That action switches the preference to Off and leaves the player at the same
session location.

Failures handled through the same recovery path include:

- dynamic import rejection;
- initialization exception;
- initialization timeout;
- runtime callback failure;
- KAPLAY `onError`;
- KAPLAY `onLoadError`;
- `webglcontextlost` on the owned canvas.

Recovery disposes owned runtime resources, renders Standard at the same session
location, and shows:

`Animations couldn't continue. Your answers have been kept.`

The copy intentionally does not claim that answers were saved. The failure is
latched for the current session until `Retry animations` or a deliberate On
selection. Server validation errors, stale prediction conflicts, and failed
saves are not treated as renderer failures.

## Cleanup And Runtime Safety

Each runtime generation owns its canvas listeners, document visibility listener,
KAPLAY event controllers, context, and cleanup callbacks. Teardown is
idempotent and calls `ctx.quit()` in addition to removing adapter-owned
listeners/controllers.

Late success or failure from an obsolete initialization attempt is ignored. If
a late runtime handle is created after the generation was invalidated, it is
disposed immediately.

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

New unit coverage:

- `tests/unit/prediction-presentation-mode.test.ts`
- `tests/unit/prediction-presentation-host.test.ts`

New browser coverage:

- `tests/e2e/kaplay-prediction-preview.spec.ts`

The browser spec uses the existing isolated auth/fixture helpers and runs only
against local loopback. It does not send real email or perform broad database
cleanup.

Intentional screenshot evidence is written to `test-results/ccpp009b/`.

## Limitations

- Match Result is the only Kaplay screen.
- No rooster sprite, shove animation, or production artwork is included.
- No Review/submission animation is included.
- No FPS benchmark or automatic quality tier is included.
- No production/default rollout is included.
- Test-only failure controls are client-only and gated by isolated preview
  settings; they are not a production admin or fault-injection system.
