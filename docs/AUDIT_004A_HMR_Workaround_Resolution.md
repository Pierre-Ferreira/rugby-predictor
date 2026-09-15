# CCPP-004A HMR Workaround Resolution Audit

Date: 2026-09-15

## Scope

This audit covers only the unaccepted isolated-E2E client identity workaround.
It does not reopen database verification, topology handling, throttles,
scoring, product features, server integration tests, or production delivery.

## Exact Changes

- Removed the `DefinePlugin` import from `rspack.config.ts`.
- Removed the isolated-E2E `DefinePlugin` replacement of `Meteor.isTest`.
- Kept the established Rspack client-development loopback settings:
  `devServer.host = 'localhost'` and
  `allowedHosts = ['localhost', '127.0.0.1']`.
- Kept the narrowly scoped isolated-E2E Rspack controls:
  `hot: false` and `liveReload: false` only when
  `RUGBY_ROOSTER_TEST_MODE=isolated` and
  `RUGBY_ROOSTER_TEST_RUN_ID` starts with `rr-e2e-`.
- Did not use `RSPACK_NATIVE`.
- Did not change `Meteor.isTest`, `Meteor.isDevelopment`, or
  `Meteor.isProduction`.
- Did not change token handling, account-switch behaviour, authentication
  assertions, database verification, server behaviour, or product features.

## Initial Behaviour Without Override

After removing the override, the targeted successful-login browser test passed
with normal client identity.

Command:

```sh
npm run test:e2e -- tests/e2e/auth.spec.ts -g "requests a real email link, redeems it in a fresh browser, restores the session, and signs out"
```

Outcome: Playwright ran 1 Chromium test and passed:

- `passwordless authentication › requests a real email link, redeems it in a fresh browser, restores the session, and signs out`

Because the targeted test passed, no trace-backed failure investigation or
replacement reload control was needed.

## Evidence For Current Control

The evidence supports removing the broad client identity override and retaining
only the existing isolated-E2E Rspack HMR/live-reload suppression. The retained
control is scoped by generated isolated E2E run identity and applies only to
client development builds. Application client identity remains normal.

## Verification

Browser-suite invocation 1:

```sh
npm run test:e2e -- tests/e2e/auth.spec.ts -g "requests a real email link, redeems it in a fresh browser, restores the session, and signs out"
```

Result: 1 passed.

Browser-suite invocation 2:

```sh
npm run test:e2e -- tests/e2e/auth.spec.ts
```

Result: 10 passed.

Executed auth browser tests:

- `passwordless authentication › requests a real email link, redeems it in a fresh browser, restores the session, and signs out`
- `passwordless authentication › denies ordinary players, allows admins, and removes admin access after revocation`
- `passwordless authentication › prompts before switching away from a different signed-in account and can keep the current account`
- `passwordless authentication › switches accounts only after confirmation and follows the safe destination`
- `passwordless authentication › shows honest recovery when a different-account link cannot be redeemed`
- `passwordless authentication › continues an already signed-in same-account session without consuming the link`
- `passwordless authentication › does not reuse stored credentials for a malformed new link`
- `passwordless authentication › shows invalid-link recovery without leaking credentials in the final URL`
- `passwordless authentication › blocks forbidden client user updates after sign-in`
- `passwordless authentication › keeps sign-in usable on mobile and keyboard navigation`

Source checks:

```sh
npm run typecheck
npm run lint
npx prettier --check rspack.config.ts docs/AUDIT_004A_HMR_Workaround_Resolution.md docs/CORE_Build_Plan.md docs/MAP_System.md docs/PLATFORM_Testing.md docs/TEMP_004A_Resume.md
npx prettier --write docs/TEMP_004A_Resume.md
npx prettier --check rspack.config.ts docs/AUDIT_004A_HMR_Workaround_Resolution.md docs/CORE_Build_Plan.md docs/MAP_System.md docs/PLATFORM_Testing.md docs/TEMP_004A_Resume.md
```

Results: TypeScript and lint passed. The first changed-file Prettier check
failed on `docs/TEMP_004A_Resume.md`; Prettier formatted that file, and the
final changed-file Prettier check passed.

The npm/browser output included the existing Node warning that `NO_COLOR` is
ignored when `FORCE_COLOR` is set. It did not fail any check.

## Not Verified

- Full CCPP-004A completion verification outside the focused auth browser suite.
- Database/server integration tests, because this task did not change server
  behaviour and their accepted baseline is preserved.
- `RSPACK_NATIVE`, because it was not needed and remains unverified as a
  replacement.
- Production deployment readiness, external email delivery, commits, pushes, or
  deployment.

## Remaining Work

- Run any broader final CCPP-004A acceptance checks still listed by the active
  plan before declaring the whole CCPP complete.
- Keep the generated review archive with the changed files and focused evidence
  for reviewer handoff.
