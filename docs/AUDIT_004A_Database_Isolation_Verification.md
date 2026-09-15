# AUDIT 004A Database Isolation Verification

## Scope

This CCPP-004A follow-up strengthened the isolated auth-test-helper database
check. It did not change authentication navigation, throttles, scoring, Rspack,
HMR, hot-code-push, `Meteor.isTest`, `RSPACK_NATIVE`, product features,
deployment, commits, pushes, emails, Playwright, or browser tests.

Rugby Rooster remains separate from Rugby Tracker / Rucks and Mauls.

## Original Gap

The prior isolation guard checked the active Meteor database name but did not
independently verify the MongoDB host and port actually used by Meteor. That
left a possible mismatch where helpers could see the expected database name on
an unexpected endpoint.

## Files Changed

- `imports/shared/auth/testDatabaseIdentity.ts`
  - Added framework-independent expected/observed MongoDB identity comparison.
  - Rejects missing, ambiguous, unsupported, non-loopback, wrong-port, and
    wrong-database metadata.
- `imports/shared/auth/config.ts`
  - Extended the isolated helper contract with expected MongoDB host and port.
- `scripts/test-environment.mjs`
  - Derives expected Meteor-managed MongoDB port as app port + 1 and exports it
    with the expected loopback host.
- `playwright.config.ts`
  - Passes the expected MongoDB host/port through the Playwright-managed Meteor
    web-server environment.
- `imports/server/auth/mongoConnectionIdentity.ts`
  - Added the Meteor/MongoDB adapter. It pings the active Meteor MongoDB
    connection, reads the `Db` database name, and reads the connected endpoint
    from the MongoDB driver's topology description.
- `imports/server/auth/settings.ts`
  - Compares the expected isolated-test identity with the observed active
    MongoDB identity when helpers are enabled.
- `imports/server/auth/testSupport.ts`
  - Verifies active MongoDB identity before registering test helper methods and
    before helper mutations.
- `imports/server/auth/server.ts`
  - Awaits test-helper registration so the verification completes before helper
    methods can be exposed.
- `imports/server/auth/passwordless.app-test.ts`
  - Added assertions intended to verify the real adapter against the
    Meteor-managed integration database.
- `tests/unit/auth-config.test.ts`
  - Added expected MongoDB endpoint coverage and ordinary non-helper startup
    coverage.
- `tests/unit/test-database-identity.test.ts`
  - Added pure comparison regression coverage for acceptance and failure cases.
- `tests/unit/test-launchers.test.ts`
  - Locked launcher-derived MongoDB endpoint variables.
- `docs/PLATFORM_Authentication.md`
  - Documented the active endpoint/database guarantee and explicit limitations.
- `docs/PLATFORM_Testing.md`
  - Documented expected MongoDB endpoint derivation for integration tests.
- `docs/MAP_System.md`
  - Added the new shared identity module and server adapter references.
- `docs/TEMP_004A_Resume.md`
  - Updated the current checkpoint and remaining work.

## Expected Identity

The isolated launcher remains the source for expected identity:

- Integration app port defaults to `3400`; Playwright app port defaults to
  `3200`.
- Meteor-managed MongoDB is expected on app port + 1.
- `scripts/test-environment.mjs` exports
  `RUGBY_ROOSTER_TEST_MONGO_HOST=127.0.0.1` and
  `RUGBY_ROOSTER_TEST_MONGO_PORT=<app port + 1>`.
- `RUGBY_ROOSTER_TEST_DATABASE_NAME` must be `meteor`.
- Existing generated run IDs, `METEOR_LOCAL_DIR`, inherited Mongo-variable
  rejection, and database identity strings are preserved.

This avoids hard-coding one suite's port into all suites.

## Actual Identity

The server adapter uses the Meteor/MongoDB versions installed in this repo:

- Meteor package `mongo@2.5.1` creates `MongoConnection` with a MongoDB
  `MongoClient` and `client.db()`.
- The bundled MongoDB driver is `6.16.0` from `npm-mongo@6.16.3`.
- The adapter performs `db.command({ ping: 1 })` against the `Db` object used by
  Meteor.
- It reads the active database name from the driver's `Db`.
- It reads the connected endpoint from `client.topology.description.servers`.

It does not accept environment variables, a configured URI, or the generated
filesystem-oriented database id as proof of the active connection.

## Validation Ordering

Server startup still validates production/auth settings before auth setup. When
test helpers are explicitly enabled, `registerAuthTestMethods()` now verifies
the active MongoDB endpoint and database before calling `Meteor.methods`.
Helper methods also re-check the same identity before mutations or helper data
reads.

If verification fails, helper methods are not registered; if a later re-check
fails, the helper operation fails closed.

## Supported Topology And Limits

Supported:

- A single active MongoDB endpoint.
- Explicit loopback host forms: `127.0.0.1`, `localhost`, `::1`, and `[::1]`.
- Exact expected port match.
- Exact expected database name match.

Rejected:

- Missing metadata.
- Unavailable topology metadata.
- More than one endpoint.
- SRV topology metadata.
- Load-balanced topology metadata.
- Unknown topology metadata.
- Non-loopback hosts.
- Wrong port.
- Wrong database.

This verification proves that Meteor is using the expected active endpoint plus
database name for the current local test setup. It does not independently prove
the MongoDB filesystem storage directory, nor exclusive ownership of a MongoDB
process.

## Regression Cases

Pure unit coverage now includes:

- Expected local endpoint and database accepted.
- Correct database name but wrong port rejected.
- Correct endpoint but wrong database rejected.
- Non-loopback endpoint rejected.
- Missing, unavailable, ambiguous, and unsupported connection metadata
  rejected.
- Expected endpoint parsing normalizes only explicitly supported loopback
  representations.
- Ordinary startup without test helpers does not require the isolated MongoDB
  contract.

The helper registration path now performs verification before helper methods are
registered, so failed verification keeps helper access unavailable at startup.

## Current Verification

These results are from this database-isolation follow-up only. Historical
CCPP-004A results are preserved in other audit and temporary handoff documents
but are not re-claimed here.

- `meteor npm run test:unit -- --run tests/unit/auth-config.test.ts tests/unit/test-database-identity.test.ts tests/unit/test-launchers.test.ts`
  - Passed.
  - 3 test files, 22 tests.
  - npm emitted the existing `Unknown env config "nodedir"` warning.
- `meteor npm run typecheck`
  - Passed twice, including a final run after moving the Meteor/MongoDB access
    into `imports/server/auth/mongoConnectionIdentity.ts`.
  - Each run executed `tsc --noEmit --incremental false`.
  - npm emitted the existing `Unknown env config "nodedir"` warning.
- `MOCHA_GREP='proves the isolated test environment before helpers run' TEST_CLIENT=0 meteor npm run test:integration`
  - First attempt inside the sandbox failed before runtime with
    `Error: listen EPERM: operation not permitted 127.0.0.1:3400`.
  - Approved local-loopback rerun exited with code 0 but reported
    `0 passing`, so it did not verify the adapter.
- `MOCHA_GREP=isolated TEST_CLIENT=0 meteor npm run test:integration`
  - One evidence-based retry exited with code 0 but again reported
    `0 passing`, so it did not verify the adapter.
- `ss -ltnp`
  - No listeners remained on the task-owned integration ports 3400, 3401, or
    3402.
- `pgrep -af "meteor|mongod|run-integration-tests|meteortesting"`
  - Returned no task-owned Meteor or MongoDB processes after the scoped
    integration attempts. The only match was the `pgrep` command itself.

## Blocked Or Unverified

The real Meteor adapter and pre-registration helper gate were implemented, but
the targeted runtime verification remains unverified because Mocha filtering
selected zero app-server tests twice. This task stopped there as requested
instead of expanding into Meteor/Mocha runner debugging or the full integration
suite.

Playwright, browser checks, full integration, full verification pipeline,
commits, pushes, deployments, and email sending were not run.
