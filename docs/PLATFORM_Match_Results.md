# Rugby Rooster Match Result Platform

## Collection

Match result persistence lives in the Mongo collection `match_results`, exported
from `imports/api/matchResults/collection.ts`.

Authoritative server code lives under `imports/server/matchResults/`. Shared
method names, publication names, types, lifecycle labels, and normalization
helpers live under `imports/shared/matchResults/`.

Client collection writes are denied. All writes go through platform-admin Meteor
methods.

## Schema

There is at most one result document per fixture.

Stored result documents include:

- `_id`
- `fixtureId`
- `ruleset`: ruleset identity from the fixture's published snapshot
- `observations`: shared `FixtureObservations`
- `revision`
- `createdAt`
- `updatedAt`
- `createdByAdminId`
- `updatedByAdminId`
- `confirmedAt`
- `confirmedByAdminId`
- `rugbyRoosterTest.ownerRunId` in isolated tests

The result does not duplicate fixture question configuration. The full
authoritative ruleset remains on `fixtures.rulesetSnapshot`.

## Indexes

Startup creates:

- unique `{ fixtureId: 1 }`
- `{ "rugbyRoosterTest.ownerRunId": 1 }`

First creation uses a raw Mongo `updateOne` with `$setOnInsert` and `upsert:
true`. Concurrent first saves produce one document; the competing request
receives `result-conflict`.

## Methods

Admin methods:

- `matchResults.admin.saveProvisional`
- `matchResults.admin.confirmFinal`

Both methods require the existing platform-admin authorization path. The server
derives admin identity from the Meteor invocation and owns timestamps, revision
increments, and confirmation metadata.

Accepted method input fields:

- `fixtureId`
- `expectedRevision`
- `observations`

Unknown top-level fields are rejected. Client attempts to inject actor IDs,
timestamps, result revisions, confirmation metadata, rulesets, or fixture state
are rejected.

`expectedRevision` is an integer conflict token. `0` means no result document
was loaded. Stored results start at revision `1`.

## Fixture Eligibility

Writes require:

- fixture exists;
- fixture is `published`;
- fixture is not cancelled;
- fixture has a valid stored `rulesetSnapshot`.

Draft fixtures reject writes. Cancelled fixtures reject writes and preserve
existing result documents as read-only history. Confirmed results reject all
further provisional saves and final confirmation attempts.

## Observation Normalization

Normalization is server-authoritative and uses the fixture's frozen
`rulesetSnapshot`.

On provisional save:

- active missing fields become Pending;
- blank UI fields should submit Pending;
- provided non-pending built-in values become Provisional;
- provided non-pending custom values become Provisional;
- explicit custom Void remains Void;
- match status is Provisional;
- disabled or unknown observations are rejected.

On final confirmation:

- provided non-pending non-void values become Confirmed;
- custom Void remains Void;
- Pending observations remain Pending and then fail final completeness;
- match status is Confirmed only if validation passes.

The shared scoring observation validator remains the value validation boundary
for safe non-negative integers, categorical values, conversions <= tries, First
Try consistency, valid custom option IDs, and unknown custom question rejection.

## Final Confirmation

`matchResults.admin.confirmFinal` loads the fixture snapshot, normalizes the
submitted observations in final mode, validates the shared observation contract,
and then requires:

- all required team component/card observations Confirmed;
- enabled standard categorical observations Confirmed;
- every active custom observation Confirmed or Void;
- no unresolved Pending observation;
- no invalid or injected observation.

The method updates only a provisional result with the captured `revision`.
Success increments the result revision and sets `confirmedAt` and
`confirmedByAdminId`.

No player predictions are read or mutated during confirmation.

## Publications

Admin-only publications:

- `matchResults.admin.fixtureContext`
- `matchResults.admin.summaries`

`matchResults.admin.fixtureContext` publishes one fixture with admin result
context fields plus the matching result document. It is used by
`/admin/fixtures/:fixtureId/results`.

`matchResults.admin.summaries` accepts bounded fixture IDs and publishes result
summary rows for the admin fixture list status indicator.

There is no public result publication in CCPP-008B. Provisional observations,
custom official answers, pending settlement, and admin metadata remain
admin-private.

## Routes And UI

Route:

- `/admin/fixtures/:fixtureId/results`

Source paths:

- `imports/ui/pages/AdminFixtureResultsPage.tsx`
- `imports/ui/fixtures/AdminFixtureManager.tsx`
- `imports/ui/fixtures/fixtureUi.ts`
- `imports/shared/routes.ts`

The admin result page captures the loaded result revision in local edit-session
state. Reactive publication updates do not replace unsaved local values or
silently advance the captured revision. On `result-conflict`, the page preserves
local values and offers `Reload latest result`, which intentionally replaces
local values and captures the latest revision.

The existing fixture admin list shows only `No result`, `Provisional`, or
`Final` and links published fixtures to the Results page.

## Scoring Engine Preparation

CCPP-008B extends custom observation support so custom Number and Choice
observations may be `void`. Void custom observations:

- contain no value;
- validate only for custom questions;
- produce zero deduction;
- do not appear as pending;
- do not block final calculation;
- remain visible as `void` in scoring breakdown status.

Built-in numeric and categorical validators reject `void`.

## Test Support

Isolated test helper:

- `test.matchResults.reset`

It is registered only when existing private isolated-test settings are enabled
and the active MongoDB identity matches the expected test environment.

## Future Integration

Future scoring and leaderboard milestones can consume:

- fixture published ruleset snapshot;
- stored result observations;
- custom Void status;
- if-ended-now/final scoring modes in the shared engine.

They must still design persisted player scores, leaderboard settlement,
correction/reopen workflows, and any public provisional presentation.
