# AUDIT 004A Database Topology Correction

## Scope

This CCPP-004A follow-up corrected only the MongoDB topology handling that
blocked server auth integration tests. It did not investigate or modify HMR,
Rspack, hot-code-push, `Meteor.isTest`, `RSPACK_NATIVE`, browser navigation,
account switching, throttles, scoring, product features, Playwright, deployment,
commits, pushes, or real email delivery.

Rugby Rooster remains separate from Rugby Tracker / Rucks and Mauls.

## Sanitized Topology Evidence

The observation integration run used the existing isolated launcher with
`RUGBY_ROOSTER_TEST_MONGO_DIAGNOSTICS=1`. The diagnostic output was explicitly
allowlisted and contained no driver objects, connection strings, credentials,
email addresses, or tokens.

Observed metadata:

- Raw driver topology type: `ReplicaSetWithPrimary`.
- Reported server types: `RSPrimary`.
- Reported host/port entries: `127.0.0.1:3401`.
- Active database name: `meteor`.
- Reported server count: `1`.
- Unparsed host/port entry count: `0`.

The same sanitized values were emitted before the failing `beforeEach`, so the
cleanup rejection did not hide the topology evidence.

## Rejection Cause

`imports/server/auth/mongoConnectionIdentity.ts` previously classified only
driver `Single` topology metadata as `single`. The observed Meteor-managed local
database was a one-server replica set primary, so the adapter classified it as
`unknown`. The shared comparator then rejected it with:

`Auth test helpers require a supported local MongoDB topology.`

## Correction

The installed `mongodb` SDAM code defines `ReplicaSetWithPrimary` as a topology
type and `RSPrimary` as a server type; the correction uses those exact observed
driver names.

The adapter now recognizes the observed supported local setup as
`single-node-replica-set` only when all of these are true:

- Raw driver topology type is `ReplicaSetWithPrimary`.
- Exactly one endpoint is reported and parsed.
- Exactly one server is reported.
- The reported server type is `RSPrimary`.

The comparator now accepts only `single` and `single-node-replica-set`
topologies with exactly one reported endpoint. It keeps the exact expected
database and port checks, requires the observed host to match the expected host,
and rejects non-loopback, missing, multiple, unknown, SRV, load-balanced,
wrong-host, wrong-port, wrong-database, and unsupported topology metadata.

The previous unsupported acceptance for multiple loopback aliases on the same
port was removed. The check does not assume `localhost`, IPv4 loopback, and IPv6
loopback identify the same MongoDB process.

This verifies only the active MongoDB endpoint and database name used by Meteor.
It does not prove filesystem location or exclusive process ownership.

## Negative Helper Tests

The mocked helper-gating tests were moved into
`CCPP-004 auth test helper database gating`, a separate describe block without
the real-database cleanup hook.

Actual outcomes:

- `does not register helper methods when database verification fails` passed in
  the observation run and the final verification run. It preserved the injected
  verification failure and asserted method registration was not called.
- `checks database verification before helper mutations` passed in the
  observation run and the final verification run. It preserved the injected
  verification failure and asserted `users.insertAsync` was not called for
  `test.auth.createVerifiedUser`.

## Verification

- `RUGBY_ROOSTER_TEST_MONGO_DIAGNOSTICS=1 meteor npm run test:integration`
  - Initial sandboxed attempt failed before Meteor could start:
    `listen EPERM: operation not permitted 127.0.0.1:3400`.
  - Re-run with approved loopback binding.
  - Observation run selected:
    - `CCPP-004 MongoDB topology diagnostic`
    - `CCPP-004 auth test helper database gating`
    - `CCPP-004 passwordless accounts and authorisation`
  - Passed named tests:
    - `reports sanitized MongoDB topology metadata`
    - `does not register helper methods when database verification fails`
    - `checks database verification before helper mutations`
  - Failed in the `beforeEach` hook for
    `proves the isolated test environment before helpers run`.
  - Outcome: `3 passing`, `1 failing`.
  - Client tests were skipped by `TEST_CLIENT=0`.
- `meteor npm run test:unit -- --run tests/unit/test-database-identity.test.ts`
  - Passed: 1 test file, 9 tests.
  - Relevant named tests included:
    - `accepts the expected local endpoint and database`
    - `accepts the observed single-node replica-set primary topology`
    - `rejects multiple loopback aliases on the expected MongoDB port`
    - `rejects loopback host aliases that do not match the expected host`
- `meteor npm run test:integration`
  - Final server integration verification run.
  - Passed: `16 passing`.
  - Relevant named tests included:
    - `does not register helper methods when database verification fails`
    - `checks database verification before helper mutations`
    - `proves the isolated test environment before helpers run`
  - Client tests were skipped by `TEST_CLIENT=0`.
  - Real-adapter verification against the Meteor-managed isolated database
    succeeded.
- `meteor npm run typecheck`
  - Passed: `tsc --noEmit --incremental false`.
- `pgrep -af '[m]eteor|[m]ongod|[r]un-integration-tests|[m]eteortesting'`
  - Returned no task-owned Meteor, MongoDB, integration launcher, or
    meteortesting processes after the integration runs.

All npm-backed commands emitted the existing
`Unknown env config "nodedir"` warning.
