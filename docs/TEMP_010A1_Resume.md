# CCPP-010A1 Resume Checkpoint

## Current Goal

CCPP-010A1 closes three small follow-ups after accepted CCPP-010A:

- remove stale player-facing `Standard prediction` Intro copy;
- restore Match Result selected-only settled presentation with
  `Change my selection`;
- capture complete normal-speed Rooster shove evidence.

Do not begin Conversions, Penalties, Drop Goals, Cards, custom questions,
Review redesign, half-time quiz, Kaplay cleanup, or prediction-step redesign.

## Architecture To Preserve

- `usePredictionSession(...)` owns prediction answers, navigation, validation
  state, saved baselines, conflict handling, and submission.
- `PredictionPresentationHost.tsx` owns only animation preference, reduced
  motion, and React presentation options.
- `reactPredictionPresentation.tsx` owns the React Match Result and Tries
  presentation controls.
- Optional Match Result animation is decorative, `aria-hidden`, and
  noninteractive.
- Kaplay remains installed and historical modules remain in source, but the
  active prediction route does not use Kaplay.

## Implementation Status

- [x] Intro copy changed from `Standard prediction` to `Make your prediction`.
- [x] Match Result choosing state shows three real radio-card controls.
- [x] Deliberate selection updates the shared action path once.
- [x] Settled state shows only the selected checked radio-card, `You picked ...`,
      and `Change my selection`.
- [x] Change restores the three choices without changing the current answer.
- [x] Current-answer reselection returns to settled without duplicate updates.
- [x] Saved/pre-existing selection initializes settled without replay.
- [x] Animations Off keeps the same choose/settled/Change behavior.
- [x] Resize, sprite failure, animation end, and Change-during-shove interrupt
      decorative layers safely.
- [x] Complete normal-speed browser evidence captured and visually inspected.
- [x] Documentation updated for 010A1 behavior and evidence.

## Evidence

Final evidence folder:

```text
test-results/ccpp010a1
```

Key files:

- `browser-screenshots/010a1-match-result-before-selection.png`
- `browser-screenshots/010a1-match-result-contact-frame.png`
- `browser-screenshots/010a1-match-result-settled-selected-only.png`
- `browser-videos/010a1-match-result-shove-normal-speed.webm`
- `video-review/010a1-shove-contact-sheet.png`
- `video-review/010a1-shove-animation-window.png`

Visual result:

- before state has three real radios;
- Rooster is visible in the recording and contact still;
- distinct running/pushing frames are visible in the WebM/contact sheets;
- rejected cards move with the Rooster and exit right;
- selected answer remains selected and is not shoved away;
- final settled state has one selected answer and `Change my selection`;
- no duplicate visible form controls in the settled state.

## Checks Run

- Focused component/unit:
  `meteor npm exec vitest run --config vitest.config.mts tests/unit/prediction-presentation-host.test.ts`
  passed 16 tests.
- Focused browser:
  `PATH="$PWD/node_modules/.bin:$PATH" RUGBY_ROOSTER_E2E_EVIDENCE_DIR=test-results/ccpp010a1 npm run test:e2e -- tests/e2e/react-prediction-presentation.spec.ts`
  passed 4 tests after one selector-defect rerun.

Static closeout:

- `meteor npm run typecheck` passed before and after the lint-driven source
  adjustment.
- `meteor npm run lint` initially failed on synchronous state clearing inside a
  React effect, then passed after deriving the invalid-value choosing state.
- `meteor npm run lint:project` passed.
- Scoped changed-file Prettier write was run.
- Scoped changed-file Prettier check passed.
- `git diff --check` passed.

The final focused browser evidence predates the lint-driven internal
derived-state cleanup. The cleanup did not change the selected-only UI contract
and the focused component suite was rerun successfully afterward.

## Package

Created package:

```text
rugby-rooster-ccpp010a1-match-result-polish-eomd-20260919.zip
```

Package source/evidence copies only. Do not remove repository originals.

Package inspection:

- `unzip -t` passed with no compressed-data errors.
- `zipinfo -1` showed only the curated source, docs, focused tests, CSS
  context, and 010A1 evidence paths.
