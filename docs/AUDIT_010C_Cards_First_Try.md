# CCPP-010C Cards and First Try Audit

## Scope

CCPP-010C continues the accepted React-first prediction experience after
CCPP-010B1. It moves the active Cards and First Try steps into dedicated React
presentation components while keeping `usePredictionSession(...)`, shared form
helpers, and existing sequence/domain rules authoritative.

This milestone does not add server methods, scoring-rule changes, prediction
persistence changes, Match Result timing changes, numeric score-family changes,
Kaplay prediction runtime work, Highest-Scoring Half, Half-Time Leader, custom
question redesign, Review redesign, or quiz/gameplay features.

## Implementation

- `imports/ui/pages/PredictionEntryPage.tsx`
  - Wires Cards to `CardsPredictionStep`.
  - Wires First Try to `FirstTryPredictionStep`.
  - Keeps Cards values on
    `changeTeamNumericField(side, 'yellowCards' | 'redCards', value)`.
  - Keeps First Try values on `selectBuiltInChoice('firstTry', value)`.
  - Keeps `firstTryConstraintForForm(...)` as the source of allowed/disabled
    First Try choices and `onEditStep('tries')` for the existing consistency
    recovery path.
  - Embeds Cards deduction/supporting copy inside the Cards presentation so the
    step does not duplicate page-level copy.
- `imports/ui/predictions/reactPredictionPresentation.tsx`
  - Adds Cards team panels with separate Yellow Cards and Red Cards numeric
    fields per team.
  - Reuses the accepted numeric stepper mechanics: direct typing, blank draft
    handling, decrement/increment buttons, zero floor, hidden native number
    spinners, and no arbitrary maximum.
  - Shows the existing derived predicted rugby score on each Cards team panel,
    but card changes do not alter that score.
  - Adds decorative Yellow and Red card markers, capped visual stacks, and
    distinct yellow/red reaction messages and motion.
  - Uses one active Cards reaction key so the latest Yellow/Red field change
    wins and stale field copy clears during rapid changes.
  - Adds a reusable categorical radio-card presentation and applies it to First
    Try.
  - Renders real radio controls for Team 1, Team 2, and `No Tries Today!`.
  - Treats `No Tries Today!` as a full-size legitimate option while leaving its
    availability governed by the existing try-total consistency helper.
  - Keeps rapid reselection cosmetic state aligned to the latest checked radio.
  - Suppresses decorative card/categorical reactions when Animations are Off or
    reduced motion is active, without changing controls or domain behavior.
- `client/main.css`
  - Adds card marker, card reaction, categorical choice, and categorical
    reaction styling.
  - Adds the new decorative selectors to the existing reduced-motion transition
    suppression.
- `tests/unit/prediction-presentation-host.test.ts`
  - Adds focused Cards coverage for independent Yellow/Red values, zero floor,
    blank typing, no predicted rugby score change, capped marker stacks,
    distinct Yellow/Red reactions, stale reaction clearing, Animations Off,
    reduced motion, rapid changes, and cleanup.
  - Adds focused First Try coverage for Team 1, Team 2, `No Tries Today!`, saved
    values, existing consistency behavior, rapid reselection, Animations On,
    Animations Off, reduced motion, and cleanup.
- `tests/e2e/react-prediction-presentation.spec.ts`
  - Adds the focused CCPP-010C browser journey that produced the retained final
    evidence. This closeout did not rerun it.

## Architecture Notes

- The shared prediction session remains the single owner of prediction values,
  navigation, validation, review/edit flow, saved baselines, and submission.
- Cards remain separate Yellow Cards and Red Cards fields for each side. They
  affect prediction accuracy/scoring after settlement, not the predicted rugby
  score displayed during entry.
- The Cards UI observes accepted shared form values after the session/form
  helper accepts them; it does not create a second answer model.
- First Try remains governed by `firstTryConstraintForForm(...)` and
  `enforceFirstTryConsistency(...)`. The React presentation only renders the
  allowed/disabled state and dispatches deliberate radio changes.
- Animations On reactions are decorative. Animations Off and reduced motion use
  the same real inputs, labels, disabled states, values, validation, and
  navigation.
- Later categorical questions remain pending. Highest-Scoring Half,
  Half-Time Leader, custom questions, and Review still use the existing React
  sequence.

## Source Scope Verification

The current CCPP-010C source diff was inspected during closeout:

- Match Result accepted behavior was not reopened. The 1400ms cadence,
  underpass variables/keyframes, and selected hero state remain in the existing
  Match Result CSS/source paths.
- The CCPP-010B1 numeric reaction model was not functionally changed. Existing
  score pulses, conversion cap behavior, result consistency, and numeric
  stepper semantics remain in place.
- CCPP-010C additions are confined to Cards/First Try presentation wiring,
  appended Cards/categorical presentation code, corresponding CSS, and focused
  tests/docs.

## Evidence

Final retained browser evidence lives under:

```text
test-results/ccpp010c
```

Final screenshots:

- `browser-screenshots/010c-cards-desktop.png` - 1280 x 1541.
- `browser-screenshots/010c-cards-390.png` - 390 x 2443.
- `browser-screenshots/010c-cards-360.png` - 360 x 2503.
- `browser-screenshots/010c-yellow-card-reaction.png` - 1280 x 1541.
- `browser-screenshots/010c-red-card-reaction.png` - 1280 x 1541.
- `browser-screenshots/010c-first-try-initial-three-choices.png` - 1280 x 1073.
- `browser-screenshots/010c-first-try-team-selected.png` - 1280 x 1073.
- `browser-screenshots/010c-first-try-team2-selected.png` - 1280 x 1073.
- `browser-screenshots/010c-first-try-no-tries-selected.png` - 1280 x 1151.
- `browser-screenshots/010c-first-try-390.png` - 390 x 1679.
- `browser-screenshots/010c-first-try-360.png` - 360 x 1707.

The final `010c-first-try-team-selected.png` was inspected during closeout. It
shows Team 1 visibly selected, the other choices visually secondary, and the
reaction copy visible after the checked radio/data-selected state matched the
shared answer and the short visual settle completed. The Red reaction
screenshot shows the Red reaction active without stale Yellow reaction copy.

Normal-speed video:

- `browser-videos/010c-cards-first-try-normal-speed.webm`

Extracted review aid:

- `browser-frames/010c-cards-first-try-contact-sheet.png` - 1280 x 540.

Measurement record:

- `browser-measurements/010c-cards-first-try-measurements.json`
  - Cards 390px: `clientWidth 390`, `scrollWidth 390`.
  - Cards 360px: `clientWidth 360`, `scrollWidth 360`.
  - First Try 390px: `clientWidth 390`, `scrollWidth 390`.
  - First Try 360px: `clientWidth 360`, `scrollWidth 360`.
  - Final browser values: Cards Team 1 Yellow `1`, Red `1`; Cards Team 2
    Yellow `3`, Red `2`; Tries `0 / 0`; First Try `no-tries`.

Browser result:

- `test-results/ccpp010c/exit.json` records exit code `0` at
  `2026-09-20T11:51:54.904Z`.
- The retained final focused run passed the CCPP-010C Chromium browser journey.
- No browser command was run during this documentation/static closeout.

## Browser Run History

The browser history is intentionally not summarized as a single clean run:

- The initial sandboxed launch exited before tests because of local networking
  restrictions.
- The escalated run exposed a First Try test-flow issue caused by the existing
  consistency helper auto-selecting `No Tries Today!`.
- The test setup order was corrected so the intended First Try choices were
  available before Team selection evidence.
- Subsequent real browser runs passed.
- Evidence review then found and corrected stale Yellow reaction copy during
  Red interaction, Red marker/label spacing, First Try selected-state
  screenshot timing, and short evidence holds so reactions were visible at
  normal speed.
- The final retained browser journey passed, and the normal-speed WebM/contact
  sheet were regenerated from that final state.

Intermediate stale screenshots are not treated as final acceptance evidence.

## Verification

Prior to the closeout interruption, the work reported:

- Focused React presentation tests passed with 45 tests.
- Typecheck passed before browser execution.
- The final retained browser journey passed and produced the evidence listed
  above.

Closeout note:

- `meteor npm run lint` initially failed on two new decorative reaction cleanup
  effects that synchronously called `setReaction(null)`.
- The direct lint fix deferred those cleanup state clears; the first version
  made one focused Cards stale-reaction assertion fail because the old reaction
  remained visible for one tick.
- The final correction keeps the lint-safe deferred internal cleanup while
  deriving rendered Cards/First Try reaction visibility from the current active
  reaction key/value. Focused unit coverage and lint then passed.
- Retained browser evidence predates this closeout-only cleanup correction. The
  correction does not change prediction data flow, controls, scoring, or the
  intended Cards/First Try presentation contract, but it has not been
  re-verified in a browser because no browser rerun was authorized.

Closeout checks run against the current final source:

- `meteor npm exec vitest run --config vitest.config.mts tests/unit/prediction-presentation-host.test.ts`
  - Passed: 1 file, 46 tests.
- `meteor npm run typecheck`
  - Passed.
- `meteor npm run lint`
  - Passed after the cleanup correction above.
- `meteor npm run lint:project`
  - Passed.
- `./node_modules/.bin/prettier --check client/main.css docs/AUDIT_010C_Cards_First_Try.md docs/TEMP_010C_Resume.md docs/CORE_Build_Plan.md docs/CORE_Predictions.md docs/MAP_System.md docs/PLATFORM_Prediction_Sequence.md docs/PLATFORM_React_Prediction_Experience.md docs/PLATFORM_Testing.md imports/ui/pages/PredictionEntryPage.tsx imports/ui/predictions/reactPredictionPresentation.tsx tests/e2e/react-prediction-presentation.spec.ts tests/unit/prediction-presentation-host.test.ts`
  - Initially found mechanical formatting issues in five files.
  - Passed after formatting only those files.
- `git diff --check`
  - Passed.

Prediction session/sequence tests were not scheduled for this closeout because
the current CCPP-010C source diff did not change the session or sequence source
files.

## Review Package

The EOMD package is created at the repository root:

```text
rugby-rooster-ccpp010c-cards-first-try-eomd-20260920.zip
```

It includes curated source, wiring, CSS, focused unit/browser specs, contextual
session/domain source, updated docs, final screenshots, final measurement JSON,
the final normal-speed WebM, the final contact sheet, and `exit.json`.

It excludes secrets, private settings, `node_modules`, `.meteor/local`, build
caches, raw JSONL process traces, Playwright stdout/stderr, and stale duplicate
browser evidence.

Package inspection:

- `unzip -t rugby-rooster-ccpp010c-cards-first-try-eomd-20260920.zip`
  reported no compressed-data errors.
- `zipinfo -1 rugby-rooster-ccpp010c-cards-first-try-eomd-20260920.zip`
  listed only the curated docs/source/tests/evidence paths.
- Extracted representative PNGs opened with expected dimensions:
  `010c-first-try-team-selected.png` at 1280 x 1073 and
  `010c-cards-390.png` at 390 x 2443.
- Extracted WebM metadata from `ffprobe`: duration `10.240000`, size `822816`.
- `ffmpeg` decoded the first WebM frame to `null` without errors.
- Extracted docs/source/tests presence checks passed for the audit,
  `reactPredictionPresentation.tsx`, and the focused unit test file.
- Archive size at inspection: `2.1M`.
