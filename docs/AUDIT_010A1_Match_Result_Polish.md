# CCPP-010A1 Match Result Polish Audit

## Scope

CCPP-010A1 is a small closeout milestone after accepted CCPP-010A. It preserves
the 010A architecture:

```text
usePredictionSession
    -> single React/HTML prediction experience
    -> optional CSS/browser animation
```

No scoring, persistence, session ownership, server API, Conversions, Penalties,
Drop Goals, Cards, custom-question, Review, half-time quiz, or Kaplay cleanup
work is included.

## Implementation

- `PredictionEntryPage.tsx`
  - Replaces the stale player-facing Intro eyebrow `Standard prediction` with
    `Make your prediction`.
- `reactPredictionPresentation.tsx`
  - Keeps the choosing state as three real Match Result radio-card controls:
    Team 1, Team 2, and Draw.
  - Moves a deliberate answer into a selected-only settled state with one
    checked radio-card, `You picked ...`, and a real `Change my selection`
    button.
  - Keeps rejected choices out of the settled focus/order and accessibility
    tree; decorative shove copies remain `aria-hidden` and noninteractive.
  - `Change my selection` cancels any obsolete decorative shove, restores all
    three real choices, preserves the current checked answer, and focuses the
    current choice where practical.
  - Selecting the already-current answer from the reopened choices returns to
    settled state without dispatching a duplicate answer update or starting a
    new shove.
  - Saved/pre-existing Match Result values initialize directly into the
    selected-only settled state without replaying the shove.
  - Resize/orientation, Animations Off, sprite-load failure, and animation
    completion only remove decorative layers; the selected answer remains in
    shared React state.
- `tests/unit/prediction-presentation-host.test.ts`
  - Adds focused React DOM coverage for initial choices, single dispatch,
    selected-only settled state, Change behavior, new-choice update,
    current-answer reselection, saved-selection initialization, Animations Off
    parity, resize interruption, Change-during-shove interruption, sprite-load
    cancellation, and normal animation completion.
- `tests/e2e/react-prediction-presentation.spec.ts`
  - Keeps the active route on the React presentation.
  - Adds one complete normal-speed Match Result Rooster shove evidence case.

## Visual Evidence

Final retained evidence lives under:

```text
test-results/ccpp010a1
```

Required 010A1 artifacts:

- `browser-screenshots/010a1-match-result-before-selection.png`
- `browser-screenshots/010a1-match-result-contact-frame.png`
- `browser-screenshots/010a1-match-result-settled-selected-only.png`
- `browser-videos/010a1-match-result-shove-normal-speed.webm`

Visual inspection notes:

- Before-selection screenshot shows Animations On and the three real Match
  Result radio-card controls.
- The normal-speed WebM shows the Rooster entering from offscreen, running into
  the rejected group, contacting/pushing the rejected cards to the right, the
  rejected group exiting, the Rooster exiting, and the selected-only settled
  state remaining.
- The contact still was extracted from the normal-speed WebM because Playwright
  page screenshot capture advanced the finite CSS animation before the intended
  contact frame. The WebM is the authoritative normal-speed evidence.
- Rooster run/push frames are visible in the WebM contact sheet.
- The selected answer remains selected and is not shoved away or materially
  covered.
- Rejected cards move with the Rooster and are absent from the final settled
  form controls.
- No duplicate visible form controls appear in the settled state.

## Verification

Focused checks run during implementation:

- `meteor npm exec vitest run --config vitest.config.mts tests/unit/prediction-presentation-host.test.ts`
  - Passed: 1 file, 16 tests.
- `PATH="$PWD/node_modules/.bin:$PATH" RUGBY_ROOSTER_E2E_EVIDENCE_DIR=test-results/ccpp010a1 npm run test:e2e -- tests/e2e/react-prediction-presentation.spec.ts`
  - Initial sandboxed launches failed before browser execution with
    `spawn playwright EPERM`.
  - Escalated run reached the app and failed one strict selector in the new
    evidence test.
  - Final escalated focused browser batch passed: 4 tests.

Static closeout checks:

- `meteor npm run typecheck`
  - Passed before lint cleanup and again after the lint-driven source
    adjustment.
- `meteor npm run lint`
  - Initially failed because `reactPredictionPresentation.tsx` synchronously
    cleared state from an effect.
  - Corrected by deriving the invalid-value choosing state and letting
    decoration cleanup remain asynchronous.
  - Final result: passed.
- `meteor npm run lint:project`
  - Passed.
- `./node_modules/.bin/prettier --write ...changed files...`
  - Applied formatting to this audit file; other changed files were unchanged.
- `./node_modules/.bin/prettier --check ...changed files...`
  - Passed after final documentation/source edits.
- `git diff --check`
  - Passed after final documentation/source edits.

The final focused browser evidence predates the lint-driven internal
derived-state cleanup. The cleanup did not change the selected-only UI contract
and the focused component suite was rerun successfully afterward.

## Architecture Notes

- The active prediction route still flows through `usePredictionSession(...)`
  and one React/HTML presentation.
- React controls remain authoritative for answers.
- Animations On/Off and reduced motion keep the same essential controls.
- Kaplay remains installed but unused by the active prediction flow.
- Historical 009/010A documents are not rewritten as if the earlier Standard
  renderer terminology never existed.

## Review Package

The EOMD package is created at the repository root after final static closeout:

```text
rugby-rooster-ccpp010a1-match-result-polish-eomd-20260919.zip
```

It includes copied source, focused tests, docs, before/contact/settled evidence,
the normal-speed WebM, and this verification record. Repository originals are
not moved or removed.

Package inspection:

- `unzip -t rugby-rooster-ccpp010a1-match-result-polish-eomd-20260919.zip`
  reported no compressed-data errors.
- `zipinfo -1 rugby-rooster-ccpp010a1-match-result-polish-eomd-20260919.zip`
  listed only the curated source, docs, focused tests, CSS context, and 010A1
  evidence paths.
