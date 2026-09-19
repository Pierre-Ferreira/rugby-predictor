# CCPP-010A3 Match Result Lift Clean Shove Audit

## Scope

CCPP-010A3 is a presentation-only correction after accepted CCPP-010A2.

It preserves the current React-first prediction contract:

```text
usePredictionSession
    -> real React/HTML Match Result controls
    -> presentation-only browser/CSS animation
```

No prediction/session/domain logic, server behavior, scoring logic, Tries
behavior, Kaplay, canvas, duplicate answer state, or later prediction steps were
changed.

## Implementation

- `imports/ui/predictions/reactPredictionPresentation.tsx`
  - Keeps the selected Match Result radio as the real checked control during
    reveal.
  - Marks rejected real radio cards with
    `rr-match-result-choice-card--rejected-hidden` only during the reveal phase.
  - Sets rejected real cards `aria-hidden` and disables their radio inputs
    during reveal so they are not visible, focusable, or interactive while the
    decorative copies represent them.
  - Keeps decorative rejected copies inside the existing `aria-hidden`,
    pointer-inert shove overlay and adds stable test ids for focused evidence.
  - `Change my selection`, resize/orientation cancellation, sprite load
    cancellation, Animations Off, reduced motion, Back, and Continue still
    remove stale decorative state and preserve the selected answer.
- `client/main.css`
  - Replaces the rejected-real-control fade with layout-preserving
    `visibility: hidden`, `pointer-events: none`, and `user-select: none`.
  - Increases the selected-card lift to a physical transform:
    `translateY(-1.5rem) scale(1.06)` on desktop, approximately 24 CSS px plus
    scale geometry.
  - Uses compact lift `translateY(-1.125rem) scale(1.045)`, approximately 18 CSS
    px plus scale geometry.
  - Keeps the overall animation at 1200ms while holding the Rooster/shove start
    until 25% of the sequence so the lift reads first.
- `tests/unit/prediction-presentation-host.test.ts`
  - Covers rejected real controls hidden/disabled during reveal.
  - Covers decorative rejected copies present and noninteractive.
  - Covers only the selected real radio remaining enabled during reveal.
  - Covers actual lift transform values in CSS.
  - Covers Change/resize interruption clearing stale hidden state.
- `tests/e2e/react-prediction-presentation.spec.ts`
  - Captures focused desktop evidence for before, lift, contact, exit, settled,
    and normal-speed WebM.
  - Captures 390px and 360px lift/settled screenshots.
  - Writes bounding-box and reveal-state evidence to JSON.

## Visual Evidence

Final retained evidence lives under:

```text
test-results/ccpp010a3
```

Evidence artifacts:

- `browser-screenshots/010a3-match-result-before-selection.png`
- `browser-screenshots/010a3-match-result-selected-lift.png`
- `browser-screenshots/010a3-match-result-contact-clean-shove.png`
- `browser-screenshots/010a3-match-result-shove-exit.png`
- `browser-screenshots/010a3-match-result-settled-hero-desktop.png`
- `browser-screenshots/010a3-match-result-selected-lift-390.png`
- `browser-screenshots/010a3-match-result-settled-hero-390.png`
- `browser-screenshots/010a3-match-result-selected-lift-360.png`
- `browser-screenshots/010a3-match-result-settled-hero-360.png`
- `browser-videos/010a3-match-result-lift-clean-shove-normal-speed.webm`
- `browser-measurements/010a3-match-result-lift-clean-shove-measurements.json`

Objective lift evidence:

- Desktop selected top before: `412`
- Desktop selected top during lift: `384.6400146484375`
- Desktop upward displacement: `27.3599853515625` CSS px
- 390px upward displacement: `20.160003662109375` CSS px
- 360px upward displacement: `20.1600341796875` CSS px

Rejected-control evidence from the same JSON:

- During desktop lift/contact, active real Match Result radio count is `1`.
- Decorative shove-card count is `2`.
- Decorative overlay button/input count is `0`.
- Rejected real controls report `ariaHidden: "true"`, `disabled: true`, and
  `visibility: "hidden"`.
- The selected real control reports `checked: true`, `disabled: false`, and
  `visibility: "visible"`.

Manual inspection:

- Before screenshot shows all three real choices.
- Lift screenshot shows the selected card physically raised before Rooster
  contact.
- Contact and exit screenshots show the Rooster pushing decorative rejected
  cards with no readable ghost labels underneath.
- Settled screenshots show `YOU SELECTED:`, one enlarged selected card, and
  `Change my selection`.
- 390px and 360px screenshots show visible lift, no horizontal overflow, no top
  clipping, and a fitting hero state.
- The retained WebM is 7.2 seconds at 25fps. Extracted frames were inspected
  locally to verify the normal-speed lift, contact/push, mobile lift, and settle
  sequence.

## Verification

Focused checks run:

- `meteor npm exec vitest run --config vitest.config.mts tests/unit/prediction-presentation-host.test.ts`
  - First run failed one CSS-file path assertion in the test harness.
  - Final run passed: 1 file, 18 tests.
- `meteor npm run typecheck`
  - Passed.
- `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=test-results/ccpp010a3 npm run test:e2e -- tests/e2e/react-prediction-presentation.spec.ts -g "captures the CCPP-010A3 Match Result lift and clean shove" --workers=1 --retries=0`
  - Sandboxed run exited before executing tests and recorded no failed tests.
  - Approved local-browser run passed: 1 Chromium test.
  - One approved replacement run was used after the mobile lift screenshots were
    changed from full-page to viewport captures so the retained mobile evidence
    showed the lift phase rather than the later settled state. Final run passed:
    1 Chromium test.

Static closeout:

- `meteor npm run lint`
  - Passed.
- `meteor npm run lint:project`
  - Passed.
- `./node_modules/.bin/prettier --write ...changed files...`
  - Applied formatting to the changed test files; other touched files were
    unchanged.
- `./node_modules/.bin/prettier --check ...changed files...`
  - Passed.
- `git diff --check`
  - Passed.

## Architecture Notes

- The active prediction route still flows through `usePredictionSession(...)`
  and the React/HTML presentation.
- React radio controls remain authoritative for selected answers.
- The shove layer remains decorative, `aria-hidden`, and noninteractive.
- Rejected real controls stay mounted only for reveal-layout continuity and are
  visually hidden plus disabled during that phase.
- Kaplay and canvas remain unused by the active prediction flow.

## Review Package

The EOMD archive is created at the repository root:

```text
rugby-rooster-ccpp010a3-match-result-lift-clean-shove-eomd-20260919.zip
```

It includes copied changed source/CSS/tests/docs, retained browser evidence,
normal-speed WebM, and measurement JSON. Repository originals are not moved or
removed.
