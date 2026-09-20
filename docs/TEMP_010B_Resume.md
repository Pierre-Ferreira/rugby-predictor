# CCPP-010B Resume Checkpoint

## Scope

CCPP-010B continues after accepted CCPP-010A3. Match Result is closed for this
phase. This milestone migrates only the React-first numeric scoring steps for:

- Conversions.
- Successful penalty kicks.
- Drop goals.

No Cards, First Try, Highest-Scoring Half, Half-Time Leader, custom-question,
Review, quiz, Kaplay, server, scoring, or persistence work is in scope.

## Inspected Sources

- `AGENTS.md`
- `docs/PLATFORM_React_Prediction_Experience.md`
- `docs/CORE_Predictions.md`
- `docs/PLATFORM_Prediction_Sequence.md`
- `docs/PLATFORM_Prediction_Session.md`
- `docs/PLATFORM_Testing.md`
- `docs/MAP_System.md`
- `docs/CORE_Build_Plan.md`
- `docs/AUDIT_010A_Shared_React_Presentation.md`
- `docs/AUDIT_010A1_Match_Result_Polish.md`
- `docs/AUDIT_010A2_Match_Result_Motion_Refinement.md`
- `docs/AUDIT_010A3_Match_Result_Lift_Clean_Shove.md`
- `imports/ui/predictions/reactPredictionPresentation.tsx`
- `imports/ui/pages/PredictionEntryPage.tsx`
- `imports/ui/predictions/predictionSession.ts`
- `imports/ui/predictions/standardPredictionState.ts`
- `imports/shared/predictions/messages.ts`
- `imports/shared/predictions/sequence.ts`
- `imports/shared/scoring/derived.ts`
- `imports/shared/scoring/rulesets.ts`
- `imports/shared/scoring/types.ts`
- `tests/unit/prediction-presentation-host.test.ts`
- `tests/unit/prediction-session.test.ts`
- `tests/unit/prediction-sequence.test.ts`
- `tests/e2e/react-prediction-presentation.spec.ts`
- `tests/e2e/predictions.spec.ts`

## Current Findings

- `reactPredictionPresentation.tsx` owns the accepted React-first Match Result
  and Tries presentation. `TriesPredictionStep` uses one card per team, real
  HTML number inputs/buttons, `changeTeamNumericField(side, 'tries', value)`,
  shared score derivation helpers, and a small optional pulse that cancels
  previous animation handles.
- `PredictionEntryPage.tsx` still renders Conversions, Successful Penalty
  Kicks, and Drop Goals through the older `ScoreComponentStep` and
  `NumericPredictionControl`.
- `setTeamPredictionField(...)` in `standardPredictionState.ts` is the current
  authority for numeric normalization, conversion clamping, try-reduction
  conversion adjustment, and first-try consistency side effects.
- `deriveTeamScoreFromForm(...)` / `deriveScoresFromForm(...)` are the current
  score display helpers. UI must not add another score calculator.
- `predictionMessageCatalog` and `teamNumericDeductionRate(...)` are the
  current source for deduction copy, including penalty-kick and drop-goal
  values.
- `derivePredictionSessionState(...)` exposes `visibleConsistencyIssue` and
  disables `navigation.canContinue` once score information is known at/after
  Drop Goals. This behavior should be preserved by rendering the new Drop Goals
  UI inside the same step container.

## Reusable Tries Pattern

Reusable parts from Tries:

- Team card visual treatment: border-led paper card, team name, large
  predicted rugby score, helper/error text.
- Numeric control: decrement, editable value input, increment, minimum zero,
  whole-number draft filtering, accessible labels, inputMode hint.
- Animation: optional Web Animations pulse on the numeric control/card with
  prior pulse cancellation; no queued domain updates.
- Session path: every user edit delegates immediately to the shared
  `changeTeamNumericField` action through the parent.

## Intended Extraction

Create a small numeric presentation family in
`reactPredictionPresentation.tsx`:

- `PredictionTeamNumericStep` for two-team scoring steps.
- `TeamNumericPredictionCard` for one team.
- `NumericStepper` for the `[-] [value] [+]` control.

`TriesPredictionStep` should be refactored onto the same family without
changing its accepted behavior. `ConversionsPredictionStep`,
`PenaltyKicksPredictionStep`, and `DropGoalsPredictionStep` should use the same
family with field-specific labels, helper copy, conversion context, optional
max/disabled values from existing helpers, derived score display, and
rule-derived deduction copy passed from the resolved step message.

## Progress

- [x] Read operating instructions and required platform/core docs.
- [x] Inspected latest accepted 010A, 010A1, 010A2, and 010A3 audits.
- [x] Inspected React Tries presentation and older score component path.
- [x] Inspected prediction session actions, standard form helpers, ruleset
      fields, message catalog, score helpers, consistency guard, and focused tests.
- [x] Implement reusable numeric presentation foundation.
- [x] Wire Conversions.
- [x] Wire Penalty Kicks and Drop Goals.
- [x] Add focused component tests.
- [x] Extend one focused browser spec and capture evidence.
- [x] Update platform/core/map/build docs.
- [x] Create `docs/AUDIT_010B_Numeric_Scoring_Steps.md`.
- [x] Run final focused checks.
- [x] Package EOMD zip.

## Browser Budget

- Planned focused browser batch: one run of
  `tests/e2e/react-prediction-presentation.spec.ts` targeted at the 010B numeric
  scoring journey with evidence under `test-results/ccpp010b`.
- Used focused browser batch:
  `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=test-results/ccpp010b npm run test:e2e -- tests/e2e/react-prediction-presentation.spec.ts -g "CCPP-010B numeric scoring steps" --workers=1 --retries=0`.
  The first sandboxed attempt exited before useful browser output; the approved
  local-browser run passed 1 Chromium test.
- No additional browser batch was used.

## Checks To Run

- Focused numeric presentation unit tests in
  `tests/unit/prediction-presentation-host.test.ts`.
- Affected sequence/session tests where appropriate:
  `tests/unit/prediction-session.test.ts` and
  `tests/unit/prediction-sequence.test.ts`.
- `meteor npm run typecheck`
- Focused browser batch.
- `meteor npm run lint`
- `meteor npm run lint:project`
- Changed-file Prettier check.
- `git diff --check`

## Completed Checks

- `meteor npm exec vitest run --config vitest.config.mts tests/unit/prediction-presentation-host.test.ts tests/unit/prediction-session.test.ts tests/unit/prediction-sequence.test.ts`
  - Passed: 3 files, 60 tests.
- `meteor npm run typecheck`
  - Passed.
- Focused browser batch listed above.
- `meteor npm run lint`
  - Passed.
- `meteor npm run lint:project`
  - Passed.
- `./node_modules/.bin/prettier --check ...changed files...`
  - Passed.
- `git diff --check`
  - Passed.
- `tsconfig.tsbuildinfo` was restored after typecheck touched it as generated
  metadata.

## Exact Next Action

Stop. CCPP-010B is implemented, verified, documented, and packaged. Do not
begin Cards, First Try, Highest-Scoring Half, Half-Time Leader, custom-question,
Review, quiz, or Kaplay work.
