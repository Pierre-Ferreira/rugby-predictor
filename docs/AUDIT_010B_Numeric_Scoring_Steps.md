# CCPP-010B Numeric Scoring Steps Audit

## Scope

CCPP-010B continues the accepted React-first prediction direction after
CCPP-010A3. Match Result remains closed for this phase. This milestone migrates
only these score-building numeric steps:

- Conversions.
- Successful Penalty Kicks.
- Drop Goals.

No Cards, First Try, Highest-Scoring Half, Half-Time Leader, custom questions,
Review, quiz gameplay, Kaplay work, server methods, scoring rules, ruleset
definitions, persistence, or submission behavior were changed.

## Implementation

- `imports/ui/predictions/reactPredictionPresentation.tsx`
  - Extracts a reusable numeric presentation family:
    `PredictionTeamNumericStep`, `TeamNumericPredictionCard`, and
    `NumericStepper`.
  - Keeps Tries on the same family while preserving shared form ownership,
    blank/zero semantics, conversion-clamping delegation, and optional cosmetic
    numeric pulse behavior.
  - Adds exported React-first step components for Conversions,
    Successful Penalty Kicks, and Drop Goals.
  - Uses actual fixture team names, large derived score-so-far values, real
    HTML number inputs, and real decrement/increment buttons.
  - Cancels previous cosmetic numeric pulses before starting a new one, so
    rapid input updates the shared domain value immediately and stale animation
    effects do not queue domain updates.
- `imports/ui/pages/PredictionEntryPage.tsx`
  - Wires Conversions, Penalty Kicks, and Drop Goals to the new React-first
    numeric components.
  - Passes resolved step message deduction/supporting copy into the numeric
    family once and suppresses the old duplicate top-level deduction block for
    those numeric steps.
  - Leaves Cards and later steps on the existing React sequence.
- `tests/unit/prediction-presentation-host.test.ts`
  - Adds focused React DOM tests for the shared numeric control contract,
    Conversions, Penalty Kicks, Drop Goals, accessible labels, rule-derived
    deduction copy, and numeric animation parity.
- `tests/e2e/react-prediction-presentation.spec.ts`
  - Extends the focused React browser spec with one CCPP-010B journey:
    Match Result -> Tries -> Conversions -> Penalty Kicks -> Drop Goals.

## Domain Ownership

- All numeric edits continue to flow through
  `changeTeamNumericField(side, field, value)`.
- Conversion prediction limits remain owned by
  `setTeamPredictionField(...)` and existing form helpers. The component reads
  the try-derived `max` and contextual copy from current form state but does
  not create a second conversion validation algorithm.
- Derived score context continues to use `deriveTeamScoreFromForm(...)` /
  `deriveScoresFromForm(...)`. No new rugby score calculator was added to UI
  code.
- Penalty Kick and Drop Goal deduction text is resolved through the existing
  sequence message/ruleset path. Presentation code does not duplicate the
  100-point or 150-point deduction rates.
- Drop Goals preserves the existing session-owned
  `visibleConsistencyIssue` / `navigation.canContinue` behavior. The warning
  still appears once score-producing values are known, and Continue remains
  blocked until the selected Match Result agrees with the derived scores.

## Visual Evidence

Fresh retained browser evidence lives under:

```text
test-results/ccpp010b
```

Key screenshots:

- `browser-screenshots/010b-conversions-desktop.png`
- `browser-screenshots/010b-conversions-390.png`
- `browser-screenshots/010b-penalty-kicks-desktop.png`
- `browser-screenshots/010b-drop-goals-desktop.png`
- `browser-screenshots/010b-drop-goals-360.png`
- `browser-screenshots/010b-result-consistency-warning.png`
- `browser-screenshots/010b-cumulative-score-state.png`

Visual inspection notes:

- Conversions, Penalty Kicks, and Drop Goals share the same two-team card
  language as Tries.
- Long generated team names wrap cleanly on desktop, 390px, and 360px captures.
- Plus/minus controls remain large enough to tap, and the number field remains
  readable on mobile.
- Deduction/helper copy appears once per numeric step and remains visually
  secondary to the question and controls.
- Drop Goals shows the existing consistency warning below the numeric cards,
  with Continue disabled in the dedicated warning capture.
- No horizontal overflow was visible in the retained 390px and 360px evidence.

## Verification

Checks run:

- `meteor npm exec vitest run --config vitest.config.mts tests/unit/prediction-presentation-host.test.ts tests/unit/prediction-session.test.ts tests/unit/prediction-sequence.test.ts`
  - Passed: 3 files, 60 tests.
- `meteor npm run typecheck`
  - Passed.
- `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=test-results/ccpp010b npm run test:e2e -- tests/e2e/react-prediction-presentation.spec.ts -g "CCPP-010B numeric scoring steps" --workers=1 --retries=0`
  - Initial sandboxed attempt exited before useful browser output.
  - Approved local-browser run passed: 1 Chromium test.
  - `test-results/ccpp010b/exit.json` records exit code `0` at
    `2026-09-20T09:48:59.722Z`.
- `meteor npm run lint`
  - Passed.
- `meteor npm run lint:project`
  - Passed.
- `./node_modules/.bin/prettier --check ...changed files...`
  - Passed.
- `git diff --check`
  - Passed.

Closeout note:

- `tsconfig.tsbuildinfo` was touched by local typecheck execution and restored
  afterward because it is generated metadata unrelated to the 010B source
  change.

## Review Package

The EOMD package was created at the repository root:

```text
rugby-rooster-ccpp010b-numeric-scoring-steps-eomd-20260920.zip
```

It includes copied source, focused tests, docs, retained browser evidence, and
this verification record. Repository originals were not moved or removed.

Package inspection:

- `unzip -t rugby-rooster-ccpp010b-numeric-scoring-steps-eomd-20260920.zip`
  reported no compressed-data errors.
- `zipinfo -1 rugby-rooster-ccpp010b-numeric-scoring-steps-eomd-20260920.zip`
  listed only the curated source, docs, focused tests, and 010B evidence paths.
- Empty hidden staging entries `.git/`, `.agents/`, and `.codex/` were removed
  from the archive before final inspection.
