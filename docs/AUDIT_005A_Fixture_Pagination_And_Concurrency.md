# AUDIT 005A - Fixture Pagination And Concurrency

## Summary

CCPP-005A fixes two focused defects found after CCPP-005 fixture management:

- Public fixture browsing stopped at 50 records and admin browsing stopped at
  100 records because "Load more" increased one capped subscription limit.
- Fixture conflict protection compared `expectedUpdatedAt` while successful
  writes assigned `new Date()`, allowing same-millisecond operations to share
  the same conflict token.

Rugby Rooster remains separate from Rugby Tracker / Rucks and Mauls. No
authentication/navigation, email configuration, HMR, database isolation, PWA,
prediction, result, or match-event work was reopened.

## Files Changed

- `imports/shared/fixtures/types.ts` - added fixture revisions and list cursor
  types; replaced mutation `expectedUpdatedAt` inputs with `expectedRevision`.
- `imports/shared/fixtures/validation.ts` - validates integer expected
  revisions, list cursors, public/admin page sizes, boundaries, modes, and
  allowed keys.
- `imports/server/fixtures/server.ts` - backfills missing revisions before
  methods/publications register, initializes new fixture revisions, uses atomic
  revision increments for mutations, and publishes cursor-bounded list pages.
- `imports/server/fixtures/testSupport.ts` - stamps isolated test-created
  published fixtures with the initial revision.
- `imports/ui/pages/GamesPage.tsx` - uses public Next/Previous cursor pages,
  aligned Minimongo selectors, and first-page resets when mode or time boundary
  refreshes.
- `imports/ui/fixtures/AdminFixtureManager.tsx` - uses admin Next/Previous cursor
  pages and sends `expectedRevision` for edit, publish, and cancel.
- `imports/server/fixtures/fixtures.app-test.ts` - adds regression coverage for
  pagination, revisions, stale writes, no-op state calls, fixed-clock conflicts,
  and backfill.
- `tests/unit/fixtures.test.ts` - adds framework-independent validation coverage
  for cursor and revision contracts.
- `tests/e2e/fixtures.spec.ts` - adds one focused browser test for public and
  admin pagination controls.
- `docs/CORE_Fixtures.md`, `docs/PLATFORM_Fixtures.md`,
  `docs/PLATFORM_Testing.md`, `docs/MAP_System.md`, and
  `docs/CORE_Build_Plan.md` - document the corrected behavior and test surface.

## Pagination Contract

Public and admin list subscriptions now accept a bounded page `limit` and an
optional cursor object:

- `cursor.scheduledKickoffAt`: UTC kickoff instant from the last visible row.
- `cursor.fixtureId`: `_id` from the last visible row.

Public upcoming pages are sorted by `{ scheduledKickoffAt: 1, _id: 1 }`. Public
past pages and admin pages are sorted by `{ scheduledKickoffAt: -1, _id: 1 }`.
Cursor predicates advance after the cursor in the matching sort direction, so
identical kickoff times cross page boundaries without duplicates or omissions in
a stable dataset.

The server validates all pagination inputs. Public page sizes remain capped by
`MAX_PUBLIC_FIXTURE_LIMIT`; admin page sizes remain capped by
`MAX_ADMIN_FIXTURE_LIMIT`. Publications query one extra row beyond the requested
page size, still bounded, so clients can determine whether a Next page exists
without a count query or an unbounded query.

Public publications still publish only `visibility: "published"` fixtures with
the public field projection. Drafts, actor IDs, stored revisions, test
ownership, cancellation actor metadata, timestamps other than kickoff, and
ruleset snapshots remain excluded from public responses. The admin publication
still requires server-side platform-admin authorization.

## Refresh Behavior

The public `/games` list keeps the existing 30-second time-boundary refresh, but
refreshing the boundary now resets pagination to the first page for the selected
mode. Switching between Upcoming and Past also resets to the first page. This
keeps the upcoming/past split coherent instead of paging across a moving current
time boundary.

Client-side displayed Minimongo queries include the same mode, boundary, cursor,
sort, and bounded `pageSize + 1` limit as the active subscription, so unrelated
fixture subscription data cannot expand the visible page.

## Revision Behavior

New fixtures are initialized at revision `1`. Edit, publish, and cancel require
the caller's expected integer revision. Successful state-changing writes match
the expected revision and increment it atomically with `$inc`; `updatedAt`
remains an audit timestamp, not the concurrency token.

Client attempts to assign the stored `revision` directly are rejected as unknown
fields. Publishing an already published fixture and cancelling an already
cancelled fixture retain the CCPP-005 no-op behavior and do not increment the
revision.

Before fixture methods and publications are registered, the server runs a small
conditional backfill that sets revision `1` only on fixtures where `revision`
does not exist. The backfill is idempotent and preserves existing fixture
details, timestamps, actor metadata, visibility, cancellation metadata, test
ownership, and ruleset snapshots.

## Regression Tests Added

- Public upcoming records beyond the former 50-record cap are reachable.
- Admin records beyond the former 100-record cap are reachable.
- Multiple fixtures with identical kickoff times cross page boundaries without
  omissions or duplicates.
- Public upcoming and past sort directions are covered.
- Drafts and private fields, including revision, remain excluded from public
  publication results.
- Invalid cursor and page-size contracts are covered in shared validation tests.
- Same-revision operations cannot both mutate a fixture even under a fixed
  server clock.
- Stale edit, publish, and cancel requests cannot overwrite newer state.
- Successful state changes advance revisions.
- Repeated publish/cancel calls retain no-op behavior.
- Existing revisionless fixtures are backfilled safely, and repeated backfill is
  harmless.
- Browser pagination controls are covered for public and admin lists without
  duplicating the full server matrix.

## Verification

Commands run:

- `meteor npm run typecheck` - passed.
- `meteor npm run lint` - passed.
- `meteor npm run lint:project` - passed.
- `meteor npm run format:check` - blocked by pre-existing formatting issues in
  `docs/AUDIT_004A_Database_Isolation_Verification.md`,
  `docs/AUDIT_004A_Login_Navigation_Fix.md`,
  `imports/server/auth/mongoConnectionIdentity.ts`,
  `imports/shared/auth/testDatabaseIdentity.ts`, `playwright.config.ts`,
  `scripts/test-environment.mjs`, and `tests/unit/test-launchers.test.ts`.
- `meteor npm exec prettier -- --check <changed CCPP-005A files>` - passed.
- `meteor npm run test:unit -- tests/unit/fixtures.test.ts` - passed `1` file
  and `7` tests.
- `meteor npm run test:unit` - passed `9` files and `87` tests.
- `meteor npm run test:integration` - passed `39` server tests.
- `meteor npm run test:e2e -- fixtures.spec.ts` - passed `3` Chromium tests.

The npm warning `Unknown env config "nodedir"` appeared during Meteor npm
commands and did not fail the checks. Meteor also reported that `3.5.2` is
available while this project remains pinned to `3.5.1`.

## Remaining Limitations

- Pagination is cursor-based over a stable sort, not snapshot-isolated against
  live fixture edits between page requests. If fixtures are inserted or moved
  while a user pages, the next page reflects the current matching dataset.
- Public boundary refresh intentionally resets the current public page every 30
  seconds.
- Prediction submission, results, match events, live/completed state changes,
  fixture deletion, unpublishing, restoration, and later game features remain
  deferred.

EOMD archive created:
`rugby-rooster-ccpp005a-fixture-pagination-concurrency-eomd-20260915.zip`.
