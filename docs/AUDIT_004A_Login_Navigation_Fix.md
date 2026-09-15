# AUDIT 004A - Login Navigation Fix

## Status

Checkpointed for review on September 15, 2026.

CCPP-004A is not complete and this audit does not mark the current workaround as
accepted. This checkpoint preserves the interrupted-session findings, records one
new TypeScript verification result, documents the current client-side
`Meteor.isTest` override, and packages a focused review archive. No commit,
push, deployment, production target, full suite, or browser-suite rerun was
performed in this checkpoint session.

## Current Change Area

The current diff inspected in this checkpoint includes:

- Loopback Playwright/Meteor launch changes in `playwright.config.ts`,
  `scripts/run-playwright-tests.mjs`, `scripts/run-integration-tests.mjs`, and
  `scripts/test-environment.mjs`.
- Rspack development-server host/origin handling and the client-side
  `Meteor.isTest` override in `rspack.config.ts`.
- Auth email-link page changes in `imports/ui/pages/AuthEmailLinkPage.tsx` for
  same-account continuation, different-account confirmation, invalid-link
  recovery, and malformed-link credential clearing.
- Auth runtime hardening and isolated test-helper ownership checks under
  `imports/shared/auth/config.ts` and `imports/server/auth/`.
- Browser-test updates in `tests/e2e/auth.spec.ts` and
  `tests/e2e/foundation.spec.ts`.
- Generated-output ignore updates in `.gitignore`, `.prettierignore`,
  `eslint.config.mjs`, and `scripts/check-project-invariants.mjs`.

## Prior-Session Reported Results

The following results were reported by the interrupted prior session and were not
re-run during this checkpoint:

- Loopback Rspack host/origin configuration was fixed.
- Redundant cross-test browser-storage clearing was removed.
- A client-side `Meteor.isTest` override was added for isolated E2E runs to
  suppress HMR.
- The targeted successful-login browser test passed.
- The related account-switch and invalid-link browser-test subset passed.
- A bounded repeat of the targeted browser checks passed 10/10 runs.
- Test-owned listeners were confirmed stopped.
- `npm run typecheck` had started, but its result was not captured before remote
  compaction failed.

These are preserved as prior-session reported results only. They are not claimed
as verification performed in this session.

## Verified In This Session

- `AGENTS.md` and `docs/TEMP_004A_Resume.md` were read.
- The current Git diff and untracked CCPP-004A files were inspected.
- `meteor npm run typecheck` was run once.

TypeScript check result:

- Command: `meteor npm run typecheck`
- Result: passed with exit code 0.
- Output included npm's existing `Unknown env config "nodedir"` warning.
- Script executed: `tsc --noEmit --incremental false`.

No browser suite, full test suite, lint, formatter, integration suite, commit,
push, or deployment was run in this checkpoint session.

## Exact Meteor.isTest Override

The override is injected in `rspack.config.ts`.

The current gate is:

```ts
const isIsolatedE2eRun =
  process.env.RUGBY_ROOSTER_TEST_MODE === 'isolated' &&
  process.env.RUGBY_ROOSTER_TEST_RUN_ID?.startsWith('rr-e2e-') === true;
const shouldDisableClientHmr =
  Meteor.isClient && Meteor.isDevelopment && isIsolatedE2eRun;
```

When `shouldDisableClientHmr` is true, the Rspack client development server also
sets:

```ts
devServer: {
  allowedHosts: ['localhost', '127.0.0.1'],
  host: 'localhost',
  hot: false,
  liveReload: false,
}
```

The `Meteor.isTest` client override is injected through Rspack's `DefinePlugin`:

```ts
new DefinePlugin({
  'Meteor.isTest': JSON.stringify(true),
});
```

The intended application path for this gate is the isolated Playwright launcher:

- `scripts/run-playwright-tests.mjs` creates an isolated environment with
  `kind: 'e2e'`.
- `scripts/test-environment.mjs` sets
  `RUGBY_ROOSTER_TEST_MODE=isolated` and a run id beginning with `rr-e2e-`.
- `playwright.config.ts` passes those values to the managed Meteor web server
  when Playwright starts it.

The override applies only when the Rspack config is evaluated for a client
development build under that isolated E2E environment. It should not apply to
production builds, server bundles, normal local development, or integration test
runs whose ids begin with `rr-integration-`.

## Framework-Behavior Caveat

This override changes a Meteor framework flag in the bundled client code. That
may affect any application code or package code that branches on `Meteor.isTest`,
and because the value is injected at build time it may also influence conditional
bundling or dead-code elimination. The same gate disables Rspack hot module
replacement and live reload for isolated E2E runs.

Passing browser tests is not enough to accept this as the final CCPP-004A
solution. A future review should confirm whether this is a supported
Meteor/Rspack boundary, whether there is a narrower supported way to suppress
the reload behaviour that destabilized tests, and whether any client package
logic changes when `Meteor.isTest` is forced to `true`.

## Review Package

Archive:

- `/tmp/rugby-rooster-ccpp004a-review-20260915.zip`
- Verified with `unzip -tq`; no compressed-data errors were detected.
- Verified with `zipinfo -t`; the archive contains 39 files.

The focused review ZIP for this checkpoint includes:

- This audit and `docs/TEMP_004A_Resume.md`.
- `rspack.config.ts`, `playwright.config.ts`, and changed launcher/test
  environment scripts.
- Current auth browser tests and `AuthEmailLinkPage.tsx`.
- Supporting auth/runtime source needed to understand the isolated E2E override
  and email-link behaviour.

The package must exclude credentials, tokens, captured mail, databases, traces,
generated builds, dependency directories, and other generated artifacts.
The reviewed archive entry list contains no such generated or credential-bearing
paths.

## Open Review Items

- Decide whether the `Meteor.isTest` client override is acceptable, needs a
  narrower implementation, or should be replaced with a supported Meteor/Rspack
  mechanism.
- Re-run the browser checks only in a future session that explicitly resumes
  verification.
- Re-run the normal final verification set only after the workaround review is
  resolved.
- Do not mark CCPP-004A complete until the workaround decision and full
  verification are documented.
