# Rugby Rooster React Prediction Experience

## Purpose

CCPP-010A makes the active player prediction experience React-first. CCPP-010A1
keeps that architecture and closes small Match Result presentation follow-ups.
Real React/HTML controls own prediction entry for the active route. Optional
browser-native animation is a decorative layer over those same controls; it is
not a second answer model, validation path, navigation path, or persistence
path.

This document records the current durable direction after the CCPP-009 Kaplay
prototype work:

- React/HTML controls are authoritative for prediction answers.
- Animations On and Animations Off use the same essential interface.
- Reduced-motion policy suppresses optional motion while keeping the same
  controls.
- Kaplay prediction-control modules are superseded and disconnected from the
  active prediction route.
- Kaplay remains installed as an available capability for future genuine
  gameplay if a later milestone chooses it.

The half-time quiz remains only a future idea. It is not implemented by
CCPP-010A.

## Source Map

- `imports/ui/pages/PredictionEntryPage.tsx` owns the route, subscriptions,
  `usePredictionSession(...)`, Intro/step/Review/read-only screens, and active
  React-first renderer wiring.
- `imports/ui/predictions/PredictionPresentationHost.tsx` owns only the
  Animations On/Off preference, reduced-motion observation, and presentation
  options passed into the React renderer.
- `imports/ui/predictions/reactPredictionPresentation.tsx` contains the
  React-first Match Result and Tries presentations.
- `imports/ui/predictions/presentationPreference.ts` owns resilient
  browser-storage handling for the animation preference.
- `imports/ui/predictions/reducedMotion.ts` observes the browser
  `prefers-reduced-motion` media query.
- `client/main.css` contains the optional Match Result shove and Rooster frame
  animation CSS.
- `public/assets/rooster/match-result/frames/` contains the stacked PNG frames
  used by the browser animation.

## Active Ownership

`usePredictionSession(...)` remains above presentation. It owns:

- the single editable `PredictionFormState`;
- current Intro, numbered step, or Review location;
- selected message variants;
- Review edit context;
- expected revision and latest saved baseline;
- dirty/discard state;
- conflict and submission feedback;
- all navigation guards and submission behavior.

The React presentation consumes `PredictionSessionRendererState` and
`PredictionSessionActions`. It adapts DOM events into semantic commands such as
`selectBuiltInChoice('matchResult', value)` and
`changeTeamNumericField(side, 'tries', value)`.

## Match Result

The active Match Result step renders real HTML radio controls for:

- team one;
- team two;
- Draw.

When no Match Result answer exists, all three radio-card controls are present
and keyboard usable. Choosing an answer updates the shared session immediately
through the same React action path. The selected answer then becomes the only
real radio-card shown in the settled state, accompanied by the `You picked ...`
status and a real `Change my selection` button. Rejected choices are not
focusable or announced as available choices in the settled state.

`Change my selection` returns immediately to the three real radio-card choices.
It preserves the current answer until another choice is deliberately selected,
does not dirty or update the answer merely by opening the choices, and cancels
any obsolete decorative shove layer. Selecting the already-current answer again
returns to the settled selected-only state without dispatching another domain
update or starting a new shove.

A deliberate new choice may create a short decorative shove overlay when
animations are enabled. The overlay is `aria-hidden`, `pointer-events: none`,
and uses no focusable controls. Animation completion, resize/orientation
cancellation, Animations Off, reduced motion, Back/Continue navigation, and
sprite-load failure only remove the decorative overlay; they do not navigate,
validate, submit, save, or clear the selected answer.

Saved initial answers render directly as the selected-only settled state without
replaying the shove. Animations Off and reduced-motion states keep the same
choose, settled, and Change behavior and the same session validation.

## Tries

The active Tries step renders one React/HTML numeric panel for each team. Each
team panel reads the shared `tries` form value and dispatches every decrement,
typed edit, and increment through the same shared numeric action path:

```ts
changeTeamNumericField(side, 'tries', value);
```

Blank drafts and zero semantics stay in the existing form helpers. Decrement
buttons clamp at zero, direct edits accept only whole-number drafts or blank
input, and conversion clamping remains owned by the existing shared form/domain
helpers.

Animations On may run a small browser-native pulse on numeric changes.
Animations Off and reduced motion suppress that cosmetic motion only.

## Remaining Sequence

Only Match Result and Tries receive new React presentation components in
CCPP-010A. Conversions, Successful Penalty Kicks, Drop Goals, Cards, First Try,
Highest-Scoring Half, Half-Time Leader, custom questions, Review, edit,
submit, revise, discard, conflict recovery, and locked saved-entry display
remain on the existing React sequence and shared session.

No server prediction method changes are part of this milestone.

## Kaplay Status

The prediction route no longer imports, dynamically loads, initializes, or
renders the prediction-specific Kaplay runtime for the active prediction flow.
The old Kaplay Match Result preview/runtime source remains in the repository as
historical prototype/deferred-cleanup code:

- `imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx`
- `imports/ui/predictions/kaplay/matchResultRuntime.ts`
- `imports/ui/predictions/kaplay/matchResultMotion.ts`
- `imports/ui/predictions/kaplay/previewAttempt.ts`
- `imports/ui/predictions/presentationMode.ts`
- Kaplay-focused unit and browser specs

Do not reconnect those modules to the active prediction route during 010A
closeout. A later cleanup milestone may remove or archive prediction-specific
Kaplay code once review needs are satisfied.

## Historical Continuity

CCPP-009 work remains useful history. It produced:

- the shared prediction session boundary;
- animation preference and reduced-motion handling;
- prepared Rooster artwork;
- shove choreography and timing ideas;
- visual evidence and failure cases that informed the React-first decision.

CCPP-010A does not rewrite 009 as if it never happened. The unresolved 009
Kaplay resize failures are not fixed by 010A; they are no longer on the active
prediction path.
