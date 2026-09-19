# CCPP-010A3 Resume Checkpoint

## Current Goal

CCPP-010A3 fixes Match Result presentation defects only:

- selected answer must lift into a true upper tier before the Rooster enters;
- the Rooster must run underneath that selected answer with visible clearance;
- rejected real controls must not ghost underneath decorative shove copies.

Do not begin Tries, Conversions, Penalties, Drop Goals, Cards, custom
questions, Review, quiz, Kaplay, canvas, server, scoring, prediction-session, or
architecture work from this checkpoint.

## Implementation Status

- [x] Selected answer updates immediately through the shared session.
- [x] Reveal geometry is measured from the real selected card and Match Result
      stage at selection time.
- [x] Selected real card moves to an upper tier before rooster entry.
- [x] Rooster entry waits until after lift completion and a brief readable
      moment.
- [x] Rooster transit lane is below the selected card with measured clearance.
- [x] During reveal, rejected real controls remain layout-preserving but are
      `visibility:hidden`, disabled, `aria-hidden`, and noninteractive.
- [x] Decorative rejected copies remain `aria-hidden`, pointer-inert, and
      noninteractive.
- [x] Selected real control remains visible, checked, enabled, and unshoved.
- [x] Settled state remains `YOU SELECTED:`, one large selected card, and
      `Change my selection`.
- [x] Change, resize/orientation, animation end, sprite load failure,
      Animations Off, reduced motion, Back, and Continue clear stale
      decorative/hidden state while preserving the selected answer.

## Evidence

Final evidence folder:

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

Measured retained clearance:

- Desktop: selected bottom `886`, rooster top `975`, clearance `89`.
- 390px: selected bottom `405`, rooster top `494`, clearance `89`.
- 360px: selected bottom `429`, rooster top `518`, clearance `89`.
- Required clearance: `16` CSS px.

Measured retained lift:

- Desktop: top `822` -> `774`, displacement `48`.
- 390px: top `459` -> `309`, displacement `150`.
- 360px: top `591` -> `333`, displacement `258`.

Clean shove evidence:

- Active real radio count during lift/contact: `1`.
- Decorative rejected card count during lift/contact: `2`.
- Decorative overlay interactive controls: `0`.
- Rejected real controls during lift/contact: `aria-hidden`, disabled, and
  `visibility:hidden`.

## Checks Run

- `meteor npm exec vitest run --config vitest.config.mts tests/unit/prediction-presentation-host.test.ts`
  - Passed: 18 tests.
- `meteor npm run typecheck`
  - Passed.
- Focused browser evidence command:
  `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=test-results/ccpp010a3-revised npm run test:e2e -- tests/e2e/react-prediction-presentation.spec.ts -g "captures the CCPP-010A3 Match Result lift and clean shove" --workers=1 --retries=0`
  - Sandboxed attempt exited before tests with no failed test recorded.
  - Approved local-browser runs were used to correct the visual evidence.
  - Final run passed: 1 Chromium test.

Run static closeout checks before packaging or handoff.
