# Rugby Rooster Prediction Platform

## Collection

Prediction persistence lives in the Mongo collection `predictions`, exported
from `imports/api/predictions/collection.ts`.

Authoritative server code lives under `imports/server/predictions/`. Shared
method names, publication names, types, and submission validation live under
`imports/shared/predictions/`.

Client collection writes are denied. Authoritative writes go through Meteor
methods.

## Schema

Stored prediction documents include:

- `_id`
- `fixtureId`
- `userId`
- `prediction`
- `ruleset`
- `revision`
- `createdAt`
- `updatedAt`
- `rugbyRoosterTest.ownerRunId` when created inside isolated tests

The stored `ruleset` value is the minimum identity needed to explain the fixture
snapshot that governed the entry: `schemaVersion`, `id`, and `version`.

The full immutable scoring snapshot remains on the fixture. Prediction entries
do not copy the full ruleset snapshot and do not store match results, calculated
fixture scores, leaderboard scores, or result observations.

When the fixture snapshot contains active custom questions, the stored
`prediction` payload includes `customAnswers` keyed by stable custom question
ID. Number answers are stored as numbers. Choice answers are stored as stable
option IDs from the frozen snapshot.

## Methods

Player prediction method:

- `predictions.submit`

The method accepts only:

- `fixtureId`
- `prediction`
- optional `expectedRevision`

Unknown fields are rejected. Client attempts to assign `userId`, timestamps,
revisions, scoring results, or ownership metadata are rejected before storage.
The server derives `userId` from the authenticated Meteor invocation.

The method requires an authenticated verified account through the existing
verified-player authorization convention. Anonymous and unverified attempts are
rejected.

## Fixture Eligibility

Submissions are accepted only when all of these are true:

- The fixture exists.
- The fixture is `published`.
- The fixture is not cancelled.
- The fixture has a valid stored `rulesetSnapshot`.
- Server time is strictly before `scheduledKickoffAt`.

Draft, missing, cancelled, snapshotless, invalid-snapshot, and locked fixtures
reject writes. At kickoff equality, writes are locked.

CCPP-006 intentionally follows the fixture's current scheduled kickoff. If an
admin correction moves kickoff from the past back into the future, prediction
editing can reopen. A permanent lock policy is deferred.

## Snapshot Validation

The method validates submitted answers against the fixture's stored
`rulesetSnapshot`, never against a newly generated default ruleset.

`imports/shared/predictions/validation.ts` uses the shared scoring engine's
`validatePrediction` contract and then normalizes a plain stored prediction
payload. This preserves existing scoring rules for contradictions and unknown
fields while preventing extra client payload fields from being stored.

Custom answer validation is additive to the built-in validation. The server
requires an answer for every enabled custom question in the frozen snapshot and
rejects missing answers, unknown custom question IDs, wrong answer types,
out-of-range custom Number values, non-integers, invalid custom Choice option
IDs, and injected question definitions or deduction metadata.

## Revision And Atomicity

There is one prediction entry per authenticated user per fixture.

Indexes:

- Unique `{ userId: 1, fixtureId: 1 }`
- `{ fixtureId: 1, userId: 1 }`
- `{ "rugbyRoosterTest.ownerRunId": 1 }`

Creation uses an atomic upsert with `$setOnInsert`. A create request without an
`expectedRevision` never overwrites an existing entry. Concurrent first
submissions produce one stored entry; the competing request receives a
prediction conflict.

Updates require the captured `expectedRevision`. The update selector includes
`userId`, `fixtureId`, and `revision`, increments the revision atomically, and
replaces the complete validated `prediction` payload. Stale revisions return
`prediction-conflict` without overwriting newer answers.

## Publications

Prediction publications:

- `predictions.currentUserEntry`
- `predictions.fixtureContext`

`predictions.currentUserEntry` accepts one `fixtureId` and derives ownership
from `this.userId`. It publishes only the current verified user's entry for that
fixture. It does not accept a `userId`, guessed entry ID, or arbitrary selector.
Anonymous users receive no prediction data.

Published entry fields:

- `createdAt`
- `fixtureId`
- `prediction`
- `revision`
- `ruleset`
- `updatedAt`
- `userId`

`rugbyRoosterTest` metadata is not published.

`predictions.fixtureContext` publishes one published fixture to a verified user
with public fixture fields plus `rulesetSnapshot`. This lets the prediction form
render the questions from the stored snapshot without adding the snapshot to the
public fixture publications. Prediction answers are never included in public
fixture publications.

CCPP-006 does not add public prediction lists, admin prediction lists, or
cross-player prediction publications.

## Routes And UI

Route:

- `/games/:fixtureId/predict` - prediction entry and saved-entry view.

Source paths:

- `imports/ui/pages/PredictionEntryPage.tsx`
- `imports/ui/predictions/standardPredictionState.ts`
- `imports/shared/predictions/sequence.ts`
- `imports/shared/predictions/messages.ts`
- `imports/ui/pages/GameDetailPage.tsx`
- `imports/ui/pages/GamesPage.tsx`
- `imports/ui/fixtures/fixtureUi.ts`
- `imports/shared/routes.ts`
- `imports/shared/auth/redirects.ts`

The page subscribes to the public fixture detail and, when authenticated, to the
private fixture context plus current user's entry. Form state is reset on
account change or sign-out.

The edit session stores the fixture ID, current user ID, and captured entry
revision. Reactive entry updates can show a changed-entry notice, but they do
not replace unsaved values or the captured revision. The normal Review action is
labelled `Discard changes`, is disabled while local form state matches the
currently loaded persisted entry, and asks for confirmation before replacing
dirty local values. The conflict and changed-entry recovery action is labelled
`Load latest saved prediction`; it is the explicit path that replaces local
values and captures the latest revision.

Dirty-state comparison is intentionally small and form-local. It compares match
result, scoring values, card values, standard categorical predictions, and
custom Number/Choice answers through `predictionFormsEqual(...)`. It does not
compare transient presentation state such as the current sequence location,
selected message variants, feedback, or notices. Discarding or loading latest
saved data only replaces client state and the captured revision; it does not
call the prediction submission method and does not create a new stored revision.

The page refreshes time-sensitive UI every 15 seconds so an open page reflects
kickoff passing. Server checks remain authoritative.

When `isReadOnly` becomes true because scheduled kickoff has passed or the
fixture is cancelled, the read-only saved-entry view derives its review values
from the current persisted prediction entry. It does not read from mutable form
state, so dirty unsaved values cannot be shown as saved answers. If the current
user has no entry, the locked view shows the no-saved-prediction state. This
same persisted-entry rule applies to custom answers.

CCPP-006B kept the original route and form structure but corrected presentation
details in `PredictionEntryPage.tsx`:

- Player-facing scoring headings, numeric accessible labels, match-result
  choices, first-try choices, half-time-leader choices, review cards, and
  read-only saved-entry review values use the fixture's real team display names
  instead of generic Team 1 / Team 2 labels.
- Select option values and stored prediction payloads still use the existing
  internal domain values such as `team1`, `team2`, and `draw`.
- The review uses the shared scoring helpers `deriveTeamScore` and
  `deriveMatchResult` to display each team's derived predicted rugby match score
  and the derived result. It does not calculate Rugby Rooster player points,
  leaderboard scores, deductions, or comparisons with actual match results.
- Invalid or incomplete scoring inputs display unavailable score/result states
  with the available validation reason instead of a misleading numeric score.
- Each conversion input receives a dynamic maximum from that team's predicted
  tries. Local form state also clamps conversions immediately when a player
  enters conversions above tries or reduces tries below the current conversion
  count. The other team's values are not changed.

CCPP-007 keeps the same route and submission contract but replaces the editable
all-at-once standard form with a guided standard sequence:

- Intro is outside numbered progress and explains the difference between Rugby
  Rooster competition points/deductions and predicted rugby match scores. The
  displayed starting-points value is interpolated from the shared
  `STARTING_POINTS` scoring configuration.
- `activePredictionSteps(ruleset)` builds the active ordered list from the
  fixture ruleset snapshot. Progress, Back/Continue, final Review navigation,
  and Review edit destinations consume this list.
- `predictionMessageCatalog` stores step headings, contextual copy, and
  deduction text. The page selects message variants once per prediction session
  and keeps those variants stable through rerenders and navigation.
- Deduction text resolves against the fixture ruleset snapshot through shared
  helpers. CCPP-007A requires those helpers to ignore disabled questions, so a
  disabled numeric or categorical question cannot supply active player-facing
  deduction copy. React does not duplicate Rugby Rooster deduction constants.
- The score-building steps show running predicted rugby match scores using
  shared scoring helpers and shared rugby component point values.
- Result/score consistency warnings begin only after drop goals. The step view
  disables forward Continue navigation while a known inconsistency remains, but
  Back plus Edit match result and Edit scores remain usable. Review disables
  final submission while a known result/score inconsistency remains.
- First-try choices are constrained by predicted tries, and impossible hidden
  answers are immediately removed from local state.
- Review hides disabled rows and hides grouped sections such as Cards or Other
  Predictions when no active rows remain. Edit actions are emitted only when
  `editStepIdForReviewSection(...)` resolves to an active step.
- Existing saved entries start at Review, can Edit a step, can Return to Review,
  and submit a revision with the existing method payload.
- Read-only locked/cancelled display continues to render the persisted saved
  entry, not dirty local state.

CCPP-008A extends the same sequence with active custom questions from the frozen
ruleset snapshot. Custom questions appear after active built-in steps and before
Review. Custom Number steps render prompt, optional banter/context, deduction
semantics, counting definition, and bounded numeric controls. Custom Choice
steps render prompt, optional banter/context, deduction semantics, counting
definition, and frozen option labels while storing the selected option ID.

Review shows a `CUSTOM QUESTIONS` section only when custom questions exist.
Each custom row resolves the saved answer through the frozen question
definition and can Edit back to that specific custom step while the fixture is
open.

## Prediction Presentation Architecture

Future Rugby Rooster prediction presentation has two complete experiences:

- `kaplay` - the default animated experience. Kaplay may own the visual scene,
  rooster animations, transitions, reactions, effects, and animated
  interactions.
- `standard` - the complete non-animated prediction experience. It must provide
  the full usable prediction sequence without Kaplay and act as the resilient
  fallback for user-disabled animations, reduced-motion preference, unsuitable
  device or browser capability, Kaplay initialization failure, and Kaplay
  runtime failure.

Both experiences must consume the same prediction domain/state model. Shared
code must own prediction answers/state, validation and rules, fixture ruleset
snapshot interpretation, navigation and step semantics where applicable, and the
server API/submission contract. The animated experience must not contain
independent validation or business behavior that can drift from the standard
experience.

Presentation switching and fallback must preserve the player's answers. Kaplay
initialization or runtime failure must never lose answers, block progression, or
prevent submission. Submission must never depend on an animation completing.

Player-facing controls should describe animation state, such as "Animations On"
and "Animations Off." Avoid exposing implementation labels such as "React mode"
to players. Internal labels such as `kaplay` and `standard` are acceptable when
that future milestone implements them.

CCPP-006A documents this architecture only. It does not implement Kaplay,
animation toggles, reduced-motion or capability detection, sprite loading,
lazy-loading, runtime fallback machinery, animation lifecycle, or hidden-page
pausing.

CCPP-007 implements the shared standard sequence/message architecture that a
future Kaplay experience should consume, but still does not implement Kaplay or
animation behavior.

## Test Support

`imports/server/predictions/testSupport.ts` registers
`test.predictions.reset` only when the existing isolated test helper settings
are enabled and the active MongoDB identity matches the current test
environment. Cleanup removes only entries tagged with the current
`RUGBY_ROOSTER_TEST_RUN_ID`.

Browser tests continue to use the existing isolated auth login-token helper for
verified player setup. They do not exercise the deferred full passwordless
navigation issue.

`test.fixtures.createPublished` also supports an isolated-test-only
`disabledBuiltInQuestionIds` option so prediction browser tests can create
published fixture snapshots with disabled built-in ruleset questions. This is
not a production admin configuration surface.
