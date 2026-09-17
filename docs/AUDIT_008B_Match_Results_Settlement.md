# CCPP-008B Match Results Settlement Audit

## Scope

Implemented the authoritative admin match-result and prediction-question
settlement workflow for Rugby Rooster.

Explicitly not implemented: persisted Rugby Rooster player scores,
leaderboards, rankings, winners, score jobs, public live deductions, live rugby
event capture, live match lifecycle states, Kaplay, animations, or
correction/reopen workflows.

## Scoring / Observation Domain Changes

- Reused existing `FixtureObservations`, `ObservedValue<T>`, pending,
  provisional, confirmed, if-ended-now, final, derived team score, derived match
  result, and shared observation validation.
- Extended custom observations only with `void`.
- Kept built-in numeric and categorical observations non-voidable.
- Preserved derived actual rugby score and Match Result from component
  observations.

## Custom Void Support

- Custom Number and Choice observations may be `void`.
- Void observations contain no value.
- Void custom questions score as zero deduction.
- Void custom questions are not pending and do not block final calculation.
- Scoring breakdown status remains identifiable as `void`.

## Result Persistence

- Added `match_results` collection.
- One result document per fixture, enforced by unique `{ fixtureId: 1 }` index.
- Stored result data includes fixture relation, ruleset identity, observations,
  revision, server timestamps, admin actor metadata, and confirmation metadata.
- The fixture's published `rulesetSnapshot` remains the authoritative full
  definition of required and allowed observations.

## Methods / Publications

Methods:

- `matchResults.admin.saveProvisional`
- `matchResults.admin.confirmFinal`

Publications:

- `matchResults.admin.fixtureContext`
- `matchResults.admin.summaries`

Test helper:

- `test.matchResults.reset`

No public result publication was added.

## Authorization

- Result writes require existing platform-admin authorization.
- Server derives admin identity from the Meteor invocation.
- Anonymous and ordinary player writes are rejected.
- Client collection writes are denied.
- Result publications are admin-only.

## Admin UI

- Added route `/admin/fixtures/:fixtureId/results`.
- Existing fixture admin list shows `No result`, `Provisional`, or `Final` and a
  Results action for published fixtures.
- Result page shows real team names, kickoff, result state, revision, derived
  rugby score, editable observations, custom settlement controls, and read-only
  final summary.
- Blank fields remain Pending; `0` remains observed zero.
- Custom Void is an explicit checkbox and states that the question will deduct
  no points.
- Final confirmation uses a deliberate browser confirmation and then renders
  read-only.

## Revision / Concurrency

- Result revisions are integers. `0` represents no loaded result.
- First save uses atomic `$setOnInsert` upsert and unique fixture index.
- Updates require the captured expected result revision.
- Stale saves return `result-conflict` and do not overwrite newer data.
- The result page preserves unsaved local values after conflict and offers
  explicit latest-result reload.

## Final Confirmation

Final confirmation:

- normalizes non-void values to Confirmed;
- preserves custom Void;
- requires all enabled built-ins and standard categorical observations to be
  settled;
- requires every active custom question to be Confirmed or Void;
- rejects malformed, unknown, disabled, contradictory, or pending
  observations;
- sets server-owned confirmation metadata;
- makes the result read-only.

No player predictions or scores are read or mutated.

## Tests Actually Run

Passed:

- `npm run typecheck`
- `npm run test:unit -- tests/unit/scoring-engine.test.ts tests/unit/routes.test.ts`
  - final rerun: 2 files, 40 tests passed.
- `npm run test:unit`
  - 12 files, 131 tests passed.
- `npm run test:integration -- --grep "match result administration"`
  - rerun after local loopback escalation and test fixes; 65 server tests
    passed.
- `npm run test:e2e -- tests/e2e/results.spec.ts`
  - first run failed on an ambiguous Void checkbox locator;
  - rerun passed 2 Chromium tests.
- `npm run lint`
- `npm run lint:project`
- Changed-file Prettier check with `npx prettier --check <changed files>`

Initial integration attempt:

- `npm run test:integration -- --grep "match result administration"` failed in
  the sandbox with `listen EPERM: operation not permitted 127.0.0.1:3400`.
  The same command was rerun with approved loopback escalation.

Known unrelated/pre-existing failure:

- `npm run format:check` still reports formatting issues in older files:
  `docs/AUDIT_004A_Database_Isolation_Verification.md`,
  `docs/AUDIT_004A_Login_Navigation_Fix.md`,
  `imports/server/auth/mongoConnectionIdentity.ts`,
  `imports/shared/auth/testDatabaseIdentity.ts`, `playwright.config.ts`,
  `scripts/test-environment.mjs`, and `tests/unit/test-launchers.test.ts`.
  These files were not changed for CCPP-008B.

Skipped so far:

- Full integration suite without grep.
- Full Playwright suite.
- Review ZIP packaging.

## Known Product Questions Preserved

- Extra-time inclusion/exclusion for observations remains unresolved.
- Detailed card normalization, including second-yellow dismissals and upgraded
  yellows, remains unresolved.
- Balancing fixtures with different optional/custom deduction totals remains
  unresolved.
- Future correction/reopen workflow after incorrect final confirmation remains
  unresolved.
- Future public/provisional if-ended-now presentation remains unresolved.
- Persisted player scoring and leaderboard settlement remain future work.

## Review Archive

Pending final packaging.
