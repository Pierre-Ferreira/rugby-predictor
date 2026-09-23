# Rugby Rooster Match Results

CCPP-008B adds the authoritative admin workflow for recording what happened in
a rugby match and settling prediction questions from the fixture's frozen
ruleset snapshot.

It does not persist Rugby Rooster player scores, leaderboard positions, winners,
or live match events.

## Result Lifecycle

Admin-facing states:

- `No result`: no result document exists for the fixture.
- `Provisional`: one result document exists. For results started through live
  result tracking, built-in cumulative counters are real current observations
  and start at zero; other observations may still be Pending, Provisional,
  Settled, or custom Void.
- `Final`: final confirmation succeeded. The result is read-only in this
  milestone.

Domain statuses:

- `pending`: no official value is known.
- `provisional`: a value is stored for admin review and future if-ended-now
  calculation.
- `confirmed`: a final settled official value.
- `void`: custom questions only; the question cannot be reliably settled and
  deducts no points.

CCPP-011D makes the live-result boundary explicit: no result document is not
the same as a provisional result whose counters are zero. Admins start live
result tracking intentionally from the result screen; Rugby Rooster does not
auto-start tracking when a fixture is published, predicted, viewed, or past
kickoff.

CCPP-011D1 keeps that explicit start boundary and makes it part of prediction
access. In automatic prediction-access mode, starting result tracking locks
future prediction writes. An admin may explicitly reopen predictions after
result tracking has started, and later saves/corrections to the provisional
result do not reset that override. Final confirmation locks predictions and
cannot be reopened for editing.

Final confirmation is deliberate and irreversible in CCPP-008B. There is no
delete, reset, reopen, unconfirm, or correction workflow yet.

## First Creation Boundary

`matchResults.admin.startResultTracking` is the production path that creates
the first canonical result document at revision `1`.

`matchResults.admin.saveProvisional` updates an existing provisional result
only. In production, `saveProvisional` with `expectedRevision: 0` and no result
document is rejected; it no longer creates the first result.

## Pending Versus Zero

Blank admin inputs are stored as Pending. An entered `0` is an observed zero.
CCPP-011D preserves that rule and adds one explicit initialization case: when
an admin starts live result tracking, enabled built-in cumulative counters are
stored as observed provisional zero values for both teams.

This distinction applies to:

- tries;
- conversions;
- successful penalty kicks;
- drop goals;
- yellow cards;
- red cards;
- custom Number observations.

## Built-In Observations

For each team, admins capture:

- tries;
- conversions;
- successful penalty kicks;
- drop goals;
- enabled yellow cards;
- enabled red cards.

Values must be safe non-negative integers. Conversions cannot exceed tries.

When live result tracking starts, enabled counters in this built-in set are
initialized to zero for both teams. First Try, Highest-Scoring Half,
Half-Time Leader, custom Number, and custom Choice observations remain Pending
until they are determinable or explicitly settled. At the initialized `0-0`
score, Match Result is derived as Draw for provisional if-ended-now scoring;
`No Tries Today!` is not inferred for First Try at kickoff.

The Rugby Rooster penalty-try convention is unchanged: a penalty try counts as
one try and one conversion. Admins enter normalized totals that already include
that convention.

The actual rugby score and Match Result are derived from component
observations. Admins do not type a separate final score or actual winner.

Enabled standard categorical settlements are:

- First Try: first team's actual name, second team's actual name, or
  `No Tries Today!`;
- Highest-Scoring Half: `First Half`, `Second Half`, or `Equal Points`;
- Half-Time Leader: first team's actual name, second team's actual name, or
  `Half-time Draw`.

First Try is checked against observed try totals. If both teams have zero tries,
`No Tries Today!` is the only final-consistent outcome.

## Custom Settlement

Active frozen custom Number questions show the prompt, optional banter,
counting definition, player prediction range, deduction rate, official observed
value, and settlement status. Observed reality may exceed the player prediction
range.

Active frozen custom Choice questions show the prompt, counting definition,
frozen options, incorrect-answer deduction, official correct option, and
settlement status. The official answer is the stable option ID, not the label.

Custom questions may be explicitly Void. A Void custom question:

- is not Pending;
- stores no official value;
- deducts zero points in future scoring;
- does not block final confirmation;
- remains visible for auditability.

Built-in observations are not voidable.

Incoming admin observation objects are checked before Rugby Rooster applies the
server-owned provisional/final lifecycle status. Built-in observations accept
only `pending`, `provisional`, or `confirmed` as incoming non-void statuses and
only the supported `status` and `value` fields. Unknown statuses, built-in
`void`, and unknown nested observation fields are rejected instead of being
silently normalized into a valid result.

## Fixture Eligibility

Result administration is available only for published, non-cancelled fixtures.

Draft fixtures have no official result administration. Cancelled fixtures are
read-only. If result data existed before cancellation, it remains visible and is
not deleted. A cancelled fixture with a provisional result remains labelled
Provisional in the read-only result summary; it is not automatically promoted to
Final.

## Rule Authority

The published fixture `rulesetSnapshot` defines which observations are required
or allowed. Disabled questions do not require observations and reject injected
observations.

Current defaults, draft question configuration, and client-submitted question
definitions are not used to settle results.

## Extra Time And Cards

The canonical CCPP-003 scoring rules leave extra-time treatment unresolved. The
engine scores the supplied observation set. CCPP-008B does not define whether a
future match-event reducer should include or exclude extra time.

Detailed card-event normalization is also unresolved, including second-yellow
dismissals and yellow-card upgrades. CCPP-008B stores only admin-entered yellow
and red card totals.

## Out Of Scope

CCPP-008B intentionally does not implement:

- persisted Rugby Rooster player scores;
- leaderboards, rankings, or winners;
- score jobs;
- public live deductions;
- live rugby event capture;
- live match lifecycle states;
- Kaplay prediction experience.

Open product questions remain for balancing fixtures with different optional or
custom deduction totals, future correction/reopen workflows, public/provisional
if-ended-now presentation, and persisted scoring/leaderboard settlement.
Historical provisional result records with blank built-in counters are not
globally reinterpreted as zero.
