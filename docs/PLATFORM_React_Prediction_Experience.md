# Rugby Rooster React Prediction Experience

## Purpose

CCPP-010A makes the active player prediction experience React-first. CCPP-010A1
keeps that architecture and closes small Match Result presentation follow-ups.
CCPP-010A2 refines only the Match Result motion timing and settled hero
treatment. CCPP-010A3 keeps the same contract and corrects only the Match Result
selected-card lift and rejected-card ghosting. CCPP-010B extends the same
React-first numeric language from Tries to Conversions, Successful Penalty
Kicks, and Drop Goals. Real React/HTML controls own prediction entry for the
active route.
Optional browser-native animation is a decorative layer over those same
controls; it is not a second answer model, validation path, navigation path, or
persistence path.

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
  React-first Match Result and score-building numeric presentations.
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
`changeTeamNumericField(side, field, value)`.

## Match Result

The active Match Result step renders real HTML radio controls for:

- team one;
- team two;
- Draw.

When no Match Result answer exists, all three radio-card controls are present
and keyboard usable. Choosing an answer updates the shared session immediately
through the same React action path. With animations enabled, a deliberate new
choice enters a short presentation-only reveal: the Match Result stage creates a
two-level arrangement, the selected real radio-card moves into an upper tier,
and the Rooster enters only after that lift has completed. The Rooster then runs
through a measured lane underneath the selected card with visible clearance
before contacting and pushing decorative rejected-choice copies away over a
roughly 1.8 second sequence. The selected answer is not pushed or moved away.
During this reveal, the original rejected real radio-card elements may remain
mounted only for layout continuity; they are visually hidden, disabled,
`aria-hidden`, and noninteractive while the decorative copies represent them.
The 1.8 second cadence is shared by the React settle timer, selected-rise CSS,
decorative layer lifetime, rejected-pack shove, Rooster travel, and sprite-frame
sequence. The separate final hero settle flourish remains a short transition.
The settled state then shows the selected answer as a larger hero card with the
exact label `YOU SELECTED:` above it and a real `Change my selection` button.
Rejected choices are not focusable or announced as available choices in the
settled state.

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
choose, settled, and Change behavior and the same session validation. The hero
card scales responsively: desktop gets the strongest enlargement, while narrow
phone widths cap the type and stack the selected radio above the label to keep
long team names readable.

## Numeric Score-Building Steps

The active Tries, Conversions, Successful Penalty Kicks, and Drop Goals steps
render through one small React/HTML numeric presentation family. Each team card
uses the fixture's actual team name, a derived predicted-score-so-far display,
one editable number input, and real decrement/increment buttons.

Each team panel reads the shared form value and dispatches every decrement,
typed edit, and increment through the same shared numeric action path:

```ts
changeTeamNumericField(side, field, value);
```

Blank drafts and zero semantics stay in the existing form helpers. Decrement
buttons clamp at zero, direct edits accept only whole-number drafts or blank
input, and increment buttons respect any field maximum exposed by the current
form helpers.

Conversions use the existing `setTeamPredictionField(...)` behavior as the
authority for the conversions-versus-tries relationship. The UI displays the
current try-derived ceiling for each team and sets the input `max` from the
same helper path, but it does not reimplement conversion validation. Direct
typing above the ceiling is normalized by the shared form update, and reducing
tries below existing conversions keeps the existing conversion-adjustment notice
from the session.

Penalty Kicks and Drop Goals use the same card/control family with no arbitrary
maximum. Deduction copy is the already-resolved sequence message copy derived
from the frozen fixture ruleset snapshot; presentation code does not duplicate
the 100-point or 150-point rates. Drop Goals also keeps the existing
result-consistency integration: once score-producing values are known, the
session exposes the warning and blocks Continue while the chosen Match Result
does not match the derived predicted scores.

Animations On may run a small browser-native pulse on numeric changes.
Animations Off and reduced motion suppress that cosmetic motion only.

## Remaining Sequence

After CCPP-010B, Match Result plus the four score-building numeric steps use
the React-first presentation components. Cards, First Try, Highest-Scoring
Half, Half-Time Leader, custom questions, Review, edit, submit, revise,
discard, conflict recovery, and locked saved-entry display remain on the
existing React sequence and shared session.

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
