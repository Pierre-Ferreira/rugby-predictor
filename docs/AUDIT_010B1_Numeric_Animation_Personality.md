# CCPP-010B1 Numeric Animation Personality Audit

## Scope

CCPP-010B1 continues after CCPP-010B. It keeps the accepted React-first
prediction architecture and adds visible, presentation-only feedback for:

- Tries.
- Conversions.
- Successful Penalty Kicks.
- Drop Goals.
- Cumulative predicted rugby score feedback.

It also restores Match Result animation cadence from the accidental 1800ms
regression back to the accepted 1400ms timing. No server methods, scoring rules,
prediction persistence, reducers, canvas, Kaplay gameplay, Cards, First Try,
Highest-Scoring Half, Half-Time Leader, custom questions, or Review redesigns
were added.

## Implementation

- `imports/ui/predictions/reactPredictionPresentation.tsx`
  - Restores `matchResultMotionDurationMs` to `1_400`.
  - Adds a shared numeric reaction layer through
    `useNumericChangeReaction(...)`, `NumericValuePulse`,
    `PredictedScorePulse`, and `NumericChangeReaction`.
  - Starts reactions only after accepted form values and existing derived scores
    have updated.
  - Cancels previous card/value/score/helper Web Animations and replaces the
    reaction state on rapid changes.
  - Keeps all answer changes on the existing
    `changeTeamNumericField(side, field, value)` path.
  - Adds visible per-step personality copy:
    - Tries: stronger pop and higher-total copy such as `Going big!` and
      `Try-fest?`.
    - Conversions: confirmation copy plus `At the try cap.` for cap attempts.
    - Penalty Kicks: compact kick/impact copy.
    - Drop Goals: punchier copy such as `A drop goal?` and `Old school!`.
  - Leaves Drop Goals result/score consistency ownership in the session.
- `client/main.css`
  - Restores coordinated Match Result selected-rise, layer lifetime, rejected
    pack, Rooster travel, and sprite-frame durations to `1400ms`.
  - Adds numeric card/score/helper/reaction visual state styles.
  - Hides native number spinner controls for Rugby Rooster numeric steppers
    while preserving the number input.
- `tests/unit/prediction-presentation-host.test.ts`
  - Updates Match Result timing assertions to the restored 1400ms contract.
  - Adds focused numeric reaction tests for Tries increment/decrement,
    Conversions accepted/cap/Animations Off behavior, Penalty Kicks, Drop
    Goals, direct typing, rapid replacement, cleanup, reduced motion, and
    spinner CSS.
- `tests/e2e/react-prediction-presentation.spec.ts`
  - Adds one Animations-On browser journey through Match Result, Tries,
    Conversions, Penalty Kicks, and Drop Goals.
  - Captures normal-speed video, reaction screenshots, mobile screenshots, and
    overflow/final-value measurements.

## Architecture Notes

- Prediction state remains owned by `usePredictionSession(...)`.
- Numeric reactions observe rendered values derived from the existing
  `PredictionFormState`; they never own or calculate independent prediction
  answers.
- Conversion limits remain owned by `setTeamPredictionField(...)` and existing
  form helpers. A cap attempt starts only a nonblocking visual response.
- Predicted-score-so-far values still come from `deriveTeamScoreFromForm(...)`.
- Animations Off and reduced motion suppress decorative movement/reaction state
  while keeping values, inputs, validation, helper copy, conversion caps, score
  calculation, and navigation unchanged.
- Direct typing triggers the same reaction family once a valid accepted value is
  present in shared form state.

## Evidence

Retained browser evidence lives under:

```text
test-results/ccpp010b1
```

Normal-speed video:

- `browser-videos/010b1-numeric-animation-personality-normal-speed.webm`
  - Duration from `ffmpeg`: `17.92s`.

Screenshots:

- `browser-screenshots/010b1-tries-animation-on-change.png`
- `browser-screenshots/010b1-cumulative-score-building.png`
- `browser-screenshots/010b1-conversions-limit-reaction.png`
- `browser-screenshots/010b1-penalty-kicks-reaction.png`
- `browser-screenshots/010b1-drop-goals-reaction.png`
- `browser-screenshots/010b1-numeric-390.png`
- `browser-screenshots/010b1-numeric-360.png`

Extracted review aid:

- `browser-frames/010b1-numeric-animation-contact-sheet.png`

Measurement record:

- `browser-measurements/010b1-numeric-animation-personality-measurements.json`
  - 390px layout: `clientWidth 390`, `scrollWidth 390`.
  - 360px layout: `clientWidth 360`, `scrollWidth 360`.
  - Final browser values: Tries `3 / 4`, Conversions `3 / 1`, Penalty Kicks
    `1 / 3`, Drop Goals `3 / 0`.

Browser-run note:

- The first sandboxed Playwright attempt exited before running tests
  (`failedTests: []`). The approved local-browser/server rerun passed after the
  evidenced cap-button actionability correction.

## Verification

Checks run:

- `meteor npm exec vitest run --config vitest.config.mts tests/unit/prediction-presentation-host.test.ts`
  - Passed: 1 file, 33 tests.
- `meteor npm exec vitest run --config vitest.config.mts tests/unit/prediction-presentation-host.test.ts tests/unit/prediction-session.test.ts tests/unit/prediction-sequence.test.ts`
  - Passed: 3 files, 68 tests.
- `meteor npm run typecheck`
  - Passed.
- `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=test-results/ccpp010b1 npm run test:e2e -- tests/e2e/react-prediction-presentation.spec.ts -g "CCPP-010B1 Animations On numeric reactions" --workers=1 --retries=0`
  - Initial sandboxed attempt exited early with code `1` before test execution.
  - First approved run exposed the cap-button actionability issue and timed out.
  - Corrected approved rerun passed: 1 Chromium test.
  - Final `test-results/ccpp010b1/exit.json` records exit code `0` at
    `2026-09-20T10:42:48.416Z`.
- `ffmpeg -y -i test-results/ccpp010b1/browser-videos/010b1-numeric-animation-personality-normal-speed.webm -vf fps=0.33,scale=320:-1,tile=3x2 -frames:v 1 test-results/ccpp010b1/browser-frames/010b1-numeric-animation-contact-sheet.png`
  - Passed; contact sheet created.
- `meteor npm run lint`
  - Passed.
- `meteor npm run lint:project`
  - Passed.
- `./node_modules/.bin/prettier --check client/main.css docs/AUDIT_010B1_Numeric_Animation_Personality.md docs/CORE_Build_Plan.md docs/MAP_System.md docs/PLATFORM_Prediction_Sequence.md docs/PLATFORM_React_Prediction_Experience.md docs/PLATFORM_Testing.md docs/TEMP_010B1_Resume.md imports/ui/predictions/reactPredictionPresentation.tsx tests/e2e/react-prediction-presentation.spec.ts tests/unit/prediction-presentation-host.test.ts`
  - Passed.
- `git diff --check`
  - Passed.

## Review Package

The EOMD package is created at the repository root:

```text
rugby-rooster-ccpp010b1-numeric-animation-personality-eomd-20260920.zip
```

It includes copied numeric presentation source, reaction CSS, Match Result
timing restoration source, focused tests, docs, passing browser evidence,
normal-speed WebM, screenshots, contact sheet, and verification records.

Package inspection:

- `unzip -t rugby-rooster-ccpp010b1-numeric-animation-personality-eomd-20260920.zip`
  reported no compressed-data errors.
- `zipinfo -1 rugby-rooster-ccpp010b1-numeric-animation-personality-eomd-20260920.zip`
  listed only curated source, docs, focused tests, and 010B1 evidence paths.
- Archive size at inspection: `2.1M`.
