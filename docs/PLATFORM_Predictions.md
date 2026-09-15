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
not replace unsaved values or the captured revision. The `Reload saved entry`
button is the explicit path that replaces local values and captures the latest
revision.

The page refreshes time-sensitive UI every 15 seconds so an open page reflects
kickoff passing. Server checks remain authoritative.

## Animation Boundary

The CCPP-006 prediction flow has no Kaplay dependency. Prediction state is held
in React form/session state and persisted only by Meteor methods. Navigation,
input, validation, conflict handling, and submission cannot depend on an
animation module loading or finishing.

Future Kaplay work must keep this boundary:

- Lazy-load animation code outside the data-entry path.
- Provide a user-visible animations toggle.
- Respect reduced-motion preferences.
- Fail gracefully when animations are disabled, unavailable, or delayed.
- Never store prediction answers in animation state.

## Test Support

`imports/server/predictions/testSupport.ts` registers
`test.predictions.reset` only when the existing isolated test helper settings
are enabled and the active MongoDB identity matches the current test
environment. Cleanup removes only entries tagged with the current
`RUGBY_ROOSTER_TEST_RUN_ID`.

Browser tests continue to use the existing isolated auth login-token helper for
verified player setup. They do not exercise the deferred full passwordless
navigation issue.
