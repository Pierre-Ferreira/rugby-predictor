# TEMP 004A Resume

## Current Checkpoint - 2026-09-15 HMR Workaround Resolution

This file is a temporary CCPP-004A handoff checkpoint. Keep it under `docs/`
until CCPP-004A is either completed or deliberately abandoned.

This checkpoint resolved the unaccepted isolated-E2E client `Meteor.isTest`
workaround only. It did not reopen or change database verification, topology
handling, throttles, scoring, product features, server behaviour, token
handling, account-switch behaviour, deployment, commits, pushes, or email
sending.

Changed files in this checkpoint:

- `rspack.config.ts`
- `docs/AUDIT_004A_HMR_Workaround_Resolution.md`
- `docs/CORE_Build_Plan.md`
- `docs/MAP_System.md`
- `docs/PLATFORM_Testing.md`
- `docs/TEMP_004A_Resume.md`

Current implementation state:

- `rspack.config.ts` no longer imports `DefinePlugin` and no longer replaces
  `Meteor.isTest`.
- The established client-development Rspack loopback settings remain:
  `devServer.host = 'localhost'` and
  `allowedHosts = ['localhost', '127.0.0.1']`.
- The existing isolated-E2E gate still disables only Rspack `hot` and
  `liveReload` when `RUGBY_ROOSTER_TEST_MODE=isolated` and
  `RUGBY_ROOSTER_TEST_RUN_ID` starts with `rr-e2e-`.
- `RSPACK_NATIVE` was not used and remains unverified as a replacement.
- Authentication navigation/session code and auth browser assertions were not
  changed in this checkpoint.

Actual check results in this checkpoint:

- Browser invocation 1:
  `npm run test:e2e -- tests/e2e/auth.spec.ts -g "requests a real email link, redeems it in a fresh browser, restores the session, and signs out"`
  passed: 1 Chromium test.
- Browser invocation 2:
  `npm run test:e2e -- tests/e2e/auth.spec.ts` passed: 10 Chromium tests.
- `npm run typecheck` passed: `tsc --noEmit --incremental false`.
- `npm run lint` passed: `eslint .`.
- Initial changed-file formatting check:
  `npx prettier --check rspack.config.ts docs/AUDIT_004A_HMR_Workaround_Resolution.md docs/CORE_Build_Plan.md docs/MAP_System.md docs/PLATFORM_Testing.md docs/TEMP_004A_Resume.md`.
  It failed on `docs/TEMP_004A_Resume.md`.
- `npx prettier --write docs/TEMP_004A_Resume.md` formatted the checkpoint.
- Final changed-file formatting check before handoff uses the same
  `npx prettier --check` command and passed.
- Browser output emitted the existing Node warning that `NO_COLOR` is ignored
  when `FORCE_COLOR` is set; it did not fail the checks.

Current remaining work:

- The `Meteor.isTest` workaround issue is resolved for this checkpoint: the
  override was removed and auth browser tests passed with normal client
  identity.
- The accepted database baseline remains preserved: 9 database-identity unit
  tests, 16 server integration tests, and TypeScript passed in the prior
  database topology checkpoint.
- Full CCPP-004A completion still requires any broader acceptance checks listed
  by the active plan; do not claim production delivery or deployment readiness
  from this focused auth-browser verification alone.
- No commit, push, deployment, email sending, production verification, database
  suite rerun, or full test-suite run was performed in this checkpoint.

## Historical Checkpoint - 2026-09-15 Database Topology Correction

This file is a temporary CCPP-004A handoff checkpoint. Keep it under `docs/`
until CCPP-004A is either completed or deliberately abandoned.

This checkpoint closed the auth-test database verification blocker only. It did
not investigate or modify Rspack configuration, HMR, Meteor hot-code-push, the
`Meteor.isTest` override, `RSPACK_NATIVE`, authentication navigation/account
switching, throttle settings, scoring, product features, browser tests,
deployment, commits, pushes, or email sending.

Changed files in this checkpoint:

- `imports/server/auth/mongoConnectionIdentity.ts`
- `imports/server/auth/passwordless.app-test.ts`
- `imports/server/auth/settings.ts`
- `imports/shared/auth/testDatabaseIdentity.ts`
- `tests/unit/test-database-identity.test.ts`
- `docs/AUDIT_004A_Database_Topology_Correction.md`
- `docs/PLATFORM_Authentication.md`
- `docs/PLATFORM_Testing.md`
- `docs/TEMP_004A_Resume.md`

Current implementation state:

- The mocked helper-gating tests now live in
  `CCPP-004 auth test helper database gating`, a separate describe block without
  the real-database cleanup hook.
- The MongoDB topology diagnostic is retained behind
  `RUGBY_ROOSTER_TEST_MONGO_DIAGNOSTICS=1` plus
  `RUGBY_ROOSTER_TEST_MODE=isolated`, and defaults off.
- The observed Meteor-managed isolated database topology was sanitized as:
  raw topology `ReplicaSetWithPrimary`, server type `RSPrimary`, endpoint
  `127.0.0.1:3401`, database `meteor`, server count `1`, unparsed endpoint
  count `0`.
- The adapter now recognizes only that one-node replica-set primary shape as
  `single-node-replica-set`, alongside the existing driver `Single` topology.
- The comparator now requires exactly one active endpoint, exact expected host
  and port, and exact expected database. It rejects `multiple`, unknown, SRV,
  load-balanced, non-loopback, wrong-host, wrong-port, wrong-database, missing,
  and unsupported topology metadata.
- The unsupported multiple-loopback-alias acceptance was removed. The verifier
  does not assume `localhost`, IPv4 loopback, and IPv6 loopback identify the
  same MongoDB process.
- The guarantee remains precise: endpoint and database validation does not
  prove MongoDB filesystem location or exclusive process ownership.

Actual check results in this checkpoint:

- `RUGBY_ROOSTER_TEST_MONGO_DIAGNOSTICS=1 meteor npm run test:integration`
  first failed under sandbox restrictions before Meteor could start:
  `listen EPERM: operation not permitted 127.0.0.1:3400`.
- The same observation command was re-run with approved loopback binding and
  produced the sanitized topology evidence above. It selected the diagnostic,
  helper-gating, and passwordless auth suites. Result: `3 passing`, `1 failing`;
  the diagnostic test and both negative helper-gating tests passed, then the
  real database suite failed in `beforeEach` for
  `proves the isolated test environment before helpers run` with
  `Auth test helpers require a supported local MongoDB topology. [test-environment-mismatch]`.
- `meteor npm run test:unit -- --run tests/unit/test-database-identity.test.ts`
  passed: 1 test file, 9 tests.
- `meteor npm run test:integration` passed after the correction: `16 passing`.
  The named tests `does not register helper methods when database verification fails`,
  `checks database verification before helper mutations`, and
  `proves the isolated test environment before helpers run` all executed and
  passed. Client tests were skipped by `TEST_CLIENT=0`.
- `meteor npm run typecheck` passed: `tsc --noEmit --incremental false`.
- `pgrep -af '[m]eteor|[m]ongod|[r]un-integration-tests|[m]eteortesting'`
  returned no task-owned Meteor, MongoDB, integration launcher, or
  meteortesting processes after the integration runs.
- npm emitted the existing `Unknown env config "nodedir"` warning during npm
  commands.

Remaining work at that checkpoint, superseded where it conflicts with the
current checkpoint:

- Database verification is complete for this checkpoint: the real-adapter test
  and both negative helper-gating tests executed and passed in the final server
  integration run.
- The `Meteor.isTest` client override remained explicitly unaccepted at that
  time; the current checkpoint removed it.
- `RSPACK_NATIVE` remains explicitly unverified as a replacement.
- Final CCPP-004A browser/full-suite verification and completion documentation
  remain open.
- Do not mark CCPP-004A complete until the workaround disposition, final
  verification, and durable completion handoff are done.
- No commit, push, deployment, email sending, browser suite, full suite, or
  completion action was performed in this checkpoint.

## Historical Checkpoint - 2026-09-15 Throttle Correction

This checkpoint corrected only the passwordless-auth throttle mismatch and
throttle-window validation. It did not investigate or modify HMR, Rspack,
browser navigation, database isolation, or test launchers.

Changed files:

- `imports/shared/auth/config.ts`
- `tests/unit/auth-config.test.ts`
- `docs/PLATFORM_Authentication.md`
- `docs/AUDIT_004A_Throttle_Correction.md`
- `docs/TEMP_004A_Resume.md`

Actual check results:

- `meteor npm run test:unit` passed: 6 test files, 57 tests.
- `meteor npm run typecheck` passed: `tsc --noEmit --incremental false`.
- Both commands emitted npm's existing
  `Unknown env config "nodedir"` warning.

Preserved findings at that checkpoint:

- The `Meteor.isTest` override remained unaccepted at that time; the current
  checkpoint removed it.
- `RSPACK_NATIVE` was investigated but NOT established as a suitable
  replacement.
- Rspack reload, Meteor HMR, and Meteor hot-code-push have distinct controls.
- Do not treat a proposed workaround as implemented or verified.

Remaining work at that checkpoint, superseded where it conflicts with the
current checkpoint:

- The workaround decision was still open at that time; the current checkpoint
  resolved it by removing the override.
- Run final CCPP-004A verification in a future session that explicitly resumes
  browser/full-suite testing.
- Do not mark CCPP-004A complete until the workaround decision, final
  verification, and durable completion documentation are done.
- No commit, push, deployment, email sending, browser suite, full suite, or
  completion action was performed in this checkpoint.

### Prior-Session Reported Results

The interrupted prior session reported the following results. They are preserved
for continuity and were not re-run in this checkpoint session:

- Loopback Rspack host/origin configuration was fixed.
- Redundant cross-test browser-storage clearing was removed.
- A client-side `Meteor.isTest` override was added for isolated E2E runs to
  suppress HMR.
- The targeted successful-login browser test passed.
- The related account-switch and invalid-link browser-test subset passed.
- A bounded repeat passed 10/10 runs.
- Test-owned listeners were confirmed stopped.
- `npm run typecheck` started, but its result was not captured before remote
  compaction failed.

### Historical - Verified In Review Preservation Checkpoint

- `AGENTS.md` was read.
- This resume document was read.
- The current diff and untracked CCPP-004A files were inspected.
- `meteor npm run typecheck` was run once and passed with exit code 0.

The TypeScript command output included npm's existing
`Unknown env config "nodedir"` warning, then ran
`tsc --noEmit --incremental false` successfully.

No browser suite, full test suite, lint, formatter, integration suite, commit,
push, or deployment was run in that checkpoint session.

### Historical Meteor.isTest Override - Removed

`rspack.config.ts` now defines:

```ts
const isIsolatedE2eRun =
  process.env.RUGBY_ROOSTER_TEST_MODE === 'isolated' &&
  process.env.RUGBY_ROOSTER_TEST_RUN_ID?.startsWith('rr-e2e-') === true;
const shouldDisableClientHmr =
  Meteor.isClient && Meteor.isDevelopment && isIsolatedE2eRun;
```

When that gate is true for the client development build, the Rspack dev server
sets `hot: false` and `liveReload: false`.

The intended trigger path is `scripts/run-playwright-tests.mjs` ->
`scripts/test-environment.mjs`, which creates
`RUGBY_ROOSTER_TEST_MODE=isolated` and `RUGBY_ROOSTER_TEST_RUN_ID=rr-e2e-*`.
`playwright.config.ts` passes those variables to the managed Meteor web server.

The previous Rspack `DefinePlugin` replacement of `Meteor.isTest` was removed
in the current checkpoint. Auth browser tests passed with normal client
identity, so no replacement identity override is accepted or needed for this
checkpoint.

### Historical Diff Summary From Earlier CCPP-004A Work

Current CCPP-004A changes include:

- Isolated integration and Playwright launchers with generated run IDs,
  dedicated `METEOR_LOCAL_DIR` values, loopback `ROOT_URL`, Meteor-managed Mongo
  identity checks, and `RSPACK_DEVSERVER_PORT=app port + 2`.
- Playwright web-server startup through
  `meteor run --port 127.0.0.1:<port>` with `reuseExistingServer: false`.
- Rspack client-development `devServer.host = 'localhost'` and
  `allowedHosts = ['localhost', '127.0.0.1']`.
- Auth email-link UI handling for same-account links, different-account
  confirmation, invalid different-account redemption, and malformed new-link
  credential clearing.
- Auth runtime/test-helper hardening and current-run ownership checks.
- Browser-test coverage for the account-switch and malformed-link paths.

### Historical Resume Guidance - Superseded Where It Conflicts

- Start by reviewing `docs/AUDIT_004A_Login_Navigation_Fix.md`.
- The checkpoint review archive is
  `/tmp/rugby-rooster-ccpp004a-review-20260915.zip`. It was verified with
  `unzip -tq` and `zipinfo -t`, and contains 39 focused source/documentation
  files.
- Review the `Meteor.isTest` override before accepting or extending it.
- Browser and full-suite verification should be run only in a future session that
  explicitly resumes testing.
- Do not mark CCPP-004A complete until the workaround decision, final
  verification, and durable documentation are complete.

## Historical Recovery Checkpoint - 2026-09-15

Interrupted browser-test process state was inspected before changing recovery
code. `ps -ef` showed an owned run from this repository:

- `meteor npm run test:e2e -- tests/e2e/auth.spec.ts`
- `node scripts/run-playwright-tests.mjs tests/e2e/auth.spec.ts`
- Playwright worker process
- `meteor run --port 127.0.0.1:3200 --settings tests/settings/playwright-settings.json`
- Meteor-managed `mongod` bound to `127.0.0.1:3201` with dbpath
  `.meteor/local-playwright/db`
- Rspack client/server watchers using `_build-local-playwright`,
  `build-assets-local-playwright`, and `build-chunks-local-playwright`

`ss -ltnp` showed listeners on `127.0.0.1:3200` (Meteor), `127.0.0.1:3201`
(Meteor-managed MongoDB), and `127.0.0.1:3202` (Rspack). The Rspack command line
for both client and server included `--env devServerPort=NaN`, confirming the
stuck run was still in the bad bind/proxy state. Direct `/proc/<pid>/cwd`
inspection for those host PIDs was unavailable from the sandbox, but the command
paths and Mongo dbpath all pointed at this repository's Playwright local
directory.

Only the exact interrupted test-run PID chain reported above was stopped. A
follow-up `ss -ltnp` showed no listeners on 3200, 3201, or 3202, and
`pgrep -af meteor` returned no matching process. Unrelated Playwright MCP and
desktop Chrome processes were left running.

Changed files associated with the bind/proxy recovery area:

- `package.json`
- `playwright.config.ts`
- `rspack.config.ts`
- `scripts/run-integration-tests.mjs`
- `scripts/run-playwright-tests.mjs`
- `scripts/test-environment.mjs`
- generated-output ignore updates in `.gitignore`, `.prettierignore`, and
  `eslint.config.mjs`

Current diagnostic target: inspect installed `@meteorjs/rspack` and Meteor
tooling to establish the supported boundary for passing the web-server bind
address, numeric app port, and Rspack dev-server/proxy URL. Do not keep the
speculative app-level `RUGBY_ROOSTER_RSPACK_DEV_SERVER_PORT` override unless the
installed integration supports that boundary.

## Historical Recovery Checkpoint - Supported Boundary

Installed-code findings:

- Meteor `3.5.1` is active.
- Meteor CLI `--port 127.0.0.1:<port>` is parsed into `proxyHost` plus
  `proxyPort`; `run-proxy.js` listens with `server.listen(listenPort,
listenHost || '0.0.0.0')`.
- `run-all.js` derives the Meteor-managed MongoDB port with
  `parseInt(listenPort, 10) + 1`, which is safe when `proxyPort` is the parsed
  numeric port.
- The installed Meteor package `rspack@1.2.1` computes
  `RSPACK_DEVSERVER_PORT` from `getMeteorAppPort()`. That helper prefers the
  raw command `--port` option before `process.env.PORT`, so a host-qualified
  `--port 127.0.0.1:3200` causes the digit-sum calculation to produce `NaN`.
- The same package passes `process.env.RSPACK_DEVSERVER_PORT` to
  `@meteorjs/rspack` as `--env devServerPort=...` and uses that same env value
  for Meteor's dev-asset proxy target `http://localhost:<port>`.
- `@meteorjs/rspack@2.2.0` uses `Meteor.devServerPort` for the Rspack dev
  server's numeric `port`.

Recovery fix applied:

- Removed the speculative `RUGBY_ROOSTER_RSPACK_DEV_SERVER_PORT` override.
- Added a supported `RSPACK_DEVSERVER_PORT` value to the isolated test
  environment, derived as test port + 2.
- Kept Meteor's web-server/proxy bind on `127.0.0.1:<port>`.
- Limited the project Rspack config to `devServer.host = 'localhost'` during
  client development so it matches the Meteor package's hardcoded proxy target.

Next diagnostic step: run one bounded Playwright-managed Meteor startup smoke,
capture concise logs under `/tmp`, confirm listeners on the expected loopback
ports, confirm HTTP readiness, and ensure the smoke-owned process tree is
stopped afterward.

## Historical Recovery Checkpoint - Startup Smoke

First smoke attempt inside the sandbox failed immediately with
`Error: listen EPERM: operation not permitted 127.0.0.1:3200`. This was a
sandbox loopback-bind restriction, so the same bounded smoke was rerun with
approved local-loopback permissions.

Approved smoke result:

- Command script: `/tmp/rugby-rooster-ccpp004a-start-smoke.sh`
- Full log: `/tmp/rugby-rooster-ccpp004a-start-smoke.log`
- Listener snapshot:
  `/tmp/rugby-rooster-ccpp004a-start-smoke-listeners.txt`
- Cleanup listener snapshot:
  `/tmp/rugby-rooster-ccpp004a-start-smoke-cleanup-listeners.txt`
- HTTP readiness: `GET http://127.0.0.1:3200/sign-in` returned `200`.
- Meteor proxy listener: `127.0.0.1:3200`.
- Meteor-managed MongoDB listener: `127.0.0.1:3201`.
- Rspack dev-server listener: loopback `[::1]:3202`.
- Rspack startup banner reported
  `Started Rspack HMR server at http://localhost:3202/`.
- Meteor startup banner reported `App running at http://127.0.0.1:3200`.
- Smoke cleanup succeeded; no listeners remained on 3200, 3201, or 3202.

Historical next step, now superseded by the current database-isolation
checkpoint above: resume CCPP-004A verification with browser/full-suite checks
only in a future session that explicitly requests that scope. Do not treat this
startup smoke as final CCPP-004A verification.

## Historical Earlier Current Stage

CCPP-004A implementation started on 2026-09-15. Initial repository status was
clean. Read `AGENTS.md`, `README.md`, CCPP-004 audit, authentication/testing
docs, build plan, system map, product rules, auth source, settings, launchers,
and existing auth tests.

## Findings Confirmed

- `shouldCaptureMailLocally()` accepted explicit `mail.capture: true` before
  checking production.
- Test helpers were enabled by private flag plus non-production mode only.
- Integration launcher did not pin or scrub Mongo database variables.
- Playwright could reuse any local server on the target port.
- Test cleanup removed all users ending in `@example.test`.
- Captured-mail helper accepted arbitrary email addresses.
- `/auth/email-link` redirected any authenticated verified user without
  comparing the signed-in account to the link email.
- Malformed new email-link URLs could fall back to older pending credentials.
- Link request throttling used a low shared address cap and throttle buckets
  were not proactively pruned.

## Completed Work

- Added pure auth runtime validation in `imports/shared/auth/config.ts`.
  Production rejects explicit local mail capture, explicit test-helper
  enablement, missing mail transport, and missing canonical app URL.
- Wired server startup to validate before mail transport installation and helper
  registration.
- Added an isolated-test contract using generated test run IDs, dedicated
  `METEOR_LOCAL_DIR` values, loopback `ROOT_URL`, and Meteor-managed Mongo only.
- Added launcher wrappers for integration and Playwright tests. They reject
  inherited Mongo connection variables by name and bind Meteor to loopback.
- Disabled Playwright web-server reuse for managed browser test runs.
- Scoped auth test helpers to the verified current run and replaced
  suffix-wide cleanup with current-run ownership cleanup.
- Tagged captured local mail with the active test run where available.
- Raised link-request shared-address throttling to a separate aggregate bucket
  and added stale throttle-bucket pruning.
- Updated generated-path ignores for integration local build output.

## Actual Check Results

- `meteor npm run test:unit` passed: 6 test files, 54 tests. npm emitted the
  existing `Unknown env config "nodedir"` warning.
- First `meteor npm run test:integration` failed before runtime because the
  custom `rugbyRoosterTest` field needed narrow TypeScript casts.
- Second `meteor npm run test:integration` failed during server startup because
  Meteor-managed local Mongo injects `MONGO_URL`/`MONGO_OPLOG_URL`; server-side
  validation was adjusted to leave inherited-variable rejection at the launcher
  boundary and verify the active database at helper runtime.
- Third `meteor npm run test:integration` failed on a test assertion expecting
  `null` instead of Meteor's `undefined` for a missing user. The local test
  finder now normalizes missing users to `null`.
- Final `meteor npm run test:integration` passed: 14 app-server tests.

## Superseded Outstanding Work

The earlier instruction to run browser tests next is superseded by the
September 15, 2026 review-preservation checkpoint above. Do not run browser
checks in this checkpoint session.
