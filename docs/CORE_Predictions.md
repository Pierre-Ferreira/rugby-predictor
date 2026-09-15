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

CCPP-006A corrects the locked saved-entry display: when a page becomes
read-only because kickoff passes or the fixture is cancelled, the visible saved
prediction is derived from the persisted entry. Dirty local form values are not
auto-saved and are not presented as though they were saved. If no saved entry
exists, the locked view says that no saved prediction exists.

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

When the fixture becomes read-only while a player has unsaved local changes, the
editable form is removed and the "Saved prediction" display shows the current
persisted entry. This applies to kickoff locking and cancellation. The client
must not fabricate a saved prediction from dirty form state.

When the authenticated account changes or signs out, displayed prediction form
state is cleared and repopulated only from the new account's own subscription.

## Prediction Presentation Architecture

Rugby Rooster will have two complete prediction presentation experiences.

The animated Kaplay experience will be the default prediction experience. It can
own the visual scene, rooster animations, transitions, reactions, effects, and
animated interactions.

The standard non-animated experience is also a complete prediction experience.
It is not temporary scaffolding and not merely an accessibility afterthought. It
provides the whole usable prediction sequence without Kaplay and is the
resilient fallback when animations are disabled by the player, reduced motion is
preferred, device or browser capability is unsuitable, Kaplay initialization
fails, or Kaplay fails at runtime.

Both experiences must share one prediction domain and state model. They must use
the same prediction answers, validation rules, fixture ruleset snapshot
interpretation, navigation and step semantics where applicable, and Meteor
submission contract. Kaplay must not implement separate business validation that
can diverge from the standard experience.

Switching or falling back between experiences must preserve the player's
answers. Kaplay initialization or runtime failure must never lose answers, block
progression, or prevent submission. Nothing essential to successful prediction
submission may depend on an animation completing.

Player-facing controls should be framed around animation, such as "Animations
On" and "Animations Off." Implementation terms such as `kaplay` and `standard`
may be used internally when that future milestone implements them.

## Deferred Decisions

- Permanent lock policy after rescheduling.
- Match results and final scoring persistence.
- Leaderboards and league aggregation.
- Prize, venue, sponsorship, and competition rules.
- Admin configuration for custom fixture questions.
- Kaplay animation design, mascot behavior, capability detection, fallback
  machinery, and player animation controls.
