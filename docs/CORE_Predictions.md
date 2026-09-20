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

CCPP-006B refines the standard prediction presentation without changing the
domain model or scoring rules. Player-facing controls and review cards use the
fixture's real team names when available. The review presents derived predicted
rugby match scores, not Rugby Rooster player points or leaderboard scores.
Conversion inputs are bounded locally so a team's predicted conversions cannot
exceed that team's predicted tries, while server validation remains
authoritative.

CCPP-007 replaces the standard React all-at-once form with a guided
question-by-question sequence. The standard React experience remains complete:
players can start from Intro, answer each active built-in prediction step, Review
the same shared state, edit individual sections, submit or revise before
kickoff, explicitly reload the saved entry, and see the persisted read-only
entry after lock. Kaplay is not implemented in CCPP-007.

CCPP-007A keeps that sequence intact while tightening ruleset-aware copy and
Review behavior. Disabled built-in questions do not contribute player-facing
deduction copy, Review hides disabled rows and sections that contain no active
questions, Intro starting-points copy is interpolated from the shared scoring
configuration, Half-Time Leader copy uses explicit half-time wording, and a
known post-drop-goal result/score inconsistency disables forward Continue until
the player corrects the result or score inputs.

CCPP-008 adds fixture-level prediction question configuration for admins.
Permanent core questions remain always included. Optional standard questions
can be enabled/disabled and configured on draft fixtures, then published through
the fixture's frozen ruleset snapshot. Custom Number and Choice questions can be
authored on drafts.

CCPP-008A integrates published custom Number and Choice questions into the
Standard prediction sequence. Valid custom-question fixtures can publish, custom
answers are captured in the same prediction entry, and server validation derives
all custom semantics from the frozen fixture snapshot.

CCPP-008B adds admin match-result and prediction-question settlement in
`docs/CORE_Match_Results.md`. It records official observations and custom
settlements, including custom Void, but it still does not persist player Rugby
Rooster scores or leaderboards.

CCPP-009C1 corrects the development-only Kaplay Match Result presentation
without changing prediction rules or saved data. The Rooster shove now keeps
contact-to-push motion continuous in the pure projection, calculates exit from
full transformed character/card bounds, and uses compact scale-aware choice
geometry so team/Draw labels remain readable on narrow canvases. The Standard
prediction flow and shared answer ownership remain authoritative.

CCPP-009C2 keeps that same single-screen development preview and makes compact
stage height content-driven so the runtime, canvas aspect ratio, and mobile
evidence use one projected geometry. Fresh retained browser evidence exists for
normal/slowed Match Result playback and 360/390-style mobile layout, but the
recorded focused browser run remains `7 passed / 1 failed` after an unrerun
dirty-session test-precondition correction.

CCPP-009C3 keeps the same product surface and synchronizes measured resize
geometry below the shared prediction session. Desktop/compact breakpoint changes
may replace only the Kaplay runtime generation; they must not clear answers,
Review edit context, message variants, captured revision, saved baseline,
dirty/conflict state, or submission state. The corrected dirty saved-session
browser case passed in the fresh focused run, but full resize browser acceptance
remains pending after the recorded `7 passed / 2 failed` result.

CCPP-009C3A keeps that replacement behavior below the same shared session owner
and bounds post-ready renderer replacements with a fresh replacement deadline.
Obsolete runtime generations cannot allocate, adopt, dispatch input, or report
failure after supersession. If replacement stalls or safe teardown cannot finish
inside the bounded cycle, the player remains on the same prediction session in
Standard until a deliberate retry. Focused unit/type checks passed, and the
dirty saved-session browser journey continued to pass, but resize and
reduced-motion browser closeout remain unresolved after the permitted
`7 passed / 2 failed` current-source browser batches.

CCPP-010A makes the active prediction route use one React/HTML prediction
experience. `usePredictionSession(...)` remains the shared owner of answers,
navigation, validation state, saved baselines, conflict handling, and
submission. Match Result and Tries have React-first presentation components
with optional browser-native decoration; Kaplay remains installed but is no
longer imported or initialized by the active prediction flow.

CCPP-010A1 removes the stale player-facing `Standard prediction` Intro wording.
The Match Result step now settles to the selected answer only after a deliberate
choice, with a checked selected radio-card, `You picked ...` status, and a
`Change my selection` button. Change restores the three real choices without
changing the saved draft answer until another choice is selected. Animations On,
Animations Off, reduced motion, resize, Back, and Continue keep the same shared
React answer state.

CCPP-010B extends the React-first numeric presentation from Tries to
Conversions, Successful Penalty Kicks, and Drop Goals. Those four
score-building steps now share one two-team numeric card/control family,
including derived predicted-score-so-far context, actual team names, editable
number inputs, and real plus/minus buttons. The conversion ceiling remains
owned by the existing form/domain helper, and Drop Goals keeps the existing
result/score consistency warning and Continue block.

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
- An Intro explaining Rugby Rooster competition points versus predicted rugby
  match scores while the fixture is open.
- A numbered guided prediction sequence while the fixture is open. Active
  built-in standard steps come first, followed by active custom questions from
  the frozen fixture snapshot.
- A Review screen with derived predicted rugby match scores, scoring detail,
  active card predictions, active other predictions, active custom questions,
  and Edit actions.
- A success confirmation after create or revision.
- Their saved entry when revisiting the route.

## Supported Prediction Fields

The standard sequence renders active steps from the fixture's stored ruleset
snapshot. Intro and Review are outside numbered progress. Player-facing labels
use the fixture team display names. The default CCPP-003 ruleset includes these
active numbered built-in steps:

- Match result: fixture team one, fixture team two, or Draw.
- Each fixture team's tries.
- Each fixture team's conversions.
- Each fixture team's penalty kicks.
- Each fixture team's drop goals.
- Each fixture team's yellow cards.
- Each fixture team's red cards.
- First try: fixture team one, fixture team two, or No tries.
- Highest-scoring half: First half, Second half, or Equal points.
- Half-time leader: fixture team one, fixture team two, or Half-time Draw.

Predicted team score is derived from tries, conversions, penalty kicks, and drop
goals. It is shown for review but is not entered as a separate editable answer.
This is the predicted rugby match score only; it is not Rugby Rooster accuracy
scoring and does not compare predictions with actual results.

Internal prediction values continue to use stable domain identifiers such as
`team1`, `team2`, and `draw`. CCPP-006B changes presentation labels only and
does not migrate stored prediction shapes.

CCPP-008A appends active custom questions after the active built-in standard
steps and before Review. Custom Number questions require a valid integer within
the frozen minimum/maximum range. Custom Choice questions require one frozen
option ID. Custom answers are stored as:

```ts
customAnswers: {
  "<custom-question-id>": number | "<choice-option-id>";
}
```

The client never submits prompts, deductions, min/max values, option labels, or
question definitions. The server validates every custom answer against the
fixture's frozen published snapshot.

## Validation And Review

Client controls use numeric inputs, labels, required fields, and mobile-friendly
sections. The browser keeps unsaved values after server validation errors,
conflicts, or failed submission attempts.

The standard prediction UI sets each conversion input's maximum from that
team's predicted tries and clamps local state through the shared form helper
when conversions exceed tries or tries are reduced below the current conversion
count. This avoids the common invalid state before submission without weakening
server-side validation.

The Review derives predicted rugby match scores and the displayed derived result
through the shared scoring helpers. If required scoring inputs are invalid or
incomplete, Review says that the predicted score or derived result is
unavailable and shows the relevant validation reason where available.

After drop goals, the standard sequence warns when the selected match result
does not agree with derived predicted rugby scores. The warning allows direct
navigation to adjust the chosen result or score steps. It never silently changes
the selected result and never discards score inputs. From that point onward,
forward Continue navigation is disabled while the known inconsistency remains;
Back plus the warning's Edit match result and Edit scores actions remain
available. Final Review submission is disabled while this known inconsistency
remains.

Review follows the active sequence. A disabled question has no Review row, and
grouped Review sections such as Cards, Other Predictions, or Custom Questions
are hidden when none of their rows are active. Edit controls are rendered only
for active step destinations.

First-try answers are constrained by predicted tries. Zero predicted tries for
both teams forces `No Tries Today!`; only one team with predicted tries forces
that team; when both teams have predicted tries, team choices are available and
`No Tries Today!` is not selectable. These constraints preserve unrelated
answers.

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
`Load latest saved prediction` action that intentionally replaces unsaved values
with the saved entry.

The editable form and the latest known saved baseline are separate. A save
acknowledgement records the normalized prediction payload that was actually
submitted, with the returned revision. Edits made while that request is pending
remain unsaved and dirty after the acknowledgement. Older or temporarily absent
publication data cannot erase a newer acknowledged save, and discard during
publication lag restores the acknowledged saved answers rather than a blank or
older form.

When a saved entry or save acknowledgement arrives slightly after the editable
session initializes, the browser may reconcile only the untouched initial state
or the just-submitted saved snapshot. It must not replace answers after the
player has started editing, and it must not silently advance the captured
revision from later reactive updates. A genuinely newer published saved version
can become the latest known saved baseline for dirty/discard feedback, but the
player adopts it only through the existing explicit reload/discard action or a
legitimate successful save.

In the normal editable Review state, the explicit replacement action is labelled
`Discard changes`. It is disabled while the form matches the currently loaded
persisted prediction. When built-in answers or custom Number/Choice answers have
unsaved local edits, the action asks the player to confirm before restoring the
latest persisted prediction. Keeping editing preserves local values and performs
no server write; confirming discard also performs no server write and does not
create a prediction revision.

When the fixture becomes read-only while a player has unsaved local changes, the
editable form is removed and the "Saved prediction" display shows the current
persisted entry. This applies to kickoff locking and cancellation. The client
must not fabricate a saved prediction from dirty form state, including dirty
custom answers.

When the authenticated account changes or signs out, displayed prediction form
state is cleared and repopulated only from the new account's own subscription.

## Prediction Presentation Architecture

CCPP-010A changes the durable prediction-control architecture. The active
player prediction path is now React-first:

- React/HTML controls are authoritative for prediction answers.
- Animations are optional browser-native decoration layered over those same
  controls.
- Animations Off and reduced motion keep the same essential answer interface.
- Nothing essential to successful prediction submission may depend on animation
  completion.
- The active prediction route no longer imports, initializes, or renders the
  prediction-specific Kaplay runtime.

The shared prediction session remains the single owner of answers, validation
state, fixture ruleset interpretation, navigation, edit/review behavior,
revision handling, discard/conflict state, and Meteor submission. Presentation
code adapts browser input to session commands; it does not own a second answer
state or duplicate business validation.

Match Result plus Tries, Conversions, Successful Penalty Kicks, and Drop Goals
are React-first presentation screens. Match Result renders real Team 1, Team 2,
and Draw controls, with an optional noninteractive shove overlay for deliberate
new choices. The score-building steps render real numeric controls for both
teams, with optional cosmetic numeric reactions and derived predicted-score
context. Cards, First Try, Highest-Scoring Half, Half-Time Leader, custom
questions, and Review continue through the existing React sequence.

Kaplay remains installed and the CCPP-009 prediction-specific source remains in
the repository as superseded/deferred-cleanup code. It may inform future
genuine gameplay such as a later half-time quiz if that product idea is chosen,
but that quiz is not implemented and Kaplay is not active for prediction
controls.

The CCPP-009 work is still useful history. It produced the shared session
boundary, animation preference and reduced-motion experience, prepared Rooster
artwork, shove choreography, and visual evidence. Its historical resize browser
failure is not fixed by CCPP-010A; it ceased to be on the active prediction
path.

Player-facing controls should continue to be framed around animation, such as
"Animations On" and "Animations Off." Implementation labels such as `kaplay`
must not leak into the player-facing prediction route.

CCPP-007 adds the shared standard sequence and message architecture that the
future Kaplay experience should also consume. It does not implement Kaplay,
animations, animation toggles, reduced-motion handling, capability detection,
lazy loading, or runtime animation fallback.

CCPP-008A keeps custom questions on the same ordered sequence and form state as
built-in questions. Dynamic custom steps are suitable for future Kaplay
consumption, but CCPP-008A implements only the Standard React presentation.

CCPP-009A extracts the editable prediction session above the replaceable
presentation subtree. The session owns answers, current location, Review edit
context, selected message variants, captured expected revision, dirty/discard
state, conflict feedback, and submission state. Standard React now consumes
that session contract while preserving the accepted player-facing experience.
CCPP-009A does not implement Kaplay, canvas rendering, renderer switching,
animation preferences, or fallback machinery.

CCPP-009A1 corrects the extracted session lifecycle and command guards. React
effect replay no longer suppresses legitimate save completion for the surviving
account/fixture owner, while disposed owners still ignore obsolete responses.
When context becomes read-only, direct renderer commands cannot mutate answers,
enter editable steps, submit, discard, or load saved data into dirty local
state. A save accepted before lock can still finish for the same active session
and clear its submitting state; the visible locked display remains based on the
persisted prediction entry.

CCPP-009B adds a development/test Kaplay preview for the Match Result step.
CCPP-009B4 makes that supported screen available automatically in ordinary
local development: no settings JSON preview gate is required, and an absent or
invalid stored preference defaults to Animations On. Intro,
non-Match-Result questions, Review, and locked views still use Standard. The
preview uses the same shared
prediction session and can be switched On/Off without losing answers, location,
message variants, captured revision, conflict/submission state,
dirty/discard state, or partial custom answers. It falls back to Standard when
production disables the preview, Animations are explicitly Off, reduced motion
is requested, the step is unsupported, initialization is cancelled or fails, the
runtime fails, or the canvas loses its graphics context. Legacy
`kaplayPredictionPreview.enabled:false` development settings no longer block
the supported scene; test-only controls remain separately opted in. This
milestone does not implement the full animated flow, Rooster artwork, shove
animation, or animated Review/submission.

CCPP-009C adds the first prepared Rooster visual foundation to the development
Match Result Kaplay preview. It preserves supplied source artwork, generates a
small runtime atlas/manifest, adds framework-independent shove motion helpers,
and renders the selected answer separately while a Rooster shoves rejected
choices through the canvas presentation. This remains a single-screen
development/test preview; it is not a production rollout, full animated
prediction flow, Review/submission animation, or final visual acceptance.

## Deferred Decisions

- Permanent lock policy after rescheduling.
- Match results and final scoring persistence.
- Leaderboards and league aggregation.
- Prize, venue, sponsorship, and competition rules.
- Whether Kaplay is used later for genuine gameplay, such as a possible
  half-time quiz. That idea remains unimplemented.
- Cleanup/removal timing for superseded prediction-specific Kaplay modules and
  historical 009 browser evidence.
- Custom-question scoring or settlement, official-answer workflows, and future
  balancing across fixtures with different optional/custom question sets.
- Detailed card-event normalization, including second-yellow dismissals and card
  upgrades, remains unresolved unless a future scoring/match-event milestone
  explicitly resolves it.
