# CCPP-010A3 Match Result Lift Clean Shove Audit

## Scope

CCPP-010A3 remains a presentation-only Match Result correction. This revised
pass replaces the insufficient small selected-card lift with a true two-level
stage:

```text
selected answer upper tier
visible gap
Rooster transit lane -> rejected decorative copies
```

No prediction/session/domain logic, server behavior, scoring logic, Tries
behavior, Kaplay, canvas, duplicate answer state, or later prediction steps were
changed.

## Implementation

- `imports/ui/predictions/reactPredictionPresentation.tsx`
  - Measures the actual selected card and stage geometry at selection time.
  - Writes per-selection CSS variables for selected lift, selected horizontal
    tier position, rooster lane top/height, rooster entry/underpass/contact/exit
    x positions, and rejected-copy pack positions.
  - Keeps the selected real radio card visible, checked, enabled, and above the
    decorative shove layer during reveal.
  - Keeps rejected real controls mounted only for layout continuity while
    `visibility:hidden`, disabled, `aria-hidden`, and noninteractive.
  - Adds `match-result-rooster-lane` as a deterministic browser-measurement
    target.
- `client/main.css`
  - Gives the Match Result stage an internal upper-tier reserve before the
    choices, with compact and settled-state adjustments.
  - Animates the selected card to the measured upper tier before rooster travel.
  - Holds rooster entry until after the lift/readable moment, then moves through
    measured underpass, contact, push, and exit points.
  - Keeps the decorative layer pointer-inert and clips only the shove layer, not
    the lifted selected card.
- `tests/e2e/react-prediction-presentation.spec.ts`
  - Measures selected-before, selected-lifted, rooster transit, lane geometry,
    clearance, and rejected-control state.
  - Asserts `selectedLifted.bottom + 16 <= roosterTransit.top`.
  - Asserts a meaningful horizontal underpass overlap before capturing the
    underpass frame.
  - Captures normal, lift-complete, underpass, contact, push, settled hero, and
    390px/360px responsive evidence.
- `tests/unit/prediction-presentation-host.test.ts`
  - Covers the variable-driven lift CSS, revealing-stage space, delayed rooster
    underpass timing, and hidden rejected real controls.

## Evidence

Final retained evidence lives under:

```text
test-results/ccpp010a3-revised
```

Key artifacts:

- `browser-screenshots/010a3-match-result-normal.png`
- `browser-screenshots/010a3-match-result-lift-complete.png`
- `browser-screenshots/010a3-match-result-underpass.png`
- `browser-screenshots/010a3-match-result-contact.png`
- `browser-screenshots/010a3-match-result-push.png`
- `browser-screenshots/010a3-match-result-settled-hero.png`
- `browser-screenshots/010a3-match-result-lift-complete-390.png`
- `browser-screenshots/010a3-match-result-underpass-390.png`
- `browser-screenshots/010a3-match-result-settled-hero-390.png`
- `browser-screenshots/010a3-match-result-lift-complete-360.png`
- `browser-screenshots/010a3-match-result-underpass-360.png`
- `browser-screenshots/010a3-match-result-settled-hero-360.png`
- `browser-videos/010a3-match-result-lift-clean-shove-normal-speed.webm`
- `browser-measurements/010a3-match-result-lift-clean-shove-measurements.json`

Objective geometry from the retained JSON:

- Desktop selected top before: `822`; lifted top: `774`; lift:
  `48` CSS px.
- Desktop selected lifted bottom: `886`; rooster transit top: `975`;
  clearance: `89` CSS px.
- 390px selected top before: `459`; lifted top: `309`; lift:
  `150` CSS px.
- 390px selected lifted bottom: `405`; rooster transit top: `494`;
  clearance: `89` CSS px.
- 360px selected top before: `591`; lifted top: `333`; lift:
  `258` CSS px.
- 360px selected lifted bottom: `429`; rooster transit top: `518`;
  clearance: `89` CSS px.
- Required clearance in the test: `16` CSS px.

Rejected-control evidence:

- During lift/contact, active real Match Result radio count is `1`.
- Decorative shove-card count is `2`.
- Decorative overlay button/input count is `0`.
- Rejected real controls report `aria-hidden: "true"`, `disabled: true`, and
  `visibility: "hidden"`.
- The selected real control reports `checked: true`, `disabled: false`, and
  `visibility: "visible"`.

Manual inspection of retained screenshots:

- Normal shows three real choices.
- Lift complete shows the selected card in the upper tier with no rooster
  arrived.
- Underpass shows the rooster visibly below the selected card with background
  air between them.
- Contact shows the rooster reaching the decorative rejected cards after the
  underpass.
- Push shows the rejected group moving right with no ghost originals.
- Settled hero shows `YOU SELECTED:`, one enlarged selected card, and
  `Change my selection`.

## Verification

Focused checks run:

- `meteor npm exec vitest run --config vitest.config.mts tests/unit/prediction-presentation-host.test.ts`
  - Passed: 18 tests.
- `meteor npm run typecheck`
  - Passed.
- `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=test-results/ccpp010a3-revised npm run test:e2e -- tests/e2e/react-prediction-presentation.spec.ts -g "captures the CCPP-010A3 Match Result lift and clean shove" --workers=1 --retries=0`
  - Sandboxed run exited before executing tests and recorded no failed tests.
  - Approved local-browser runs were used to correct and retain visual evidence.
  - Final run passed: 1 Chromium test.

Static closeout checks are recorded in the final task response.

## Architecture Notes

- The active prediction route still flows through `usePredictionSession(...)`
  and the React/HTML presentation.
- React radio controls remain authoritative for selected answers.
- The shove layer remains decorative, `aria-hidden`, and noninteractive.
- Rejected real controls stay mounted only for reveal-layout continuity and are
  visually hidden plus disabled during that phase.
- Kaplay and canvas remain unused by the active prediction flow.
