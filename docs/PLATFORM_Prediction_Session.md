# Rugby Rooster Prediction Session Platform

## Purpose

CCPP-009A extracts the editable prediction session above the replaceable
presentation subtree. CCPP-009A1 tightens that extracted session's lifecycle,
command guards, and hook-level verification. Standard React remains the only
normal player-facing renderer in this milestone, but it consumes a
renderer-facing session contract instead of owning prediction answers,
navigation, revision capture, and submission behavior inside the page
component.

No Kaplay runtime, canvas, renderer picker, animation preference, fallback
machinery, sprite loading, or runtime mode switching is implemented in 009A or
009A1.

## Ownership And Lifetime

Normal route ownership remains:

1. `imports/ui/pages/PredictionEntryPage.tsx` parses `/games/:fixtureId/predict`,
   handles authentication states, subscribes to fixture and prediction data, and
   waits for readiness before initialization.
2. `usePredictionSession(...)` in
   `imports/ui/predictions/predictionSession.ts` owns the editable session for
   the current account and fixture.
3. The Standard React renderer consumes `PredictionSessionRendererState` and
   `PredictionSessionActions`.

The session host is keyed by account ID plus fixture ID. Current step, message
variant, renderer type, reactive prediction revision, and kickoff timestamp do
not determine the session lifetime.

Changing or remounting a presentation consumer does not recreate the session
because the mutable state is held in `usePredictionSession(...)` above the
renderer component. Account or fixture replacement creates a new keyed session
and isolates previous answers.

The hook's mounted-owner guard is symmetrical: effect setup marks the owner
active, and cleanup marks it disposed. This preserves React Strict Mode effect
replay while still preventing async completion handlers from updating a disposed
account/fixture owner. A presentation consumer unmount below the owner does not
dispose the session or clear an in-flight submit lock.

## Initialization

The route still waits for:

- the published fixture;
- authenticated verified account state;
- private fixture ruleset context;
- current user's prediction entry subscription.

Only after those readiness checks does the page project either the persisted
entry or an empty ruleset-based form into `PredictionFormState` and initialize
the session. This avoids starting from a temporary empty publication result and
then overwriting a player who has begun editing.

Existing saved entries start at Review. New entries start at Intro. Message
variant selection happens once during session initialization and is retained
through ordinary form edits, Back/Continue navigation, Review edits, and
renderer remounts.

## Renderer-Facing State

`PredictionSessionRendererState` exposes:

- fixture and team context;
- frozen ruleset snapshot;
- ordered active sequence;
- current Intro, step, or Review location;
- one authoritative `PredictionFormState`;
- selected message variants and the resolved current step message;
- current custom question validation, where relevant;
- predicted rugby score review values;
- result/score consistency feedback;
- navigation availability;
- dirty state;
- discard confirmation state;
- conflict and submission feedback;
- captured edit-session revision;
- read-only flag for the editable session.

The contract is typed and renderer-facing, but it does not deep-freeze or clone
large objects on every render. Renderers receive fresh state from React render
updates instead of retaining one-time snapshots.

The contract does not expose React synthetic events, DOM nodes, canvas handles,
sprite objects, direct Mongo collection mutation handles, or renderer animation
state.

## Actions

`PredictionSessionActions` exposes semantic commands:

- start prediction;
- select a built-in choice;
- change a team numeric field;
- change a custom answer by stable question ID;
- go Back;
- Continue;
- edit a step;
- return to Review;
- submit or revise;
- request, cancel, or confirm discard;
- load latest saved prediction.

Standard React adapts native input and form events into these commands. A future
Kaplay adapter should call the same commands from game input rather than
reimplementing validation or calling Meteor methods directly.

Navigation guards live in the shared session derivation and reducer. A disabled
Continue or Return to Review button and the corresponding command use the same
availability calculation, so a renderer cannot bypass custom-answer validation
or known result/score consistency guards by calling the action directly.

Read-only context is also enforced at the shared command boundary. When the
current session context is read-only, direct commands cannot change built-in or
custom answers, start or advance editable flow, navigate from Review into an
editable step, return to Review from an editable step, submit, discard, or load
latest saved data into the editable local form. Harmless dismissal commands such
as cancelling a discard dialog can still clear local UI state.

## Answer State

There is one mutable local answer state:

- match result;
- team scoring fields;
- card fields;
- enabled standard categorical answers;
- custom Number answers as strings while editing;
- custom Choice option IDs.

Blank custom Number input remains distinct from a legitimate `0`. The session
does not add browser-storage drafts or a second renderer-specific answer store.
Submitting builds the existing prediction payload shape only at submission time.

## Revision, Submission, And Async Safety

The session captures `expectedRevision` when initialized from a saved entry or
when explicitly loading latest saved data. Reactive publication updates can set
changed-entry feedback and update the persisted comparison source, but they do
not silently replace dirty answers or advance the captured expected revision.

Successful saves update the captured revision from the server response. Stale
conflicts preserve local answers and expose the accepted explicit
`Load latest saved prediction` path.

The submit command has a narrow in-flight guard so repeated activation in the
same session cannot issue duplicate submissions. Async responses include the
session key; responses for an old account/fixture session are ignored by the
client. Ignoring a stale UI response is only client-side isolation and does not
cancel a write the server has already accepted.

Internal submit completion actions remain allowed for the same still-active
session even if reactive context becomes read-only after the request was
accepted. A successful response can update the captured revision and clear
submitting state; the locked player-facing display remains based on persisted
entry data.

The default submit transport is the existing Meteor method wrapper. Unit hook
tests may inject a controlled `submitPredictionMethod` promise boundary so they
can exercise real React state, effects, and actions without calling Meteor.

## Discard And Conflict Recovery

Normal saved edit behavior remains:

- clean Review disables `Discard changes`;
- dirty Review asks for confirmation;
- `Keep editing` preserves local values;
- confirmed discard replaces local values from the latest persisted entry and
  captures that entry's revision without writing to the server.

Conflict recovery keeps `Load latest saved prediction` direct and explicit. It
replaces local values from persisted data and captures the latest persisted
revision without creating a prediction revision.

Discard and latest-load replacement are blocked while a save is in flight. The
shared replacement helper refuses to replace local answers when
`isSubmitting=true`, so direct confirmation, direct reload, and the conflict
branch cannot become destructive bypasses during an accepted pending save.

Dirty comparison includes built-in and custom answers and excludes sequence
location, message variation, feedback, and future animation state.

## Standard Adapter

`PredictionEntryPage.tsx` still owns the player route, unavailable-fixture
states, sign-in prompt, loading states, and locked/cancelled saved-entry view.

The editable Standard renderer is now a child of the session owner. It retains
the existing structure, styling, labels, controls, Review sections, Edit
actions, discard/conflict UI, and submission buttons while receiving state and
commands through the session contract.

Read-only locked/cancelled display intentionally remains outside the editable
renderer contract in 009A. It continues to render from persisted entry data, not
dirty local form values.

## Future Kaplay Adapter

A later CCPP-009 stage may add a Kaplay presentation beside Standard. That
adapter should receive the same session state and call the same session actions.
Kaplay may own canvas setup, scene objects, animation progress, visual effects,
and input affordances, but it must not own a second prediction answer state,
duplicate submission logic, or independent business validation.

Renderer replacement preserves answers, location, message variants, captured
revision, conflict state, and submission state because those values are owned by
the shared session above the renderer subtree.

009A1 verifies that behavior with a real React DOM harness: the owner remains
mounted while a keyed consumer below it is replaced, replacement sends no save
request, and a pending request completes into the surviving owner exactly once.

## Renderer-Local State

Presentation-only details remain renderer-local. Examples include hover state,
focus styling, input event details, future animation progress, sprite handles,
canvas references, scene lifecycle objects, and other visual affordances that do
not affect prediction validity or submission.
