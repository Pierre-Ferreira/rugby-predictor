# CCPP-010B1 Resume Checkpoint

## Current Goal

CCPP-010B1 continues after CCPP-010B and adds visible, presentation-only
animation/personality to the accepted React-first score-building numeric steps:

- Tries.
- Conversions.
- Successful Penalty Kicks.
- Drop Goals.
- Cumulative predicted rugby score feedback.

It also restores the Match Result reveal cadence from the accidental 1800ms
regression back to the previously accepted 1400ms timing. Match Result geometry,
clearance, selected upper tier, hidden rejected real controls, hero state, and
keyframe percentages remain out of scope except where timing references must
match 1400ms.

## Inspected Paths

- `AGENTS.md`
- `docs/PLATFORM_React_Prediction_Experience.md`
- `docs/AUDIT_010B_Numeric_Scoring_Steps.md`
- `docs/CORE_Predictions.md`
- `docs/PLATFORM_Prediction_Sequence.md`
- `docs/PLATFORM_Prediction_Session.md`
- `docs/PLATFORM_Testing.md`
- `docs/MAP_System.md`
- `docs/AUDIT_010A3_Match_Result_Lift_Clean_Shove.md`
- `docs/TEMP_010A3_Resume.md`
- `imports/ui/predictions/reactPredictionPresentation.tsx`
- `imports/ui/predictions/PredictionPresentationHost.tsx`
- `imports/ui/predictions/reducedMotion.ts`
- `imports/ui/predictions/standardPredictionState.ts`
- `imports/shared/predictions/messages.ts`
- `imports/ui/pages/PredictionEntryPage.tsx`
- `client/main.css`
- `tests/unit/prediction-presentation-host.test.ts`
- `tests/e2e/react-prediction-presentation.spec.ts`

## Current Animation Behavior

- Initial inspection found Match Result using
  `matchResultMotionDurationMs = 1_800` and CSS animation durations of
  `1800ms` for selected rise, decorative layer lifetime, rejected pack shove,
  Rooster travel, and each sprite-frame animation.
- CCPP-010B1 restored the coordinated Match Result timing references to
  `1400ms`.
- Initial inspection found numeric score-building cards running one small Web
  Animations pulse on the stepper wrapper only. The pulse scaled from `1` to
  `1.045` and back over `180ms`.
- CCPP-010B1 replaced that subtle pulse with card, value, score, helper, and
  contextual-copy reaction state driven by accepted form value/score changes.
- Animations Off and reduced motion suppress decorative numeric movement and
  reaction state while preserving form behavior.

## Intended Per-Step Reaction Language

- Shared model: react after the accepted form value changes, keep
  `changeTeamNumericField(...)` as the only update path, coalesce/restart the
  cosmetic reaction on rapid changes, and clear timers/animation handles on
  unmount/navigation.
- Tries: strongest numeric pop/jump, clear team-card impact, score bump, and
  restrained-to-cheeky contextual copy for higher try counts without implying a
  better prediction.
- Conversions: related but distinct confirmation pulse, score bump, and a
  visible nonblocking limit reaction when a player tries to exceed predicted
  tries.
- Penalty Kicks: compact kick/impact signature, value reaction, team-card
  pulse, and score bump.
- Drop Goals: slightly more dramatic bounce/pulse and punchier short copy while
  keeping the existing result/score consistency warning authoritative.
- Score feedback: each team's predicted-score-so-far display reacts
  independently only when that team's derived score actually changes.

## Match Result Timing Correction

- Restore React settle timer to `1400ms`.
- Restore coordinated CSS durations to `1400ms` for selected rise, decorative
  layer lifetime, rejected pack, Rooster travel, and sprite-frame timing.
- Update focused timing assertions and documentation to describe 1800ms as an
  accidental CCPP-010B regression corrected in CCPP-010B1.

## Browser Budget

- Before browser evidence: focused numeric/unit tests and typecheck.
- Browser evidence budget: one focused Animations-On journey through Match
  Result, Tries, Conversions, Penalty Kicks, and Drop Goals.
- Allow one correction rerun only for a directly evidenced defect.
- Required evidence includes a normal-speed WebM, representative reaction
  screenshots, conversion-limit reaction, cumulative score-building state, and
  390px/360px numeric layout captures.

## Completed Checks

- `meteor npm exec vitest run --config vitest.config.mts tests/unit/prediction-presentation-host.test.ts`
  - Passed: 1 file, 33 tests.
- `meteor npm exec vitest run --config vitest.config.mts tests/unit/prediction-presentation-host.test.ts tests/unit/prediction-session.test.ts tests/unit/prediction-sequence.test.ts`
  - Passed: 3 files, 68 tests.
- `meteor npm run typecheck`
  - Passed.
- `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=test-results/ccpp010b1 npm run test:e2e -- tests/e2e/react-prediction-presentation.spec.ts -g "CCPP-010B1 Animations On numeric reactions" --workers=1 --retries=0`
  - Initial sandboxed attempt exited before test execution.
  - First approved run exposed a cap-button actionability issue and timed out.
  - Corrected approved rerun passed: 1 Chromium test.
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
- `unzip -t rugby-rooster-ccpp010b1-numeric-animation-personality-eomd-20260920.zip`
  - Passed; no compressed-data errors.
- `zipinfo -1 rugby-rooster-ccpp010b1-numeric-animation-personality-eomd-20260920.zip`
  - Inspected; archive contains only curated source, docs, focused tests, and
    010B1 evidence paths.

## Next Action

Ready for final handoff. EOMD package:
`rugby-rooster-ccpp010b1-numeric-animation-personality-eomd-20260920.zip`.
