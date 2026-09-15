# TEMP 004A Resume

## Checkpoint - 2026-09-15 Review Preservation

This file is a temporary CCPP-004A handoff checkpoint. Keep it under `docs/`
until CCPP-004A is either completed or deliberately abandoned.

This checkpoint session did not restart debugging, rerun browser suites, commit,
push, deploy, or mark CCPP-004A complete.

## Checkpoint - 2026-09-15 Throttle Correction

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

Preserved findings:

- The `Meteor.isTest` override remains unaccepted.
- `RSPACK_NATIVE` was investigated but NOT established as a suitable
  replacement.
- Rspack reload, Meteor HMR, and Meteor hot-code-push have distinct controls.
- Do not treat a proposed workaround as implemented or verified.

Remaining work:

- Decide whether the `Meteor.isTest` client override is acceptable, needs a
  narrower implementation, or should be replaced with a supported mechanism.
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

### Verified In This Session

- `AGENTS.md` was read.
- This resume document was read.
- The current diff and untracked CCPP-004A files were inspected.
- `meteor npm run typecheck` was run once and passed with exit code 0.

The TypeScript command output included npm's existing
`Unknown env config "nodedir"` warning, then ran
`tsc --noEmit --incremental false` successfully.

No browser suite, full test suite, lint, formatter, integration suite, commit,
push, or deployment was run in this checkpoint session.

### Current Meteor.isTest Override

`rspack.config.ts` now defines:

```ts
const isIsolatedE2eRun =
  process.env.RUGBY_ROOSTER_TEST_MODE === 'isolated' &&
  process.env.RUGBY_ROOSTER_TEST_RUN_ID?.startsWith('rr-e2e-') === true;
const shouldDisableClientHmr =
  Meteor.isClient && Meteor.isDevelopment && isIsolatedE2eRun;
```

When that gate is true for the client development build, the Rspack dev server
sets `hot: false` and `liveReload: false`, and Rspack's `DefinePlugin` injects:

```ts
new DefinePlugin({
  'Meteor.isTest': JSON.stringify(true),
})
```

The intended trigger path is `scripts/run-playwright-tests.mjs` ->
`scripts/test-environment.mjs`, which creates
`RUGBY_ROOSTER_TEST_MODE=isolated` and `RUGBY_ROOSTER_TEST_RUN_ID=rr-e2e-*`.
`playwright.config.ts` passes those variables to the managed Meteor web server.

This is a test-only candidate workaround, not an accepted solution. It may affect
any bundled client code or Meteor package code that branches on `Meteor.isTest`,
and it may influence conditional bundling because the value is injected at build
time. Future work should review whether a supported Meteor/Rspack mechanism can
replace it or narrow it further.

### Current Diff Summary

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

### Future Resume Guidance

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

## Recovery Checkpoint - 2026-09-15

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

## Recovery Checkpoint - Supported Boundary

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

## Recovery Checkpoint - Startup Smoke

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

Next step: resume CCPP-004A verification with `meteor npm run test:e2e`, then
update durable documentation, create `AUDIT_004A`, and package the EOMD archive
only after final results are known.

## Earlier Current Stage

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
