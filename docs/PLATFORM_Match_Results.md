# Rugby Rooster Match Result Platform

## Collection

Match result persistence lives in the Mongo collection `match_results`, exported
from `imports/api/matchResults/collection.ts`.

Authoritative server code lives under `imports/server/matchResults/`. Shared
method names, publication names, types, lifecycle labels, and normalization
helpers live under `imports/shared/matchResults/`.

`imports/shared/matchResults/liveCounters.ts` owns the central live-counter
definition and initialization helper for enabled per-team tries, conversions,
successful penalty kicks, drop goals, yellow cards, and red cards.

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

- `matchResults.admin.startResultTracking`
- `matchResults.admin.saveProvisional`
- `matchResults.admin.confirmFinal`

All admin methods require the existing platform-admin authorization path. The server
derives admin identity from the Meteor invocation and owns timestamps, revision
increments, and confirmation metadata.

Accepted method input fields:

- `matchResults.admin.startResultTracking`: `fixtureId`
- `matchResults.admin.saveProvisional` and
  `matchResults.admin.confirmFinal`: `fixtureId`, `expectedRevision`,
  `observations`

Unknown top-level fields are rejected. Client attempts to inject actor IDs,
timestamps, result revisions, confirmation metadata, rulesets, or fixture state
are rejected.

`expectedRevision` is an integer conflict token. `0` means no result document
was loaded. Stored results start at revision `1`.

`matchResults.admin.startResultTracking` creates the first result document with
`observations.matchStatus: 'provisional'` and initialized zero observations for
enabled live built-in counters. It does not accept a revision or observation
payload from the client. If a result already exists, the existing first-create
conflict path rejects the repeat start without overwriting values.

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

Before lifecycle normalization, the method validates the raw observation
envelope:

- only enabled top-level observation keys are accepted;
- team, standard categorical, custom Number, and custom Choice observation
  objects may contain only `status` and `value`;
- incoming non-void observation statuses must be `pending`, `provisional`, or
  `confirmed`;
- built-in observations reject `void`;
- custom observations may use `void` only for known active custom questions and
  only without `value`;
- unknown nested fields are rejected instead of being stripped.

On provisional save:

- active missing fields become Pending;
- blank UI fields should submit Pending;
- provided non-pending built-in values become Provisional;
- provided non-pending custom values become Provisional;
- explicit custom Void remains Void;
- match status is Provisional;
- disabled or unknown observations are rejected.

For an existing provisional result that already has resolved live counter
values, blank/Pending submissions for those same live counters preserve the
current numeric values. This prevents a zero-initialized result from
accidentally reverting counters to Pending while leaving legacy blank
provisional records blank.

On start result tracking:

- enabled live built-in counter fields become Provisional `0` for both teams:
  tries, conversions, successful penalty kicks, drop goals, yellow cards, and
  red cards;
- First Try, Highest-Scoring Half, Half-Time Leader, custom Number, and custom
  Choice observations become Pending when enabled;
- no final/outcome question is guessed or settled.

On final confirmation:

- provided non-pending non-void values become Confirmed;
- custom Void remains Void;
- Pending observations remain Pending and then fail final completeness;
- match status is Confirmed only if validation passes.

The shared scoring observation validator remains the value validation boundary
for safe non-negative integers, categorical values, conversions <= tries, First
Try consistency, valid custom option IDs, and unknown custom question rejection.
The raw boundary does not persist client-requested lifecycle statuses verbatim;
the save method still persists Provisional and the confirm method still persists
Confirmed for legitimate non-pending, non-void observations.

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

When no result document exists for an editable published fixture, the page shows
`Result tracking hasn't started.` and a `Start result tracking` action instead
of editable blank counter fields, so the UI does not show false zeros before
the admin creates the canonical provisional result. Starting creates and
persists that provisional result immediately; the enabled live counters display
`0`, the derived rugby score displays `0-0`, the derived current Match Result
displays Draw, and First Try, Highest-Scoring Half, Half-Time Leader, custom
Number, and custom Choice settlement controls remain Pending. Existing
provisional results are edited through the normal revision-guarded form and are
never reinitialized by the start action.

Later provisional saves keep initialized counter values numeric. A blank edit
for an already-resolved live counter does not silently downgrade that counter
back to Pending, and the existing revision/concurrency protection still guards
the save.

The existing fixture admin list shows only `No result`, `Provisional`, or
`Final` and links published fixtures to the Results page.

Read-only result summaries use the stored lifecycle state for their heading:
confirmed results render `Confirmed result summary`, while a provisional result
that remains visible after fixture cancellation renders `Provisional result
summary`.

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

CCPP-011A consumes match results for owner-only player fixture-score projection.
The score method fetches `match_results` server-side and returns only the
derived current user's score projection. It does not add a public result
publication, expose admin metadata to players, or mutate result documents.
With CCPP-011D, an initialized zero provisional result is enough for CCPP-011A
to score resolved built-in numeric/card observations and derived Match Result
as Draw; no result document still returns `awaiting_result`.

CCPP-011B consumes:

- fixture published ruleset snapshot;
- stored result observations;
- custom Void status;
- if-ended-now/final scoring modes in the shared engine.

The fixture leaderboard remains derived and recalculates from the current result
revision on demand. Broader league settlement, batching/caching, and public
score breakdowns remain outside CCPP-011B. CCPP-011C adds the current player's
own score-breakdown route by reusing the owner-only score projection; it still
does not add public result publication or score persistence. CCPP-011D changes
only canonical result initialization, so 011B leaderboards and 011C My Score
breakdowns recalculate from zero observations without persisting scores.
