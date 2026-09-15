# Rugby Rooster Predictions

## Scope

CCPP-006 adds the first complete player prediction flow for Rugby Rooster:

- A signed-in verified player opens a published fixture.
- The player enters the predictions required by that fixture's stored scoring
  ruleset snapshot.
- The player submits the prediction before scheduled kickoff.
- The player can revisit and revise the saved entry before kickoff.
- After kickoff or cancellation, the player's saved entry remains visible but
  read-only.

Rugby Rooster remains separate from Rugby Tracker / Rucks and Mauls. This
milestone does not add results, leaderboards, leagues, prizes, sponsorships,
custom-question administration, AI, service workers, or Kaplay animation.

## Player Flow

Published fixture detail pages link to `/games/:fixtureId/predict`.

Anonymous visitors can browse fixtures and open the prediction route. The route
uses the existing passwordless sign-in flow and a validated `returnTo` path back
to the selected prediction page. CCPP-006 does not create a second
authentication path.

Signed-in verified players see:

- Fixture identity.
- Competition and scheduled kickoff.
- Whether entry is open or locked.
- A grouped prediction form while the fixture is open.
- A review section with derived predicted team scores.
- A success confirmation after create or revision.
- Their saved entry when revisiting the route.

## Supported Prediction Fields

The CCPP-006 form renders the enabled questions from the fixture's stored
ruleset snapshot. The default CCPP-003 ruleset includes:

- Match result: Team 1, Team 2, or Draw.
- Team 1 and Team 2 tries.
- Team 1 and Team 2 conversions.
- Team 1 and Team 2 penalty kicks.
- Team 1 and Team 2 drop goals.
- Team 1 and Team 2 yellow cards.
- Team 1 and Team 2 red cards.
- First try: Team 1, Team 2, or No tries.
- Highest-scoring half: First half, Second half, or Equal points.
- Half-time leader: Team 1, Team 2, or Draw.

Predicted team score is derived from tries, conversions, penalty kicks, and drop
goals. It is shown for review but is not entered as a separate editable answer.

If a fixture snapshot includes enabled custom numeric or custom categorical
questions, the form renders them from that snapshot. CCPP-006 does not add admin
UI to configure those questions.

## Validation And Review

Client controls use numeric inputs, labels, required fields, and mobile-friendly
sections. The browser keeps unsaved values after server validation errors,
conflicts, or failed submission attempts.

The server remains authoritative. It validates every submitted prediction
against the fixture's stored ruleset snapshot and the shared scoring validation
contracts. It rejects contradictions such as conversions exceeding tries,
selected match result disagreeing with derived predicted scores, or No tries
being selected while try totals are positive.

## Locking And Revisions

Predictions are editable only while server time is strictly before the fixture's
current scheduled kickoff. At exact kickoff equality and after kickoff, writes
are rejected.

For CCPP-006, eligibility follows the fixture's current scheduled kickoff. If a
future correction reschedules a fixture into the future, editing can reopen. No
separate permanent lock policy exists yet.

Cancelled fixtures do not accept writes. A saved entry remains readable by its
owner after kickoff or cancellation.

The form captures the saved entry revision when editing starts. Reactive updates
do not replace the captured revision or unsaved answers. If a stale revision is
submitted, the server returns a conflict and the browser offers an explicit
reload that intentionally replaces unsaved values with the saved entry.

When the authenticated account changes or signs out, displayed prediction form
state is cleared and repopulated only from the new account's own subscription.

## Animation Boundary

The CCPP-006 React prediction flow is fully usable without Kaplay. Inputs,
navigation, validation, saved-entry display, revision handling, and submission
do not depend on animation state or on animations completing.

Future animation work can enhance the experience, but disabling, delaying, or
failing animations must not lose answers or prevent submission.

## Deferred Decisions

- Permanent lock policy after rescheduling.
- Match results and final scoring persistence.
- Leaderboards and league aggregation.
- Prize, venue, sponsorship, and competition rules.
- Admin configuration for custom fixture questions.
- Kaplay animation design and mascot behavior.
