# CCPP-010A2 Resume Checkpoint

## Current Goal

CCPP-010A2 refines only the Match Result presentation after accepted
CCPP-010A1:

- make the Rooster shove slower and more readable;
- show the selected answer rising above rejected options before the shove;
- settle to a larger hero card with the exact label `YOU SELECTED:`.

Do not begin Conversions, Penalties, Drop Goals, Cards, custom questions,
Review redesign, half-time quiz, Kaplay work, or other prediction-step redesign.

## Architecture To Preserve

- `usePredictionSession(...)` owns prediction answers, navigation, validation
  state, saved baselines, conflict handling, and submission.
- `PredictionPresentationHost.tsx` owns animation preference and reduced-motion
  policy.
- `reactPredictionPresentation.tsx` owns the React Match Result and Tries
  controls.
- Optional Match Result animation is decorative, `aria-hidden`, and
  noninteractive.
- Kaplay remains unused by the active prediction route.

## Implementation Status

- [x] Match Result answer updates the shared session immediately.
- [x] Deliberate new animated selections enter a local presentation-only
      `revealing` phase.
- [x] The selected real radio-card rises above rejected options and is not
      pushed away.
- [x] Rooster/rejected-card decorative motion uses a 1200ms cadence.
- [x] Normal animation completion settles to an enlarged hero card.
- [x] Settled hero label reads exactly `YOU SELECTED:`.
- [x] `Change my selection` remains a real button and restores all three
      choices without changing the saved/current answer.
- [x] Reselecting the current answer avoids duplicate updates and avoids
      replaying the shove.
- [x] Animations Off and reduced motion keep the same functional flow without
      decorative shove motion.
- [x] Resize/orientation, sprite failure, Change during motion, Back, and
      Continue preserve the selected answer.
- [x] Desktop, 390px, and 360px settled hero evidence captured.

## Evidence

Final evidence folder:

```text
test-results/ccpp010a2
```

Key files:

- `browser-screenshots/010a2-match-result-before-selection.png`
- `browser-screenshots/010a2-match-result-selected-rise.png`
- `browser-screenshots/010a2-match-result-contact-push.png`
- `browser-screenshots/010a2-match-result-settled-hero-desktop.png`
- `browser-screenshots/010a2-match-result-settled-hero-390.png`
- `browser-screenshots/010a2-match-result-settled-hero-360.png`
- `browser-videos/010a2-match-result-rise-shove-hero-normal-speed.webm`

## Checks Run

- Focused component/unit:
  `meteor npm exec vitest run --config vitest.config.mts tests/unit/prediction-presentation-host.test.ts`
  passed 17 tests.
- Focused browser evidence:
  `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=test-results/ccpp010a2 npm run test:e2e -- tests/e2e/react-prediction-presentation.spec.ts -g "captures the refined Match Result rise, shove, and selected hero" --workers=1 --retries=0`
  passed 1 test in the final run.

Static closeout:

- `meteor npm run typecheck` passed.
- `meteor npm run lint` passed.
- `meteor npm run lint:project` passed.
- Changed-file Prettier write/check ran; final check passed.
- `git diff --check` passed.

Packaging is still to be completed if resuming before handoff.

## Package

Expected package name:

```text
rugby-rooster-ccpp010a2-match-result-motion-refinement-eomd-20260919.zip
```

Archive source/evidence copies only. Do not remove repository originals.
