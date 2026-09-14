# Rugby Rooster Scoring Engine

CCPP-003 adds a framework-independent TypeScript scoring engine under `imports/shared/scoring/`.

The authoritative product rules are in `docs/CORE_Scoring_Rules.md`.

## Boundaries

The scoring engine does not import Meteor, React, Kaplay, browser globals, MongoDB collections, accounts, publications, methods, or UI code.

It implements:

- Domain types.
- Ruleset snapshots and the default CCPP-003 ruleset.
- Ruleset validation.
- Prediction validation.
- Observation validation.
- Numeric and categorical scoring primitives.
- Derived team score and match result helpers.
- Fixture scoring with a deterministic itemized breakdown.

It does not implement:

- Fixture persistence or database snapshot immutability.
- Prediction submission.
- Match-event reduction.
- Final-result confirmation workflows.
- League aggregation.
- Leaderboards.
- Admin configuration permissions.
- AI reports.

## Module Map

- `imports/shared/scoring/types.ts` - domain types, question IDs, validation issues, and result shapes.
- `imports/shared/scoring/rulesets.ts` - default ruleset snapshot.
- `imports/shared/scoring/primitives.ts` - numeric and categorical deduction primitives plus safe arithmetic helpers.
- `imports/shared/scoring/derived.ts` - team score, match result, question-field, and observation-status helpers.
- `imports/shared/scoring/validation.ts` - structured ruleset, prediction, and observation validation.
- `imports/shared/scoring/engine.ts` - fixture score calculation.
- `imports/shared/scoring/index.ts` - public exports.

## Public API

Primary imports:

```ts
import {
  createRulesetSnapshot,
  defaultRuleset,
  scoreFixture,
  validateObservations,
  validatePrediction,
  validateRuleset,
} from '/imports/shared/scoring';
```

Primary calculation call:

```ts
scoreFixture({
  ruleset,
  prediction,
  observations,
  calculationMode: 'if-ended-now',
});
```

Use `calculationMode: 'final'` only when match status and every enabled observation are confirmed. The engine rejects final calculations that contain pending or provisional observations.

Invalid input throws `ScoringValidationError`, which carries structured `issues` with `code`, `path`, and `message`.

## Snapshot Policy

Every calculation must receive an explicit validated ruleset snapshot. The engine returns the ruleset `schemaVersion`, `id`, `version`, and question count with each result.

`defaultRuleset` is a template for CCPP-003 fixtures, not a mutable current-rules global for historical predictions. Server-side persistence must eventually bind each fixture and submitted prediction to the intended ruleset snapshot.

## Representative Output

The result shape is deterministic and intended for future UI explanations and AI reports without generating commentary:

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

Numeric team questions include one item per team with `prediction`, `observed`, `difference`, `rate`, `deduction`, and `status`.

Pending observations use `deduction: null` and appear in `pendingQuestionIds`; they are not treated as zero deductions for correctness.

## Future Integration Responsibilities

Server-side milestones must still implement:

- Immutable database storage for fixture ruleset snapshots.
- Binding submitted predictions to fixture snapshots.
- Authorised fixture and prediction operations through Meteor methods and publications.
- Match-event capture and event-to-observation normalization.
- Confirmed final-result workflow.
- Leaderboard and league aggregation semantics across possibly different rulesets.

The engine is ready for those callers but does not enforce their persistence or authorization responsibilities.
