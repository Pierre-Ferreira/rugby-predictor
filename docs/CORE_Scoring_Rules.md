# Rugby Rooster Scoring Rules

This document is the authoritative scoring specification for Rugby Rooster CCPP-003.

Rugby Rooster is a standalone rugby prediction game. These rules do not import requirements, branding, data models, permissions, or architecture from Rugby Tracker / Rucks and Mauls.

## Fixture Score

Each player starts a fixture with `10,000` points.

For numeric predictions:

- Deduction equals `absolute difference * rate`.
- Team-based numeric questions apply per team and then sum both teams.
- Final fixture score equals `max(0, 10,000 - total deductions)`.
- The full deduction breakdown remains available even when the zero floor applies.

Picking the wrong match result does not disqualify a player. There is no eligibility-to-win boolean based on that answer.

## Default Questions

| Prediction                                          | Deduction                                            |
| --------------------------------------------------- | ---------------------------------------------------- |
| Match result: Team1 / Team2 / Draw                  | 5,000 for an incorrect prediction                    |
| Tries                                               | 50 per try difference, per team                      |
| Conversions                                         | 50 per conversion difference, per team               |
| Penalty kicks                                       | 100 per successful penalty kick difference, per team |
| Drop goals                                          | 150 per successful drop goal difference, per team    |
| Team score                                          | 20 per point difference, per team                    |
| Yellow cards                                        | 200 per card difference, per team                    |
| Red cards                                           | 200 per card difference, per team                    |
| First try: Team1 / Team2 / No tries                 | 250 for an incorrect prediction                      |
| Highest-scoring half: First / Second / Equal points | 250 for an incorrect prediction                      |
| Half-time leader: Team1 / Team2 / Draw              | 250 for an incorrect prediction                      |

Team1 and Team2 are the internal sides. The engine does not assume Home/Away.

## Prediction Validation

Numeric answers must be finite, non-negative safe integers. The engine also rejects calculations that would produce unsafe integer arithmetic.

Conversions cannot exceed tries.

Predicted team score is derived from scoring components only:

```text
5 * tries + 2 * conversions + 3 * penalty kicks + 3 * drop goals
```

Do not store or submit a second independently editable predicted team score.

A selected match result must agree with the scores derived from the prediction's scoring components.

First-try answers must agree with predicted tries:

- `No tries` requires zero predicted tries for both teams.
- `Team1` requires Team1 to have at least one predicted try.
- `Team2` requires Team2 to have at least one predicted try.

Observed first-try answers are also checked against supplied try totals when enough information is available:

- An observed `No tries` answer contradicts any supplied provisional or confirmed positive try count for either team.
- An observed `Team1` or `Team2` answer contradicts a supplied provisional or confirmed zero try count for the selected team.
- A pending first-try observation remains valid.
- A pending try count is unknown, not zero.
- If the selected ruleset does not otherwise require try totals, the engine does not require new try observations solely to perform this semantic check.

This semantic validation is limited to supplied normalized observations. Event-to-observation consistency remains an upstream match-event integration responsibility.

## Penalty Tries

A penalty try counts as one try and one conversion for this game. It contributes seven points.

The scoring engine receives normalized totals that already include penalty tries as try and conversion counts. Treat those conversions as game accounting, not kicker statistics. The engine does not add penalty-try conversions again.

## Team-Score Deductions

Team-score deductions apply in addition to component deductions. This is intentional.

For example, if Team1 is one converted try higher than predicted, the try, conversion, and derived team-score differences can all deduct points when those questions are enabled.

## Ruleset Snapshots

Every calculation receives an explicit ruleset snapshot with:

- `schemaVersion`
- ruleset `id`
- ruleset `version`
- question definitions

The default ruleset is `rugby-rooster-default` version `ccpp-003-v1` and includes every default question above.

The engine supports enabled or disabled questions, custom numeric questions, and custom categorical questions. Custom numeric questions use `absolute difference * rate`. Custom categorical questions use stable option IDs and a fixed incorrect-answer deduction.

No arbitrary code, executable formulas, or AI-defined scoring rules are supported.

This configuration support is not the same as future administrator permission to change a fixture's question set. Exact admin permissions, configuration limits, and which future questions must remain mandatory are unresolved product decisions.

Existing predictions must be scored with the ruleset snapshot bound to their fixture, never by looking up mutable current rules. Database immutability and binding submitted predictions to fixture snapshots are future server responsibilities.

The CCPP-003A engine snapshot helper clones the supplied ruleset data so later source-object mutations do not alter the snapshot used for scoring. TypeScript `readonly` declarations are not a runtime freeze. The engine does not implement database immutability.

## Live And Final Scoring

The agreed live UI label is `If it ended now`.

The engine accepts explicitly supplied observations. It does not derive observations from match events in this milestone.

Observation statuses:

- `pending` means no value is known yet and contributes no current deduction.
- `provisional` means a supplied value can be scored now but remains provisional.
- `confirmed` means a supplied value is confirmed.
- `void` is allowed only for custom questions and means the question cannot be
  reliably settled. It contains no observed value, deducts zero points, is not
  Pending, and does not block final calculation.

Pending is distinct from real zero, Draw, or No tries. A live try count of zero is usable when supplied as a provisional or confirmed value. An unresolved first-try outcome must be represented as pending.

Final scoring requires confirmed match status and confirmed observations for every enabled question. Attempts to produce an official final score with pending or provisional observations are rejected.

For custom questions, Void is also final-ready and deducts zero. Built-in
observations cannot be Void.

Actual team scores and match result are derived from supplied normalized scoring totals where complete. The engine does not accept contradictory parallel actual scores or match-result answers. If required scoring components are pending, dependent team-score and match-result questions remain pending.

Half-time leader, highest-scoring half, and first try are accepted as explicit observations. Future match-event reduction may derive them, but that reducer is outside CCPP-003.

Mixed pending and explicit-zero example:

- Question: tries.
- Prediction: Team1 predicts 1 try; Team2 predicts 1 try.
- Observation: Team1 has an explicit provisional try count of 0; Team2's try count is pending.
- Breakdown: Team1 difference 1 at 50 = 50. Team2 observation, difference, and deduction are `null`.
- The tries question is `partially-pending`, remains listed in `pendingQuestionIds`, and the known 50-point deduction contributes to the current total.
- The overall live calculation remains provisional.

## Worked Example A

Prediction:

- Team1: 2 tries, 1 conversion, 2 penalty kicks, 0 drop goals, 1 yellow card, 0 red cards = 18 points.
- Team2: 1 try, 1 conversion, 1 penalty kick, 0 drop goals, 0 yellow cards, 0 red cards = 10 points.
- Match result Team1, first try Team2, highest-scoring half Second, half-time leader Draw.

Confirmed observations:

- Team1: 3 tries, 2 conversions, 1 penalty kick, 0 drop goals, 1 yellow card, 0 red cards = 22 points.
- Team2: 1 try, 1 conversion, 2 penalty kicks, 0 drop goals, 1 yellow card, 0 red cards = 13 points.
- Match result Team1, first try Team1, highest-scoring half Second, half-time leader Draw.

Deductions:

- Tries: Team1 difference 1 at 50 = 50.
- Conversions: Team1 difference 1 at 50 = 50.
- Penalty kicks: Team1 difference 1 plus Team2 difference 1 at 100 = 200.
- Team score: Team1 difference 4 plus Team2 difference 3 at 20 = 140.
- Yellow cards: Team2 difference 1 at 200 = 200.
- First try: incorrect = 250.

Total deductions: `890`. Final score: `9,110`.

## Worked Example B

This example shows wrong-result scoring and normalized penalty-try accounting.

Prediction:

- Team1: 1 try, 1 conversion, 1 penalty kick, 0 drop goals, 0 cards = 10 points. The try plus conversion may represent a normalized penalty try worth seven points, plus one penalty kick.
- Team2: 0 points.
- Match result Team1, first try Team1, highest-scoring half First, half-time leader Team1.

Confirmed observations:

- Team1: 1 try, 1 conversion, 0 penalty kicks, 0 drop goals, 0 cards = 7 points.
- Team2: 1 try, 0 conversions, 1 penalty kick, 0 drop goals, 0 cards = 8 points.
- Match result Team2, first try Team1, highest-scoring half Second, half-time leader Draw.

Deductions:

- Match result: incorrect = 5,000.
- Tries: Team2 difference 1 at 50 = 50.
- Penalty kicks: Team1 difference 1 plus Team2 difference 1 at 100 = 200.
- Team score: Team1 difference 3 plus Team2 difference 8 at 20 = 220.
- Highest-scoring half: incorrect = 250.
- Half-time leader: incorrect = 250.

Total deductions: `5,970`. Final score: `4,030`.

## Explicitly Unresolved Policies

These policies remain outside CCPP-003:

- Extra-time treatment. The engine scores the supplied observation set. Whether observations are regulation-time or extra-time-inclusive must be decided upstream before match-event integration.
- Submission deadlines and reopening.
- Leaderboard tie-breaking and shared prizes.
- Cancelled or abandoned fixtures.
- League aggregation across different question configurations.
- Detailed card-event normalization, including second-yellow-to-red handling.
- Administrator configuration permissions and limits.
