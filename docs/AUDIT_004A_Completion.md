# AUDIT 004A Completion

Date: 2026-09-15

## Scope

This audit closes CCPP-004A for Rugby Rooster, the standalone prediction game.
It reconciles the accepted checkpoint evidence for authentication configuration,
account-switch behaviour, throttles, isolated test database identity, and the
isolated E2E HMR workaround.

This closeout did not reopen database identity/topology handling, throttle
defaults or validation, account-switch behaviour, the removed `Meteor.isTest`
override, or `RSPACK_NATIVE`.

## Original Problems

CCPP-004A addressed problems found after CCPP-004 passwordless authentication:

- `/auth/email-link` did not distinguish same-account continuation from
  different-account switch decisions.
- Malformed new email-link URLs could fall back to older pending tab
  credentials.
- Local auth test helpers and launchers needed stricter isolated-environment
  guarantees before touching database-backed auth state.
- Playwright/Meteor/Rspack local startup needed deterministic loopback binding,
  isolated run IDs, and generated-port handling.
- Shared-address throttle defaults and throttle-window validation needed to
  match the documented auth policy.
- MongoDB topology verification blocked the server auth integration suite until
  the observed Meteor-managed single-node replica-set shape was supported.
- An isolated-E2E `Meteor.isTest` client override was introduced as a workaround
  and then had to be removed or accepted.

## Implemented Corrections

- Auth runtime validation rejects unsafe production mail/test-helper settings
  and only enables test helpers inside the generated isolated local test
  contract.
- Email-link confirmation now supports same-account continuation,
  different-account switch-or-keep choices, honest invalid-link recovery, and
  malformed-link credential clearing.
- Integration and Playwright launchers create isolated run IDs, reject inherited
  Mongo connection variables, bind Meteor to loopback, derive the expected
  Meteor-managed MongoDB port, and derive the Rspack dev-server port.
- Rspack browser-test startup keeps loopback host/origin settings and disables
  only Rspack HMR/live reload for generated isolated E2E runs.
- The `Meteor.isTest` Rspack `DefinePlugin` override was removed.
- Throttle defaults now keep shared-address link-request and redemption limits
  coherent at 40 attempts per 15 minutes, with documented minute-window
  validation.
- Isolated auth test helpers verify the active Meteor MongoDB endpoint, database
  name, and supported topology before helper registration and before helper
  mutations.

## Requirement Reconciliation

| Existing CCPP-004A requirement                                                                                                                                                                              | Implementation files                                                                                                                                                                                                                                                                                                                                             | Verification evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Status                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Auth runtime configuration rejects unsafe production capture/test-helper settings and requires a private isolated-helper contract.                                                                          | `imports/shared/auth/config.ts`, `imports/server/auth/settings.ts`, `imports/server/auth/testSupport.ts`, `scripts/test-environment.mjs`, `scripts/run-integration-tests.mjs`, `scripts/run-playwright-tests.mjs`, `playwright.config.ts`, `tests/unit/auth-config.test.ts`, `tests/unit/test-launchers.test.ts`, `imports/server/auth/passwordless.app-test.ts` | `docs/AUDIT_004A_Login_Navigation_Fix.md` records the auth/runtime hardening checkpoint and `meteor npm run typecheck` passing. Later database checkpoint evidence in `docs/AUDIT_004A_Database_Topology_Correction.md` records `meteor npm run test:integration` passing with `16 passing`, including `proves the isolated test environment before helpers run`, plus `meteor npm run typecheck` passing.                                                                                    | Satisfied                |
| `/auth/email-link` is account-aware for same-account continuation and different-account switch-or-keep decisions.                                                                                           | `imports/ui/pages/AuthEmailLinkPage.tsx`, `tests/e2e/auth.spec.ts`, `docs/PLATFORM_Authentication.md`                                                                                                                                                                                                                                                            | `docs/AUDIT_004A_HMR_Workaround_Resolution.md` records `npm run test:e2e -- tests/e2e/auth.spec.ts` passing `10` Chromium tests, including the same-account, different-account keep, different-account switch, and invalid different-account recovery cases. The earlier `docs/AUDIT_004A_Login_Navigation_Fix.md` preserves prior-session account-switch subset and bounded-repeat results as historical evidence.                                                                           | Satisfied                |
| Malformed new email-link URLs clear pending tab credentials instead of reusing older stored credentials.                                                                                                    | `imports/ui/pages/AuthEmailLinkPage.tsx`, `tests/e2e/auth.spec.ts`, `docs/PLATFORM_Authentication.md`                                                                                                                                                                                                                                                            | `docs/AUDIT_004A_HMR_Workaround_Resolution.md` records `npm run test:e2e -- tests/e2e/auth.spec.ts` passing `10` Chromium tests, including `does not reuse stored credentials for a malformed new link` and invalid-link recovery without credential leakage.                                                                                                                                                                                                                                 | Satisfied                |
| Isolated integration and Playwright launchers use loopback targets, generated test run IDs, dedicated local directories, inherited Mongo-variable rejection, and Meteor-managed MongoDB identity variables. | `scripts/test-environment.mjs`, `scripts/run-integration-tests.mjs`, `scripts/run-playwright-tests.mjs`, `playwright.config.ts`, `tests/unit/test-launchers.test.ts`, `imports/shared/auth/config.ts`, `imports/shared/auth/testDatabaseIdentity.ts`                                                                                                             | `docs/AUDIT_004A_Database_Topology_Correction.md` records `meteor npm run test:integration` passing with `16 passing`, and `docs/AUDIT_004A_Throttle_Correction.md` records full unit coverage at that checkpoint with `meteor npm run test:unit` passing `57` tests. HMR audit browser evidence confirms the isolated Playwright launcher path remained usable.                                                                                                                              | Satisfied                |
| Rspack local browser-test startup uses supported loopback host/origin handling and a derived dev-server port.                                                                                               | `rspack.config.ts`, `scripts/test-environment.mjs`, `playwright.config.ts`, `scripts/run-playwright-tests.mjs`, `tests/unit/test-launchers.test.ts`, `docs/PLATFORM_Testing.md`                                                                                                                                                                                  | `docs/TEMP_004A_Resume.md` preserves the historical startup smoke: `GET http://127.0.0.1:3200/sign-in` returned `200`, listeners appeared on the expected local app, MongoDB, and Rspack ports, and cleanup left no listeners. `docs/AUDIT_004A_HMR_Workaround_Resolution.md` later records the targeted login browser test and full auth browser suite passing through the same managed local browser-test path.                                                                             | Satisfied                |
| Passwordless auth throttles use documented defaults and reject invalid throttle windows.                                                                                                                    | `imports/shared/auth/config.ts`, `tests/unit/auth-config.test.ts`, `docs/PLATFORM_Authentication.md`                                                                                                                                                                                                                                                             | `docs/AUDIT_004A_Throttle_Correction.md` records `meteor npm run test:unit` passing `6` files and `57` tests, and `meteor npm run typecheck` passing.                                                                                                                                                                                                                                                                                                                                         | Satisfied                |
| Isolated auth test helper database verification supports the observed Meteor-managed topology while rejecting unsafe or ambiguous endpoints.                                                                | `imports/shared/auth/testDatabaseIdentity.ts`, `imports/server/auth/mongoConnectionIdentity.ts`, `imports/server/auth/settings.ts`, `imports/server/auth/testSupport.ts`, `imports/server/auth/passwordless.app-test.ts`, `tests/unit/test-database-identity.test.ts`, `docs/PLATFORM_Authentication.md`, `docs/PLATFORM_Testing.md`                             | `docs/AUDIT_004A_Database_Topology_Correction.md` records `meteor npm run test:unit -- --run tests/unit/test-database-identity.test.ts` passing `1` file and `9` tests; `meteor npm run test:integration` passing with `16 passing`; `meteor npm run typecheck` passing; and no task-owned Meteor/MongoDB processes after the runs. Earlier blocked attempts remain preserved in `docs/AUDIT_004A_Database_Isolation_Verification.md` and `docs/AUDIT_004A_Database_Verification_Closure.md`. | Satisfied                |
| Isolated-E2E reload stabilization must not override `Meteor.isTest`, `Meteor.isDevelopment`, or `Meteor.isProduction`.                                                                                      | `rspack.config.ts`, `tests/e2e/auth.spec.ts`, `docs/PLATFORM_Testing.md`                                                                                                                                                                                                                                                                                         | `docs/AUDIT_004A_HMR_Workaround_Resolution.md` records removal of the `DefinePlugin` replacement of `Meteor.isTest`; `npm run test:e2e -- tests/e2e/auth.spec.ts -g "requests a real email link, redeems it in a fresh browser, restores the session, and signs out"` passing `1` Chromium test; `npm run test:e2e -- tests/e2e/auth.spec.ts` passing `10` Chromium tests; `npm run typecheck` passing; `npm run lint` passing; and the final changed-file Prettier check passing.            | Satisfied                |
| Completion documentation must preserve historical evidence, update maintained docs, report actual checks, and keep task-created prefixed Markdown under `docs/`.                                            | `docs/AUDIT_004A_Completion.md`, `docs/CORE_Build_Plan.md`, `docs/TEMP_004A_Resume.md`, `docs/MAP_System.md`, `docs/PLATFORM_Testing.md`                                                                                                                                                                                                                         | This audit is the numbered CCPP-004A completion report required by `AGENTS.md`. Historical audits remain intact. Changed-file formatting for this closeout is recorded below.                                                                                                                                                                                                                                                                                                                 | Satisfied                |
| Commits, pushes, deployment, production verification, and real email delivery.                                                                                                                              | None in this task.                                                                                                                                                                                                                                                                                                                                               | No existing CCPP-004A acceptance requirement makes these completion gates. The checkpoint audits explicitly record that these actions were not performed.                                                                                                                                                                                                                                                                                                                                     | Explicitly outside scope |
| `RSPACK_NATIVE` replacement investigation.                                                                                                                                                                  | None in this task.                                                                                                                                                                                                                                                                                                                                               | `docs/AUDIT_004A_HMR_Workaround_Resolution.md` records that `RSPACK_NATIVE` was not used because the accepted resolution removed the client identity override and retained scoped Rspack HMR/live-reload suppression.                                                                                                                                                                                                                                                                         | Explicitly outside scope |

## Historical Verification Results

- `docs/AUDIT_004A_Login_Navigation_Fix.md`
  - Preserves prior-session browser evidence for targeted login,
    account-switch/invalid-link subset coverage, a bounded 10/10 repeat, and
    stopped test-owned listeners.
  - Records `meteor npm run typecheck` passing in that checkpoint.
- `docs/AUDIT_004A_Throttle_Correction.md`
  - Records `meteor npm run test:unit` passing `6` files and `57` tests.
  - Records `meteor npm run typecheck` passing.
- `docs/AUDIT_004A_Database_Isolation_Verification.md`
  - Preserves the implemented database identity hardening and the earlier
    zero-test integration blocker.
- `docs/AUDIT_004A_Database_Verification_Closure.md`
  - Preserves the explicit server-test-entry correction and the later
    topology-blocked integration attempts.
- `docs/AUDIT_004A_Database_Topology_Correction.md`
  - Records `RUGBY_ROOSTER_TEST_MONGO_DIAGNOSTICS=1 meteor npm run test:integration`
    producing sanitized topology evidence, followed by the expected failing
    observation run.
  - Records `meteor npm run test:unit -- --run tests/unit/test-database-identity.test.ts`
    passing `1` file and `9` tests.
  - Records `meteor npm run test:integration` passing with `16 passing`.
  - Records `meteor npm run typecheck` passing.
- `docs/AUDIT_004A_HMR_Workaround_Resolution.md`
  - Records the targeted auth browser test passing with normal client identity.
  - Records `npm run test:e2e -- tests/e2e/auth.spec.ts` passing `10`
    Chromium tests.
  - Records `npm run typecheck`, `npm run lint`, and the final changed-file
    Prettier check passing.

These results are historical checkpoint evidence. They were not re-run during
this completion closeout.

## Checks Executed In This Task

No unit, integration, browser, lint, typecheck, deployment, commit, push, or
real-email checks were executed during this completion closeout. The accepted
checkpoint evidence above was sufficient because this task changed documentation
only and the worktree had no uncommitted diffs at the start.

Changed-file formatting for this task:

```sh
npx prettier --check docs/AUDIT_004A_Completion.md docs/CORE_Build_Plan.md docs/TEMP_004A_Resume.md docs/MAP_System.md docs/PLATFORM_Testing.md
npx prettier --write docs/AUDIT_004A_Completion.md docs/CORE_Build_Plan.md docs/TEMP_004A_Resume.md docs/MAP_System.md docs/PLATFORM_Testing.md
npx prettier --check docs/AUDIT_004A_Completion.md docs/CORE_Build_Plan.md docs/TEMP_004A_Resume.md docs/MAP_System.md docs/PLATFORM_Testing.md
```

Results: the first check failed only on `docs/AUDIT_004A_Completion.md`;
Prettier formatted that new audit file; the final check passed.

## Remaining Limitations

- CCPP-004A does not add fixture management, prediction submission, scoring
  persistence, match-event capture, leagues, leaderboards, prizes,
  sponsorships, quizzes, AI reports, payments, or rich admin user management.
- The isolated MongoDB identity guarantee verifies the active endpoint,
  database name, and supported topology used by Meteor. It does not prove the
  MongoDB filesystem storage directory or exclusive process ownership.
- `RSPACK_NATIVE` remains unverified as a replacement because it is no longer
  needed for the accepted implementation.
- Remote GitHub Actions execution remains unobserved from this workspace, as in
  the existing testing platform documentation.
- No commit, push, deployment, production verification, or real email delivery
  was performed for this milestone.

## Completion Verdict

CCPP-004A is complete. All existing acceptance items required by `AGENTS.md`,
the CCPP-004A build-plan scope, and the checkpoint task instructions are
satisfied by preserved historical evidence plus this documentation closeout.
There is no remaining CCPP-004A blocker.
