# CCPP-010A2 Match Result Motion Refinement Audit

## Scope

CCPP-010A2 is a small presentation-only refinement after accepted
CCPP-010A1. It preserves the 010A architecture:

```text
usePredictionSession
    -> single React/HTML prediction experience
    -> optional CSS/browser animation
```

No session ownership, server API, persistence, Kaplay, Tries behavior,
Conversions, Penalties, Drop Goals, Cards, custom-question, Review, or other
prediction-step redesign work is included.

## Implementation

- `imports/ui/predictions/reactPredictionPresentation.tsx`
  - Keeps real React radio controls authoritative.
  - Adds a presentation-only `revealing` phase after a deliberate new Match
    Result choice.
  - During reveal, the selected real radio-card remains selected and rises above
    the rejected choices with z-order/elevation styling.
  - Decorative rejected-choice copies and the Rooster remain `aria-hidden` and
    noninteractive.
  - Animation completion settles to a selected-only hero state. Resize,
    orientation, sprite-load failure, Animations Off, reduced motion, Change,
    Back, or Continue leave the selected answer intact and remove obsolete
    decoration.
  - Selecting the already-current answer from Change still returns to settled
    without a duplicate domain update or replayed shove.
- `client/main.css`
  - Slows the shove layer from the prior 760ms cadence to a 1200ms visual
    sequence.
  - Adds a short selected-card rise before contact, then pushes rejected choices
    away while the selected card stays in place.
  - Adds a short hero-settle enlargement on normal completion.
  - Adds the exact settled label `YOU SELECTED:` above the selected card.
  - Enlarges the selected card substantially on desktop while capping and
    stacking the mobile hero layout so 390px and 360px widths remain readable.
- `tests/unit/prediction-presentation-host.test.ts`
  - Covers immediate shared action dispatch, the reveal phase, selected-card
    rise classes, settled hero label, selected-only settled state, Change
    behavior, Animations Off parity, reduced-motion parity, interruption
    safety, sprite-load cancellation, normal completion, and same-answer
    reselection without duplicate updates.
- `tests/e2e/react-prediction-presentation.spec.ts`
  - Refreshes the focused Match Result evidence test for before-selection,
    selected rise, Rooster contact/push, desktop/390px/360px hero settled
    states, and a normal-speed WebM.
  - Uses animation-preserving screenshots for motion stills so evidence capture
    does not fast-forward finite CSS animations.

## Visual Evidence

Final retained evidence lives under:

```text
test-results/ccpp010a2
```

Required 010A2 artifacts:

- `browser-screenshots/010a2-match-result-before-selection.png`
- `browser-screenshots/010a2-match-result-selected-rise.png`
- `browser-screenshots/010a2-match-result-contact-push.png`
- `browser-screenshots/010a2-match-result-settled-hero-desktop.png`
- `browser-screenshots/010a2-match-result-settled-hero-390.png`
- `browser-screenshots/010a2-match-result-settled-hero-360.png`
- `browser-videos/010a2-match-result-rise-shove-hero-normal-speed.webm`

Visual inspection notes:

- Before-selection screenshot shows three real Match Result choices.
- Rise screenshot shows the selected answer elevated above the rejected options.
- Contact/push screenshot shows the Rooster visible and pushing rejected
  choices while the selected answer remains fixed.
- Settled screenshots show `YOU SELECTED:`, one enlarged selected card, and
  `Change my selection`.
- Desktop, 390px, and 360px hero states remain readable, with the mobile hero
  stacking the selected radio above the team label to preserve width.

## Verification

Focused checks run during implementation:

- `meteor npm exec vitest run --config vitest.config.mts tests/unit/prediction-presentation-host.test.ts`
  - Passed: 1 file, 17 tests.
- `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=test-results/ccpp010a2 npm run test:e2e -- tests/e2e/react-prediction-presentation.spec.ts -g "captures the refined Match Result rise, shove, and selected hero" --workers=1 --retries=0`
  - Initial sandboxed run exited before tests with no failed test recorded.
  - Escalated browser runs exposed and then verified fixes for a TypeScript
    overlay-prop mismatch, animation-fast-forwarded screenshot capture, and
    mobile hero text readability.
  - Final focused browser batch passed: 1 test.

Static closeout checks:

- `meteor npm run typecheck`
  - Passed.
- `meteor npm run lint`
  - Passed.
- `meteor npm run lint:project`
  - Passed.
- `./node_modules/.bin/prettier --write ...changed files...`
  - Applied formatting to source/test files; CSS and docs were unchanged.
- `./node_modules/.bin/prettier --check ...changed files...`
  - Passed.
- `git diff --check`
  - Passed.

## Architecture Notes

- The active prediction route still flows through `usePredictionSession(...)`
  and one React/HTML presentation.
- React controls remain authoritative for answers.
- Animations On/Off and reduced motion keep the same essential controls.
- Kaplay remains unused by the active prediction flow.
- The animation adds only local presentation phase state. It does not own answer
  state, validation, navigation, persistence, or server communication.

## Review Package

The EOMD package is created at the repository root after final static closeout:

```text
rugby-rooster-ccpp010a2-match-result-motion-refinement-eomd-20260919.zip
```

It includes copied source, focused tests, docs, retained evidence screenshots,
the normal-speed WebM, and this verification record. Repository originals are
not moved or removed.
