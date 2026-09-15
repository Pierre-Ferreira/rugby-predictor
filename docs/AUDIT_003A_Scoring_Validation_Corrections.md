# AUDIT 003A - Scoring Validation Corrections

## Status

Completed locally on September 14, 2026.

CCPP-003A is a focused correction pass on the CCPP-003 scoring engine. It does not rebuild the engine and does not implement accounts, persistence, fixtures, submission, event capture, UI, leaderboard functionality, deployment, or admin permissions. No commit or push was performed.

## Reproduced Defects And Resolutions

| Defect                                                                                   | Resolution                                                                                                                                                                 | Status |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Confirmed `firstTry: no-tries` could be scored even when supplied try totals were > 0.   | Observation validation now rejects observed `no-tries` when any supplied provisional or confirmed team try count is positive.                                              | Fixed  |
| Confirmed/provisional Team1 or Team2 first-try observations could contradict zero tries. | Observation validation now rejects observed Team1/Team2 first-try values when the selected team's supplied provisional or confirmed try count is zero.                     | Fixed  |
| Public `scoreNumericDifference(1, 0, -50)` returned a negative deduction.                | Public numeric helper now rejects invalid counts, invalid rates, and unsafe arithmetic with `ScoringValidationError`.                                                      | Fixed  |
| Public `deriveMatchResult(NaN, 0)` returned Draw.                                        | Public derived-result helper now rejects invalid team scores with `ScoringValidationError`.                                                                                | Fixed  |
| Public `deriveTeamScore` accepted negative counts.                                       | Public derived-team-score helper now validates component counts, conversions <= tries, and unsafe arithmetic.                                                              | Fixed  |
| `scoreFixture(null)` threw a raw TypeError.                                              | `scoreFixture` now validates its outer request before property access and reports structured issues for malformed, missing, or invalid request fields.                     | Fixed  |
| Snapshot isolation was only indirectly tested.                                           | Regression tests now mutate source rulesets after snapshot creation, including nested custom categorical options, and verify snapshot scoring behaviour remains unchanged. | Fixed  |
| ESLint parsed valid generic arrow helpers in `.ts` as JSX.                               | `eslint.config.mjs` now parses `.ts` with the TypeScript plugin without TSX ambiguity, while `.tsx` keeps TypeScript plus JSX parsing.                                     | Fixed  |

## Acceptance Status

| Requirement                                         | Status | Evidence                                                                                                                       |
| --------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Contradictory first-try observations are rejected.  | Met    | `tests/unit/scoring-engine.test.ts` covers `no-tries` vs positive tries and Team1/Team2 vs zero selected-team tries.           |
| Pending values remain distinct from zero.           | Met    | Tests cover pending first-try and pending try observations; explicit zero still scores as zero.                                |
| Public helper validation boundaries are enforced.   | Met    | Direct tests cover numeric, categorical, derived-score, result, add-safe, and observation-status helpers.                      |
| Malformed outer requests produce structured errors. | Met    | Tests cover null, undefined, primitives, arrays, empty object, missing fields, and invalid calculation mode.                   |
| Snapshot isolation is directly tested.              | Met    | Tests mutate source rates, custom categorical deductions, and nested option IDs/labels after snapshot creation.                |
| `.ts` generic-arrow and `.tsx` parsing both work.   | Met    | A generic arrow helper remains in `tests/unit/scoring-engine.test.ts`; full ESLint also parsed the TSX app files successfully. |
| Existing valid scoring behaviour remains unchanged. | Met    | Worked examples still pass: Example A = 890 deductions / 9,110 points; Example B = 5,970 deductions / 4,030 points.            |
| Documentation accurately describes implementation.  | Met    | Updated scoring, platform, testing, build-plan, map, and README documentation.                                                 |

## Files Changed

- `README.md`
- `docs/AUDIT_003A_Scoring_Validation_Corrections.md`
- `docs/CORE_Build_Plan.md`
- `docs/CORE_Scoring_Rules.md`
- `docs/MAP_System.md`
- `docs/PLATFORM_Scoring_Engine.md`
- `docs/PLATFORM_Testing.md`
- `eslint.config.mjs`
- `imports/shared/scoring/derived.ts`
- `imports/shared/scoring/engine.ts`
- `imports/shared/scoring/errors.ts`
- `imports/shared/scoring/index.ts`
- `imports/shared/scoring/primitives.ts`
- `imports/shared/scoring/validation.ts`
- `tests/unit/scoring-engine.test.ts`

## Regression Cases

Added unit coverage for:

- Observed `no-tries` first try contradicting positive Team1 and Team2 try observations.
- Observed Team1 first try contradicting a supplied zero Team1 try observation.
- Provisional first-try contradiction rejection.
- Pending first-try and pending try observations remaining valid.
- First-try-only rulesets not requiring try totals solely for consistency checks.
- Public helper rejection of invalid rates, negative/fractional/non-finite values, unsafe arithmetic, invalid categorical values, invalid derived team score inputs, invalid match-result inputs, invalid observation statuses, and invalid safe-add values.
- `scoreFixture` malformed outer requests.
- Source ruleset mutation after snapshot creation.
- Nested custom categorical option and deduction mutation after snapshot creation.
- Scoring non-mutation of supplied snapshot, prediction, and observations.

Actual final unit-test outcome: 3 files and 39 tests passed.

## Public API Changes

No valid scoring API was removed.

The public scoring barrel now also exports `ScoringValidationError` from `imports/shared/scoring/errors.ts`. Public helper functions that were already exported now perform runtime validation and throw `ScoringValidationError` with structured `issues` for invalid inputs.

`scoreFixture` now accepts runtime `unknown` input at the public boundary so malformed calls can be validated before property access. Valid callers still pass the same request shape.

## Snapshot Mutation Results

Tests confirmed:

- A snapshot created from a mutable source ruleset keeps the original numeric rate after the source rate is changed.
- A snapshot created from a mutable custom categorical ruleset keeps the original incorrect-answer deduction and option IDs/labels after the source is changed.
- Scoring does not mutate the supplied snapshot, prediction, or observations.

The implemented guarantee is cloning/isolation of created snapshots. Runtime object freezing and database immutability are not implemented.

## Parser Verification

`eslint.config.mjs` now uses separate parser options for JavaScript/config files, `.ts`, and `.tsx`.

Verification evidence:

- `tests/unit/scoring-engine.test.ts` contains valid generic arrow helpers in a `.ts` file.
- Existing TSX application files remained in the full ESLint target set.
- Final `meteor npm run lint` passed.

## Verification Commands

| Command                       | Result | Evidence                                                                                       |
| ----------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| `meteor npm run format:check` | Passed | Prettier check completed.                                                                      |
| `meteor npm run lint`         | Passed | ESLint completed with no findings; `.ts` generic-arrow and `.tsx` parsing were both exercised. |
| `meteor npm run lint:project` | Passed | Project invariant check passed.                                                                |
| `meteor npm run typecheck`    | Passed | `tsc --noEmit --incremental false` completed.                                                  |
| `meteor npm run test:unit`    | Passed | 3 unit-test files and 39 tests passed, including 29 scoring-engine tests.                      |
| `meteor npm run test:e2e`     | Passed | Existing Playwright Chromium smoke suite passed: 1 browser-test file and 9 tests.              |

The recurring npm warning `Unknown env config "nodedir"` appeared during Meteor npm commands and did not fail verification.

## Remaining Limitations

- First-try semantic validation is limited to supplied normalized observations. Event-to-observation consistency remains upstream.
- Pending try observations remain unknown and cannot establish contradictions.
- No new observation dependencies are introduced solely for first-try consistency checks.
- Database ruleset immutability, fixture snapshot binding, submissions, fixture administration, event capture, UI, leaderboard logic, and admin permissions remain future work.
- Extra-time, cancellation, and leaderboard policies remain unresolved product decisions.
- Remote GitHub Actions verification was not observed from this workspace.
- Existing CCPP-002 dependency-maintenance findings remain unresolved.

## Documentation Paths

- `docs/CORE_Scoring_Rules.md`
- `docs/PLATFORM_Scoring_Engine.md`
- `docs/PLATFORM_Testing.md`
- `docs/MAP_System.md`
- `docs/CORE_Build_Plan.md`
- `README.md`
- `docs/AUDIT_003A_Scoring_Validation_Corrections.md`

## EOMD Handover

Files to return for EOMD:

- `docs/AUDIT_003A_Scoring_Validation_Corrections.md`
- `docs/CORE_Scoring_Rules.md`
- `docs/PLATFORM_Scoring_Engine.md`
- `docs/PLATFORM_Testing.md`
- `docs/MAP_System.md`
- `docs/CORE_Build_Plan.md`
- `README.md`
- `eslint.config.mjs`
- `imports/shared/scoring/derived.ts`
- `imports/shared/scoring/engine.ts`
- `imports/shared/scoring/errors.ts`
- `imports/shared/scoring/index.ts`
- `imports/shared/scoring/primitives.ts`
- `imports/shared/scoring/validation.ts`
- `tests/unit/scoring-engine.test.ts`
