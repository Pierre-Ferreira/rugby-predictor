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
- `createdAt`
- `updatedAt`
- `createdByAdminId`
- `updatedByAdminId`
- `publishedAt`
- `publishedByAdminId`
- `cancelledAt`
- `cancelledByAdminId`
- `rulesetSnapshot`
- `rugbyRoosterTest.ownerRunId` when created inside isolated tests

Team and competition entities are not normalized into separate collections in
this milestone.

## Methods

Admin fixture methods:

- `fixtures.admin.createDraft`
- `fixtures.admin.editDetails`
- `fixtures.admin.publish`
- `fixtures.admin.cancel`

Every method calls the existing server-owned platform-admin authorization path.
The UI auth state is only a hint.

Inputs are allowlisted and validated:

- Fixture IDs must be bounded stable strings.
- Required text must be nonblank and bounded.
- Team names must be distinct after normalization.
- Kickoff must parse to a valid UTC instant.
- State mutations require the caller's expected `updatedAt`.
- Unknown fields are rejected.

Ordinary edit payloads cannot set actor IDs, timestamps, visibility,
cancellation fields, test ownership, or ruleset snapshots.

## Conditional Writes

Edit, publish, and cancel use conditional writes against the fixture ID,
expected `updatedAt`, and protected state. If a concurrent operation changes the
fixture first, the method reports `fixture-conflict` instead of overwriting the
protected state.

Published fixtures can be edited while active. Cancelled fixtures reject edits.

## Publications

Fixture publications:

- `fixtures.admin.list` requires platform-admin authorization and publishes a
  bounded admin fixture list.
- `fixtures.public.list` publishes only `published` fixtures using explicit
  public fields.
- `fixtures.public.detail` publishes one `published` fixture by ID using the
  same explicit public fields.

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
metadata, and `rulesetSnapshot` are not public.

## Indexes

The fixture server creates indexes for the implemented queries:

- `{ visibility: 1, scheduledKickoffAt: 1, _id: 1 }`
- `{ scheduledKickoffAt: -1, _id: 1, visibility: 1 }`
- `{ updatedAt: -1, _id: 1 }`
- `{ "rugbyRoosterTest.ownerRunId": 1 }`

## Ruleset Snapshot

Publishing attaches a validated independent snapshot of `defaultRuleset` using
the existing scoring engine snapshot utility. Drafts cannot publish if the
required default ruleset is invalid.

The snapshot timing is first successful publication. Repeated publication of an
already published fixture does not regenerate the snapshot. Ordinary edits do
not replace it. Later in-memory or future default ruleset changes do not alter
stored fixture snapshots.

The protection is provided by server write paths and snapshot cloning. This is
not database-level immutability.

## Query Limits

Public browsing uses bounded list subscriptions. The UI requests one extra row
above the visible count so it can show a Load more control when additional rows
are available. Public list requests are capped by
`MAX_PUBLIC_FIXTURE_LIMIT`.

Admin list requests are also bounded and capped by `MAX_ADMIN_FIXTURE_LIMIT`.

## Test Support

Fixture test helpers are registered only when the existing private isolated test
helper settings are enabled and the active MongoDB identity matches the current
test environment. Fixture cleanup removes only data tagged with the current
`RUGBY_ROOSTER_TEST_RUN_ID`.
