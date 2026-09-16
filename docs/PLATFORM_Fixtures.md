# Rugby Rooster Fixture Platform

## Collection

Fixture persistence lives in the Mongo collection `fixtures`, exported from
`imports/api/fixtures/collection.ts`.

Authoritative server code lives under `imports/server/fixtures/`. Shared names,
types, timezone conversion, and input validation live under
`imports/shared/fixtures/`.

Client collection writes are denied. Authoritative changes go through Meteor
methods.

## Schema

Stored fixture documents include:

- `_id`
- `team1DisplayName`
- `team2DisplayName`
- `competitionDisplayName`
- `scheduledKickoffAt`
- `venueDisplayName`
- `visibility`
- `isCancelled`
- `revision`
- `createdAt`
- `updatedAt`
- `createdByAdminId`
- `updatedByAdminId`
- `publishedAt`
- `publishedByAdminId`
- `cancelledAt`
- `cancelledByAdminId`
- `rulesetSnapshot`
- `predictionQuestionConfig`
- `rugbyRoosterTest.ownerRunId` when created inside isolated tests

Team and competition entities are not normalized into separate collections in
this milestone.

## Methods

Admin fixture methods:

- `fixtures.admin.createDraft`
- `fixtures.admin.editDetails`
- `fixtures.admin.publish`
- `fixtures.admin.cancel`
- `fixtures.admin.saveQuestionConfig`

Every method calls the existing server-owned platform-admin authorization path.
The UI auth state is only a hint.

Inputs are allowlisted and validated:

- Fixture IDs must be bounded stable strings.
- Required text must be nonblank and bounded.
- Team names must be distinct after normalization.
- Kickoff must parse to a valid UTC instant.
- Edit, publish, and cancel mutations require the caller's expected integer
  `revision`.
- Unknown fields are rejected.

Ordinary edit payloads cannot set actor IDs, timestamps, visibility,
cancellation fields, test ownership, stored revisions, or ruleset snapshots.

Question configuration payloads cannot set fixture state, actor IDs,
timestamps, test ownership, or ruleset snapshots. They accept only `fixtureId`,
`expectedRevision`, and the full prediction question configuration.

## Conditional Writes

New fixtures start at revision `1`. Edit, publish, and cancel use conditional
writes against the fixture ID, expected `revision`, and protected state. A
successful state change increments the revision atomically and updates
`updatedAt` as an audit timestamp. If a concurrent operation changes the fixture
first, the method reports `fixture-conflict` instead of overwriting the
protected state.

Published fixtures can be edited while active. Cancelled fixtures reject edits.
Publishing an already published fixture and cancelling an already cancelled
fixture remain predictable no-op calls; they return their existing no-op status
without mutating the fixture or incrementing the revision.

At server startup, before fixture methods and publications are registered, a
conditional backfill sets revision `1` on fixtures where `revision` does not
exist. The backfill is idempotent and does not change timestamps, actor IDs,
ruleset snapshots, fixture details, visibility, cancellation metadata, or test
ownership.

## Admin Edit Sessions

The admin fixture form keeps edit identity separate from the reactive visible
list. Clicking Edit captures an explicit session containing the fixture ID and
the expected revision from that moment. While that session is active, reactive
updates can change the list row but do not replace the captured revision or
overwrite unsaved form values.

Saving with an active edit session always calls `fixtures.admin.editDetails`
with the captured fixture ID and revision. Saving without an edit session creates
a draft. A missing visible row must never make an active edit fall through to
draft creation.

On `fixture-conflict`, the form preserves the user's unsaved values and original
captured revision. The admin can cancel the edit or explicitly `Reload and
replace form`, which discards unsaved values and captures the latest revision
from the currently visible fixture row. If the edited fixture has moved outside
the visible page, reload is unavailable until the row is visible again, but Save
still targets the captured fixture ID/revision and may receive the normal server
conflict/error.

Admin Next/Previous pagination clears the edit session and form values together.

The prediction question configuration editor follows the same explicit session
principle. Opening the editor captures a fixture revision and a local copy of
the question configuration. Reactive list changes do not replace unsaved
question values or advance the captured revision. A stale save returns
`fixture-conflict`; `Reload` intentionally replaces local question values with
the latest visible fixture configuration and captures the latest revision.

## Publications

Fixture publications:

- `fixtures.admin.list` requires platform-admin authorization and publishes a
  bounded admin fixture page.
- `fixtures.public.list` publishes only `published` fixtures using explicit
  public fields and a bounded page.
- `fixtures.public.detail` publishes one `published` fixture by ID using the
  same explicit public fields.

List publication inputs accept:

- `limit`: integer page size. Public page sizes are capped by
  `MAX_PUBLIC_FIXTURE_LIMIT`; admin page sizes are capped by
  `MAX_ADMIN_FIXTURE_LIMIT`.
- `cursor`: optional object with `scheduledKickoffAt` and `fixtureId` from the
  last visible row of the current page.
- `mode`: public lists only, either `upcoming` or `past`.
- `boundary`: public lists only, the UTC instant that separates upcoming from
  past fixtures.

The server validates all list inputs. Malformed cursors, unsupported fields, and
out-of-range page sizes are rejected before a query is returned.

Cursor ordering:

- Public upcoming pages sort by `{ scheduledKickoffAt: 1, _id: 1 }` and advance
  to rows after the cursor in that order.
- Public past pages sort by `{ scheduledKickoffAt: -1, _id: 1 }` and advance to
  rows after the cursor in that order.
- Admin pages sort by `{ scheduledKickoffAt: -1, _id: 1 }` and advance to rows
  after the cursor in that order.

Each list publication queries one extra row beyond the requested page size.
Clients display only the requested page size and use the extra row to decide
whether a Next page exists. There is no total count query and no unbounded list
query.

Draft fixtures are excluded from anonymous and ordinary-user public list/detail
publications, including guessed IDs.

Public fields:

- `team1DisplayName`
- `team2DisplayName`
- `competitionDisplayName`
- `scheduledKickoffAt`
- `venueDisplayName`
- `visibility`
- `isCancelled`

Actor IDs, timestamps other than kickoff, test ownership, cancellation actor
metadata, stored revisions, `predictionQuestionConfig`, and `rulesetSnapshot`
are not public.

CCPP-006 keeps `rulesetSnapshot` out of public fixture publications. The
signed-in prediction route uses `predictions.fixtureContext` to publish one
published fixture with the stored ruleset snapshot to a verified player so the
prediction form can render the fixture's actual questions.

## Indexes

The fixture server creates indexes for the implemented queries:

- `{ visibility: 1, scheduledKickoffAt: 1, _id: 1 }`
- `{ scheduledKickoffAt: -1, _id: 1, visibility: 1 }`
- `{ updatedAt: -1, _id: 1 }`
- `{ "rugbyRoosterTest.ownerRunId": 1 }`

## Ruleset Snapshot

Publishing attaches a validated independent ruleset snapshot using the existing
scoring engine snapshot utility. For configured fixtures, the snapshot starts
from `defaultRuleset`, applies configured optional standard enabled states and
incorrect-answer deductions, and appends valid custom Number/Choice definitions
from `predictionQuestionConfig`. Drafts cannot publish if the required ruleset
or custom question configuration is invalid.

CCPP-008A removed the temporary custom-question publication gate. A draft with
valid custom questions can publish because the Standard prediction sequence can
now answer those custom questions.

The snapshot timing is first successful publication. Repeated publication of an
already published fixture does not regenerate the snapshot. Ordinary edits do
not replace it. Later in-memory or future default ruleset changes do not alter
stored fixture snapshots. For custom questions, prompt, banter/context,
counting definition, answer type, min/max, option IDs/labels, deductions, and
order are frozen in that snapshot.

The protection is provided by server write paths and snapshot cloning. This is
not database-level immutability.

Prediction submission validates against this stored snapshot. Ordinary fixture
edits do not replace it.

For CCPP-006, prediction lock eligibility follows the fixture's current
`scheduledKickoffAt`. Correcting a kickoff from the past into the future can
reopen prediction editing; a separate permanent lock policy is deferred.

## Query Limits

Public browsing uses bounded page subscriptions. The public UI requests
`DEFAULT_PUBLIC_FIXTURE_LIMIT` visible rows at a time and moves with
Next/Previous page controls. It passes the current mode, a UTC browsing
boundary, and the current page cursor to both the subscription and the displayed
Minimongo query so unrelated subscription rows do not expand the visible page.
Every 30 seconds the public browsing boundary is refreshed and pagination resets
to the first page for the selected mode.

Admin browsing uses bounded page subscriptions with
`DEFAULT_ADMIN_FIXTURE_LIMIT` visible rows at a time and the same cursor shape.
Admin pagination does not use a time boundary. Admin list requests still require
server-side platform-admin authorization.

## Test Support

Fixture test helpers are registered only when the existing private isolated test
helper settings are enabled and the active MongoDB identity matches the current
test environment. Fixture cleanup removes only data tagged with the current
`RUGBY_ROOSTER_TEST_RUN_ID`.
