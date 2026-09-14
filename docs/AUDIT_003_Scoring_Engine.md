# AUDIT 003 - Scoring Engine

## Status

Completed locally on September 14, 2026.

CCPP-003 implements the isolated Rugby Rooster scoring rules, pure TypeScript scoring engine, automated unit tests, and scoring documentation. No commit, push, deployment, database work, UI work, account work, fixture administration, prediction submission, event reducer, leaderboard aggregation, AI integration, or admin-permission system was performed.

## Requirement Map

| Requirement area                              | Status      | Evidence                                                                                                                                     |
| --------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Preserve Rugby Rooster identity and scope     | Met         | Scoring docs and engine remain Rugby Rooster-specific; no Rugby Tracker / Rucks and Mauls code, branding, collections, or permissions added. |
| Record precise scoring rules                  | Met         | `docs/CORE_Scoring_Rules.md`; `imports/shared/scoring/rulesets.ts`; unit tests.                                                              |
| Pure framework-independent engine             | Met         | `imports/shared/scoring/` imports no Meteor, React, Kaplay, browser globals, or database code.                                               |
| Domain types and explicit exports             | Met         | `imports/shared/scoring/types.ts`; `imports/shared/scoring/index.ts`.                                                                        |
| Prediction/ruleset/observation validation     | Met         | `imports/shared/scoring/validation.ts`; validation failure tests.                                                                            |
| Numeric and categorical scoring primitives    | Met         | `imports/shared/scoring/primitives.ts`; rate and custom-question tests.                                                                      |
| Derived team score and match result           | Met         | `imports/shared/scoring/derived.ts`; team-score, draw, penalty-try, and result tests.                                                        |
| Itemized fixture scoring output               | Met         | `imports/shared/scoring/engine.ts`; representative output below.                                                                             |
| Enabled/disabled and custom questions         | Met         | Ruleset definitions support disabled questions plus custom numeric/categorical questions; tests cover both.                                  |
| Explicit ruleset snapshots                    | Met         | `createRulesetSnapshot`, returned ruleset identity/version, and snapshot-isolation test.                                                     |
| Live, pending, provisional, and final scoring | Met         | Observation status types, pending IDs, provisional breakdowns, final-readiness rejection, and tests.                                         |
| Final scoring confirmation requirements       | Met         | Final calculations reject provisional match status or non-confirmed enabled observations.                                                    |
| Extra-time and other unresolved policies      | Outstanding | Documented as upstream integration/product decisions, not implemented.                                                                       |
| Meaningful automated tests                    | Met         | `tests/unit/scoring-engine.test.ts` covers the requested scoring, validation, pending/final, custom, snapshot, and worked-example cases.     |
| Browser smoke suite rerun                     | Met         | Existing Playwright foundation suite was rerun; no new browser tests were added because this milestone is engine-only.                       |
| Documentation and known follow-ups            | Met         | New CORE/PLATFORM/AUDIT docs plus README, product, build, testing, architecture, and map updates.                                            |

## Files Changed

- `README.md`
- `docs/AUDIT_002_Testing_Infrastructure.md`
- `docs/CORE_Product.md`
- `docs/CORE_Build_Plan.md`
- `docs/CORE_Scoring_Rules.md`
- `docs/PLATFORM_Architecture.md`
- `docs/PLATFORM_Scoring_Engine.md`
- `docs/PLATFORM_Testing.md`
- `docs/MAP_System.md`
- `docs/AUDIT_003_Scoring_Engine.md`
- `imports/shared/scoring/derived.ts`
- `imports/shared/scoring/engine.ts`
- `imports/shared/scoring/index.ts`
- `imports/shared/scoring/primitives.ts`
- `imports/shared/scoring/rulesets.ts`
- `imports/shared/scoring/types.ts`
- `imports/shared/scoring/validation.ts`
- `tests/unit/scoring-engine.test.ts`

## Engine API Summary

Primary exports live at `imports/shared/scoring/index.ts`.

- `defaultRuleset` - default CCPP-003 ruleset snapshot.
- `createRulesetSnapshot(ruleset)` - validates and clones a ruleset snapshot.
- `validateRuleset(ruleset)` - returns structured ruleset validation issues.
- `validatePrediction(prediction, ruleset)` - returns structured prediction validation issues.
- `validateObservations(observations, ruleset)` - returns structured observation validation issues.
- `scoreFixture({ ruleset, prediction, observations, calculationMode })` - validates inputs and returns a deterministic score result, or throws `ScoringValidationError` with structured issues.

Representative structured output:

```json
{
  "startingPoints": 10000,
  "totalDeductions": 5970,
  "score": 4030,
  "calculationStatus": "final",
  "pendingQuestionIds": [],
  "ruleset": {
    "schemaVersion": 1,
    "id": "rugby-rooster-default",
    "version": "ccpp-003-v1",
    "questionCount": 11
  },
  "breakdown": [
    {
      "questionId": "match-result",
      "label": "Match result",
      "type": "built-in-categorical",
      "status": "confirmed",
      "deduction": 5000,
      "items": [
        {
          "prediction": "team1",
          "observed": "team2",
          "incorrectDeduction": 5000,
          "deduction": 5000,
          "status": "confirmed"
        }
      ]
    }
  ]
}
```

## Rules Implemented

Implemented rules are authoritative in `docs/CORE_Scoring_Rules.md`.

Highlights:

- Fixture starting points are `10,000`.
- Final score is floored with `max(0, 10,000 - total deductions)`.
- Wrong result deducts `5,000` but never disqualifies a player.
- Draw is a real match-result prediction.
- Numeric deductions use absolute difference times the configured rate, per team where applicable.
- Team scores are derived from tries, conversions, penalty kicks, and drop goals.
- Component deductions and team-score deductions both apply when enabled.
- Penalty tries are normalized input totals: one try plus one conversion, worth seven points, with no second engine-side conversion added.
- Predictions must use Team1/Team2 internally and cannot submit independently editable team scores.
- Conversions cannot exceed tries.
- Match-result and first-try predictions must agree with derived prediction components.
- Pending observations are distinct from zero, Draw, or No tries.
- Provisional deductions can be evaluated for "If it ended now" output.
- Official final scoring rejects pending or provisional enabled observations.

## Worked Examples

Example A from `docs/CORE_Scoring_Rules.md`:

- Deductions: tries `50`, conversions `50`, penalty kicks `200`, team score `140`, yellow cards `200`, first try `250`.
- Total deductions: `890`.
- Final score: `9,110`.

Example B from `docs/CORE_Scoring_Rules.md`:

- Deductions: match result `5,000`, tries `50`, penalty kicks `200`, team score `220`, highest-scoring half `250`, half-time leader `250`.
- Total deductions: `5,970`.
- Final score: `4,030`.

Both examples are verified in `tests/unit/scoring-engine.test.ts`.

## Verification Commands

| Command                       | Result | Evidence                                                                          |
| ----------------------------- | ------ | --------------------------------------------------------------------------------- |
| `meteor npm run format`       | Passed | Prettier completed after CCPP-003 edits.                                          |
| `meteor npm run format:check` | Passed | Prettier check completed.                                                         |
| `meteor npm run lint`         | Passed | ESLint completed with no findings.                                                |
| `meteor npm run lint:project` | Passed | Project invariant check passed.                                                   |
| `meteor npm run typecheck`    | Passed | `tsc --noEmit --incremental false` completed.                                     |
| `meteor npm run test:unit`    | Passed | 3 unit-test files and 29 tests passed, including 19 scoring-engine tests.         |
| `meteor npm run test:e2e`     | Passed | Existing Playwright Chromium smoke suite passed: 1 browser-test file and 9 tests. |

The recurring npm warning `Unknown env config "nodedir"` appeared during Meteor npm commands and did not fail verification.

An earlier `meteor npm run lint` attempt failed because the Babel ESLint parser interpreted generic arrow helpers in `.ts` files as JSX. Those helpers were changed to generic function declarations, and the final lint run passed.

## Deviations And Reasoning

- No new browser tests were added because CCPP-003 has no UI surface. The existing browser smoke suite was run once to verify the foundation still works.
- Missing enabled observations are rejected instead of silently treated as pending. Callers must explicitly send `pending` when an outcome is unresolved.
- Disabled questions are omitted from breakdown output. Required scoring component inputs remain available for derived team-score and match-result questions when those questions are enabled.
- The engine returns deterministic structured data only; it does not generate explanatory prose.

## Remaining Integration Responsibilities

Still future work:

- Database storage and immutability for fixture ruleset snapshots.
- Binding submitted predictions to fixture snapshots.
- Meteor methods/publications for authorised fixture and prediction operations.
- UI for prediction submission or score display.
- Match-event capture and event-to-observation normalization.
- Official final-result confirmation workflow.
- Regulation-time versus extra-time-inclusive observation policy.
- Submission deadlines and reopening.
- Cancelled or abandoned fixture policy.
- Detailed card normalization, including second-yellow-to-red handling.
- Leaderboard, league aggregation, tie-breaking, shared prizes, and cross-ruleset aggregation semantics.
- Admin configuration permissions and limits.
- AI services and reports.
- Remote GitHub Actions verification observation.
- Existing development-tool dependency maintenance noted in CCPP-002.

## Documentation Paths

- `docs/CORE_Scoring_Rules.md`
- `docs/PLATFORM_Scoring_Engine.md`
- `docs/AUDIT_003_Scoring_Engine.md`
- `docs/CORE_Product.md`
- `docs/CORE_Build_Plan.md`
- `docs/PLATFORM_Architecture.md`
- `docs/PLATFORM_Testing.md`
- `docs/MAP_System.md`
- `README.md`

## EOMD Handover

Source and test files worth inspecting:

- `imports/shared/scoring/types.ts`
- `imports/shared/scoring/rulesets.ts`
- `imports/shared/scoring/primitives.ts`
- `imports/shared/scoring/derived.ts`
- `imports/shared/scoring/validation.ts`
- `imports/shared/scoring/engine.ts`
- `tests/unit/scoring-engine.test.ts`
- `docs/CORE_Scoring_Rules.md`
- `docs/PLATFORM_Scoring_Engine.md`
- `docs/AUDIT_003_Scoring_Engine.md`
