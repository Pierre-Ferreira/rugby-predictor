# TEMP 004D - Browser Suite Resume Checkpoint

## Current State

CCPP-004D source, server tests, unit test coverage, and the targeted admin
browser test are implemented. September 15, 2026 follow-ups corrected the
browser wait helper argument order, simplified user-facing sign-in/admin access
copy, and made a focused login-link credential cleanup ordering correction.

Passing checks observed on September 15, 2026:

- `meteor npm run test:unit -- --run tests/unit/auth-helpers.test.ts` passed: 1
  file, 5 tests.
- `meteor npm run test:integration` passed: 21 server tests.
- `meteor npm run typecheck` passed.
- `meteor npm run lint` passed.
- `meteor npm run test:e2e -- auth.spec.ts --grep "uses generic admin sign-in acknowledgement"`
  passed: 1 browser test.

Follow-up checks run on September 15, 2026:

- `meteor npm exec prettier -- --write imports/ui/pages/SignInPage.tsx imports/ui/pages/AdminPage.tsx tests/e2e/auth.spec.ts`
  passed.
- `meteor npm run typecheck` passed.
- `meteor npm run lint` passed.
- `meteor npm exec prettier -- --check imports/ui/pages/SignInPage.tsx imports/ui/pages/AdminPage.tsx tests/e2e/auth.spec.ts docs/AUDIT_004D_Admin_Sign_In.md docs/TEMP_004D_Resume.md`
  passed.

Login credential follow-up checks run on September 15, 2026:

- `meteor npm run test:e2e -- auth.spec.ts --grep "blocks forbidden client user updates after sign-in"`
  passed: 1 Chromium test. This was an observation run with temporary
  diagnostics that recorded only lifecycle event names, pathname, and
  credential-presence booleans. It did not reproduce the missing-details
  failure.
- `meteor npm run test:e2e -- auth.spec.ts --grep "blocks forbidden client user updates after sign-in|recovers stored email-link credentials after sanitized same-tab reload"`
  passed: 2 Chromium tests.
- `meteor npm run test:e2e -- auth.spec.ts` failed after all 12 auth browser
  tests executed: 11 passed, 1 failed, 0 skipped.

Final TypeScript, lint, and changed-file formatting checks for this checkpoint
are recorded in `docs/AUDIT_004D_Login_Credential_Correction.md`.

## Remaining Blocker

The full focused browser command:

```sh
meteor npm run test:e2e -- auth.spec.ts
```

remains incomplete in this local workspace. The latest run executed all 12 auth
browser tests with 11 passing, 1 failing, and 0 skipped. The failed test was
`continues an already signed-in same-account session without consuming the link`.

The observed failure sequence was:

- The test signed in, requested a link for the same account, and continued with
  the current session without consuming that link.
- After signing out and reopening the same link, clicking
  `Continue signing in` left the browser at
  `/auth/email-link?returnTo=%2Faccount` instead of `/account`.
- Sanitized artifact metadata from the saved trace still showed local Rspack
  asset churn: 27 `503` occurrences, 3 `ERR_ABORTED` occurrences, and 24
  mentions of `client-rspack` or `build-chunks-local-playwright`. The causal
  relationship to credential loss is unresolved.

The previously reported client-update setup failure did not reproduce after the
credential cleanup ordering correction; the targeted verification for that test
passed. The new same-tab sanitized-link reload regression also passed.

Historical note: an earlier run passed 10 of 11 browser tests, then failed
during the `beforeEach` hook for `blocks forbidden client user updates after
sign-in` while waiting for `window.Meteor` after navigating to `/`. That remains
historical evidence, not the current follow-up failure mode.

## Next Action

Investigate the remaining same-account link reuse failure without adding sleeps,
larger timeouts, weaker assertions, HMR/Rspack configuration changes, database
isolation changes, email transport changes, dependency changes, or
`Meteor.isTest` overrides. Do not mark CCPP-004D complete until the required
full auth browser suite passes.
