# AUDIT 006 - Prediction Submission

## Summary

CCPP-006 implements the first complete Rugby Rooster prediction entry flow. A
verified signed-in player can open a published fixture, enter the default
ruleset predictions, submit before kickoff, revise before kickoff, and revisit
the saved entry. Locked or cancelled fixtures show saved entries read-only.

Rugby Rooster remains separate from Rugby Tracker / Rucks and Mauls. This task
did not add results, leaderboards, leagues, custom-question administration, AI,
Kaplay animation, service-worker caching, or broader authentication redesign.

## Implementation Evidence

Implemented:

- `predictions` Mongo collection with denied direct client writes.
- Server method `predictions.submit`.
- Unique `{ userId, fixtureId }` index.
- Atomic create using `$setOnInsert`.
- Revision-checked atomic update with complete prediction payload replacement.
- Narrow current-user entry publication.
- Verified-user fixture context publication for stored ruleset snapshots.
- `/games/:fixtureId/predict` route and safe sign-in return path support.
- Fixture detail and list links into prediction entry.
- Accessible React form grouped by scoring totals, match calls, optional custom
  questions, and review.
- Derived predicted team scores using shared scoring helpers.
- Read-only saved-entry display after kickoff locking or cancellation.
- Conflict handling that preserves unsaved values and requires explicit reload.
- Account-switch/sign-out form reset behavior.
- Test-only prediction cleanup helper under the existing isolated test gate.

Not implemented:

- Match result entry.
- Live or final scoring persistence.
- Leaderboards, leagues, prizes, sponsorships, custom-question admin UI, AI,
  Kaplay, or service-worker caching.
- Permanent lock policy independent of the fixture's current scheduled kickoff.

## Server Contract

Only published, non-cancelled fixtures with a valid stored `rulesetSnapshot`
accept prediction writes. The server validates submissions against that stored
snapshot, never against a generated default.

The server derives ownership from the authenticated invocation. The client cannot
assign `userId`, timestamps, revision, test ownership, or scoring result fields.

Writes are accepted only while server time is strictly before scheduled kickoff.
At kickoff equality and afterward, writes are rejected. For CCPP-006,
rescheduling into the future can reopen editing because lock eligibility follows
the fixture's current scheduled kickoff.

Prediction entries store the validated `prediction`, integer `revision`,
server-owned timestamps, and ruleset identity. They do not store fixture scores
before match results exist.

## Privacy Boundaries

`predictions.currentUserEntry` accepts only a fixture ID and derives ownership
from `this.userId`. Anonymous users receive no prediction data. Other players
cannot read or update an owner's entry through the publication or submit method.

Prediction answers are not included in public fixture publications. No public or
admin prediction-list publication was added.

## Files Changed

- `imports/api/predictions/collection.ts` - prediction collection.
- `imports/shared/predictions/` - method/publication names, types, submission
  validation, and storage normalization.
- `imports/server/predictions/` - submit method, publications, indexes, and
  isolated test reset helper.
- `server/main.ts` - prediction server module import.
- `imports/ui/pages/PredictionEntryPage.tsx` - prediction entry/review/read-only
  route.
- `imports/ui/pages/GameDetailPage.tsx`, `imports/ui/pages/GamesPage.tsx`, and
  `imports/ui/fixtures/fixtureUi.ts` - prediction links.
- `imports/shared/routes.ts` and `imports/shared/auth/redirects.ts` -
  prediction route and safe return path.
- `imports/server/app-tests.ts` - integration entry-point import.
- `imports/server/predictions/predictions.app-test.ts` - server integration
  coverage.
- `tests/e2e/predictions.spec.ts` - focused browser coverage.
- `tests/unit/predictions.test.ts`, `tests/unit/routes.test.ts`, and
  `tests/unit/auth-helpers.test.ts` - focused unit coverage.
- `docs/CORE_Predictions.md`, `docs/PLATFORM_Predictions.md`, and this audit.
- Existing system documents updated for route, architecture, testing, and
  roadmap references.

## Verification

Commands run so far:

- `meteor npm run test:unit -- --run tests/unit/routes.test.ts tests/unit/auth-helpers.test.ts tests/unit/predictions.test.ts` - passed 3 files / 17 tests.
- `meteor npm run test:integration` - initially failed at compile with
  TypeScript issues in new prediction code. The readonly object-construction,
  raw Mongo upsert typing, and test helper return type issues were corrected.
- `meteor npm run test:integration` - passed 49 server tests.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts` - first run had 4
  passed and 1 failed because a global `window.Meteor` declaration mismatch
  caused Rspack rebuilds, remounting the page during the conflict scenario.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts` - second run had 4
  passed and 1 failed because initial reactive form setup could overwrite
  already-entered browser values.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts` - passed 5
  Chromium tests after fixing the declaration and form-session initialization
  guard.

The npm warning `Unknown env config "nodedir"` appeared during Meteor npm
commands and did not fail the checks. Browser and integration runs also printed
Node warnings about `NO_COLOR` being ignored because `FORCE_COLOR` was set;
those warnings did not fail the suites.

Final verification commands:

- `meteor npm run typecheck` - passed.
- `meteor npm run lint` - initially failed on the new prediction page with
  React purity errors for `Date.now`, `Math.random`, and synchronous state
  initialization effects. The page was refactored into a keyed form-session
  component using `useId`.
- `meteor npm run lint` - passed after the refactor.
- `meteor npm run lint:project` - passed.
- `meteor npm run test:unit` - passed 10 files / 92 tests.
- `meteor npm run test:integration` - passed 49 server tests.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts` - after the
  refactor, first rerun had 3 passed and 2 failed. The submit/revisit test
  navigated before the current-user entry publication caught up, and one
  test-token login hit the known local transient navigation interruption. The
  focused browser helper now waits for revise mode before revisit and retries
  test-token login after transient local navigation errors.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts` - passed 5
  Chromium tests.
- `meteor npm run typecheck` - passed after the final browser-test adjustment.
- `meteor npm run lint` - passed after the final browser-test adjustment.
- `meteor npm run format:check` - blocked by pre-existing formatting issues in
  `docs/AUDIT_004A_Database_Isolation_Verification.md`,
  `docs/AUDIT_004A_Login_Navigation_Fix.md`,
  `imports/server/auth/mongoConnectionIdentity.ts`,
  `imports/shared/auth/testDatabaseIdentity.ts`, `playwright.config.ts`,
  `scripts/test-environment.mjs`, and `tests/unit/test-launchers.test.ts`.
- `meteor npm exec prettier -- --check <changed CCPP-006 files>` - passed.

## Remaining Limitations

- CCPP-006 does not implement permanent lock-after-first-kickoff policy.
- Ruleset snapshots are protected by fixture write paths, not by database-level
  immutability.
- There is no admin prediction inspection UI.
- There are no results, live observations, final fixture scores, leaderboards,
  or league standings.
- Future Kaplay animation must remain optional and independent from prediction
  state.

## EOMD

EOMD archive path will be recorded after packaging.
