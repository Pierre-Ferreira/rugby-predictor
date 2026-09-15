# AUDIT 004A Database Verification Closure

## Scope

This CCPP-004A follow-up addressed only the remaining database verification
gaps for Rugby Rooster auth test helpers. It did not investigate or modify HMR,
Rspack, hot-code-push, `Meteor.isTest`, `RSPACK_NATIVE`, browser navigation,
account switching, throttles, scoring, product features, Playwright, deployment,
commits, pushes, or real email delivery.

Rugby Rooster remains separate from Rugby Tracker / Rucks and Mauls.

## Zero-Test Cause

The prior filtered integration runs reported `0 passing` because the test
runner reached Mocha with no matching registered tests. The generated Meteor
bundle showed the app-test glob can include
`imports/server/auth/passwordless.app-test.ts`, so changing the grep text alone
was not the discovery fix.

This pass added the supported explicit server test entry
`meteor.testModule.server=imports/server/auth/passwordless.app-test.ts` and made
the integration launcher default to server-only execution with `TEST_CLIENT=0`.
After that change, the integration runner selected the
`CCPP-004 passwordless accounts and authorisation` suite and named the intended
real-adapter test, but it failed in the suite `beforeEach` hook before any test
body executed.

## Files Changed

- `package.json`
  - Added `meteor.testModule.server` for the server auth integration test.
- `scripts/run-integration-tests.mjs`
  - Defaults isolated integration runs to `TEST_CLIENT=0` and `TEST_SERVER=1`.
- `imports/server/auth/testSupport.ts`
  - Added a small dependency-injection seam around helper registration,
    environment verification, and helper data operations.
- `imports/server/auth/passwordless.app-test.ts`
  - Added negative helper-gating regression tests.
  - Updated the real-adapter assertion to validate observed identity through
    the shared database-identity checker instead of assuming a single topology.
- `imports/shared/auth/testDatabaseIdentity.ts`
  - Allows multiple reported loopback endpoint aliases only when all use the
    expected port and at least one matches the expected host.
  - Still rejects missing, SRV, load-balanced, unknown, non-loopback,
    wrong-port, and wrong-database metadata.
- `tests/unit/test-database-identity.test.ts`
  - Added coverage for multiple loopback aliases on the expected port.
- `docs/PLATFORM_Authentication.md`
  - Updated the maintained helper-topology description.
- `docs/PLATFORM_Testing.md`
  - Documented server-only integration defaults and explicit server test entry.
- `docs/TEMP_004A_Resume.md`
  - Updated the current checkpoint.
- `docs/AUDIT_004A_Database_Verification_Closure.md`
  - This audit.

## Negative Gating Tests

Added regression tests in `imports/server/auth/passwordless.app-test.ts`:

- `does not register helper methods when database verification fails`
  - Injects a verification failure before registration.
  - Asserts the fake `registerMethods` dependency was not called.
- `checks database verification before helper mutations`
  - Allows registration, then injects a verification failure at helper
    invocation.
  - Calls the representative `test.auth.createVerifiedUser` helper.
  - Asserts the fake `users.insertAsync` mutation was not called.

These tests prove the helper gate fails closed at registration and before a
representative mutation when executed. In the current integration run they did
not execute because the real database verification blocker fails in the shared
suite `beforeEach` hook first.

## Verification

- `meteor npm run typecheck`
  - First run failed with `TS2352` for the fake Meteor collection test double.
  - The test double was narrowed, then the command passed.
  - Final outcome: passed, running `tsc --noEmit --incremental false`.
  - npm emitted the existing `Unknown env config "nodedir"` warning.
- `meteor npm run test:unit -- --run tests/unit/test-database-identity.test.ts`
  - Passed.
  - 1 test file, 7 tests.
  - npm emitted the existing `Unknown env config "nodedir"` warning.
- `meteor npm run typecheck`
  - Passed again after the database-identity correction.
  - Ran `tsc --noEmit --incremental false`.
  - npm emitted the existing `Unknown env config "nodedir"` warning.
- `meteor npm run test:integration`
  - First allowed server integration attempt after the selection fix.
  - Selected `CCPP-004 passwordless accounts and authorisation`.
  - Reported `0 passing`, `1 failing`.
  - Failed in the `beforeEach` hook for
    `proves the isolated test environment before helpers run`.
  - Error:
    `Auth test helpers support only a single local MongoDB endpoint. [test-environment-mismatch]`
  - Client tests were skipped by `TEST_CLIENT=0`.
- `meteor npm run test:integration`
  - Second and final allowed server integration attempt after the bounded
    topology correction.
  - Selected `CCPP-004 passwordless accounts and authorisation`.
  - Reported `0 passing`, `1 failing`.
  - Failed in the same `beforeEach` hook before any test body executed.
  - Error:
    `Auth test helpers require a supported local MongoDB topology. [test-environment-mismatch]`
  - Client tests were skipped by `TEST_CLIENT=0`.
- `pgrep -af '[m]eteor|[m]ongod|[r]un-integration-tests|[m]eteortesting'`
  - Returned no task-owned Meteor, MongoDB, integration launcher, or
    meteortesting processes after the integration attempts.

## Real Adapter Status

The explicit server test selection gap is partially closed: the integration
runner now selects the auth app-test suite and names the intended real-adapter
test instead of silently reporting zero selected tests.

The real adapter was invoked through `assertVerifiedAuthTestEnvironment()` in
the suite `beforeEach`, but it did not verify successfully. The intended
`getActiveMongoConnectionIdentity()` test body did not execute, so successful
real-adapter proof remains open.

## Remaining Blocker

Database verification is still not complete. The current blocker is the active
Meteor/MongoDB topology metadata observed by
`imports/server/auth/mongoConnectionIdentity.ts`: the helper gate rejects it as
unsupported before any integration test body runs.

Per the bounded-effort limit, this pass stopped after the second integration
attempt instead of adding instrumentation or continuing broader Meteor/MongoDB
driver debugging.
