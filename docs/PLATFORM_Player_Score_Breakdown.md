# Rugby Rooster Player Score Breakdown Platform

CCPP-011C adds the signed-in player's own fixture score breakdown. It is a
presentation layer over the accepted CCPP-011A projection, not a new scoring
path.

## Authority And Privacy

The route uses the existing owner-only Meteor method:

- `predictions.getMyFixtureScore`

The client supplies only a fixture ID. The server derives the authenticated
verified player from the Meteor invocation, loads that player's saved
prediction by `{ fixtureId, userId }`, loads the current canonical match
result, and returns the CCPP-011A `PlayerFixtureScoreProjection` or `null` when
the player has no saved prediction.

There is no second score-breakdown method, no duplicate deduction algorithm,
and no UI-side scoring formula. The page never accepts a user ID, prediction
payload, result observations, result revision, or deduction values from the
client. It does not expose another player's prediction details.

## Route And Entry Points

Route:

- `/games/:fixtureId/my-score`

Source:

- `imports/shared/playerFixtureScores/breakdownViewModel.ts`
- `imports/ui/pages/PlayerScoreBreakdownPage.tsx`
- `imports/shared/routes.ts`
- `imports/shared/auth/redirects.ts`
- `imports/ui/fixtures/fixtureUi.ts`

The route uses the public/player layout and the existing passwordless sign-in
return flow. Safe auth return paths allow `/games/:fixtureId/my-score`.

Current-user contexts link to the page:

- fixture leaderboard participation status shows `View my score` for a
  participating signed-in player;
- the saved/read-only prediction view links to `View my score`.

Leaderboard internals remain unchanged. The score breakdown link is a route to
the current player's own score, not a leaderboard row drill-down.

## View Model Contract

`buildPlayerScoreBreakdownViewModel(...)` is framework-independent and maps the
011A projection to player-facing sections. It performs presentation mapping
only:

- sequence ordering;
- question and section labels;
- actual fixture team names;
- custom question prompts and banter labels;
- custom Choice option labels from stable option IDs in the fixture ruleset
  snapshot;
- Pending, Void, resolved, and deduction display text;
- summary rows and lifecycle labels;
- zero-floor explanation when the authoritative projection score is `0` because
  deductions exceed starting points.

It must not call scoring primitives, calculate deductions, decide correctness,
or rebuild `currentScore` / `finalScore`. CCPP-011A remains authoritative for
score status, score totals, resolved deductions, pending counts, component
deductions, item status, and zero floor.

## Section Order

The player-facing order follows the prediction journey:

1. Match Result.
2. Tries.
3. Conversions.
4. Penalty Kicks.
5. Drop Goals.
6. Predicted Score.
7. Cards.
8. First Try.
9. Highest-Scoring Half.
10. Half-Time Leader.
11. Active custom questions in ruleset order.

The `Predicted Score` section represents the authoritative `team-score`
component emitted by the CCPP-011A projection. It is shown after Drop Goals
because the predicted rugby match score is derived from tries, conversions,
penalty kicks, and drop goals in the prediction experience. The UI does not
hide that deduction and does not recalculate it; it only labels the projection's
existing team-score rows in a way a player can understand.

Cards are grouped into one `Cards` section for scanning, while Yellow Cards and
Red Cards remain separate rows per team.

## Pending, Zero, And Void

Pending is distinct from zero. A blank official observation appears as Pending;
an explicit `0` observation appears as resolved zero and can produce `No
deduction`.

Pending is also item-level. A team numeric component can be partially pending:
for example, the Tries section can show Springboks resolved with a `-50`
deduction while All Blacks remains Pending. The section badge reports the
pending item count, but resolved rows stay visible and do not flatten to a
section-wide Pending state.

Void is non-pending and zero-deduction. Custom Void rows show `Void`, `No
deduction`, and an explanatory note that the question was excluded from
scoring. Void does not claim the prediction was correct.

Custom Number rows display numeric predicted and actual values. Custom Choice
rows resolve both predicted and observed stable option IDs to the frozen option
labels from the fixture ruleset snapshot. Unknown option IDs are displayed as
unknown rather than guessed.

## Lifecycle And Refresh

`awaiting_result` shows that scoring has not started and does not present the
starting points as an earned current score.

`provisional` shows `If it ended now`, the authoritative current score,
starting points, resolved deductions, and pending count.

After CCPP-011D live result tracking starts, `/my-score` receives the same
011A projection with enabled built-in live counters resolved to actual `0`.
Tries, Conversions, Penalty Kicks, Drop Goals, Yellow Cards, and Red Cards show
zero actuals and their authoritative deductions instead of Pending. First Try,
Highest-Scoring Half, Half-Time Leader, Custom Number, and Custom Choice still
show Pending until settled.

`final` shows `Final Score`, final/current score, and total deductions without
pending indicators except engine-supported Void rows.

`cancelled` is a non-score state.

The page fetches immediately when the signed-in verified player, fixture, and
ruleset are ready. It also exposes a manual `Refresh` action for awaiting and
provisional states. While the page is visible and the score is awaiting or
provisional, it refreshes roughly every 15 seconds. Polling stops when the
projection is final, cancelled, hidden, or unmounted.

If an initial score request fails, the page shows a blocking retry state. If a
refresh fails after a successful load, the last-good breakdown remains visible
and a small refresh failure status is shown.

Result corrections are reflected by calling the same owner-only score method
again. No page reload is required.

## Deferred

CCPP-011C does not implement AI explanations, leagues, prizes, another user's
breakdown, score persistence, background scoring jobs, live event ingestion, or
animation work.
