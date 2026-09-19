# CCPP-010A3 Resume Checkpoint

## Current Goal

CCPP-010A3 fixes two Match Result presentation defects only:

- rejected real controls must not ghost underneath decorative shove copies;
- the selected real control must visibly lift before the Rooster arrives.

Do not begin Tries, Conversions, Penalties, Drop Goals, Cards, custom
questions, Review, quiz, Kaplay, canvas, server, scoring, prediction-session, or
architecture work from this checkpoint.

## Implementation Status

- [x] Selected answer still updates immediately through the shared session.
- [x] During reveal, rejected real controls remain layout-preserving but are
      `visibility:hidden`, disabled, `aria-hidden`, and noninteractive.
- [x] Decorative rejected copies remain `aria-hidden`, pointer-inert, and
      noninteractive.
- [x] Selected real control remains visible, checked, enabled, and unshoved.
- [x] Selected lift uses a real transform:
      `translateY(-1.5rem) scale(1.06)` desktop and
      `translateY(-1.125rem) scale(1.045)` compact.
- [x] Rooster/shove motion still uses the accepted 1200ms cadence, with the
      shove start delayed to 25% so lift reads first.
- [x] Settled state remains `YOU SELECTED:`, one large selected card, and
      `Change my selection`.
- [x] Change and interruption paths remove stale decorative/hidden state and
      preserve the selected answer.

## Evidence

Final evidence folder:

```text
test-results/ccpp010a3
```

Key artifacts:

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

Measured lift:

- Desktop: top `412` -> `384.6400146484375`, displacement
  `27.3599853515625` CSS px.
- 390px: displacement `20.160003662109375` CSS px.
- 360px: displacement `20.1600341796875` CSS px.

Clean shove evidence:

- Active real radio count during lift/contact: `1`.
- Decorative rejected card count: `2`.
- Decorative overlay interactive controls: `0`.
- Rejected real controls during lift/contact: `aria-hidden`, disabled, and
  `visibility:hidden`.

## Checks Run

- `meteor npm exec vitest run --config vitest.config.mts tests/unit/prediction-presentation-host.test.ts`
  - First run failed one CSS-file path assertion in the test harness.
  - Final run passed: 18 tests.
- `meteor npm run typecheck`
  - Passed.
- Focused browser evidence command:
  `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=test-results/ccpp010a3 npm run test:e2e -- tests/e2e/react-prediction-presentation.spec.ts -g "captures the CCPP-010A3 Match Result lift and clean shove" --workers=1 --retries=0`
  - Sandboxed attempt exited before tests with no failed test recorded.
  - Approved final evidence run passed: 1 Chromium test.
  - One approved replacement run was used only to replace mobile lift captures
    after full-page screenshots landed on the later settled state.

Static closeout:

- `meteor npm run lint`
  - Passed.
- `meteor npm run lint:project`
  - Passed.
- changed-file Prettier write/check
  - Passed via `./node_modules/.bin/prettier`.
- `git diff --check`
  - Passed.

## Package

Expected package name:

```text
rugby-rooster-ccpp010a3-match-result-lift-clean-shove-eomd-20260919.zip
```

Archive copies only. Include changed Match Result source/CSS/tests/docs,
screenshots, WebM, and measurement JSON. Exclude dependencies, caches, secrets,
and unrelated history.
