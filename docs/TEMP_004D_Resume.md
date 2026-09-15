# TEMP 004D - Browser Suite Resume Checkpoint

## Current State

CCPP-004D source, server tests, unit test coverage, and the targeted admin
browser test are implemented. September 15, 2026 follow-ups corrected the
browser wait helper argument order, simplified user-facing sign-in/admin access
copy, made a focused login-link credential cleanup ordering correction, and then
changed the same-account continuation product rule to explicitly invalidate the
presented passwordless link on the server.

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

Same-account invalidation follow-up checks run on September 15, 2026:

- `meteor npm exec prettier -- --write imports/shared/auth/methods.ts imports/server/auth/methods.ts imports/server/auth/passwordless.app-test.ts imports/ui/pages/AuthEmailLinkPage.tsx tests/e2e/auth.spec.ts`
  passed; only `imports/server/auth/passwordless.app-test.ts` changed from
  formatting.
- `meteor npm run typecheck` passed.
- `meteor npm run lint` passed.
- `meteor npm run test:integration` passed: 24 server tests.
- `meteor npm run test:e2e -- auth.spec.ts --grep "requests a real email link\|continues a same-account session and invalidates that link"`
  passed: 2 Chromium tests.
- `meteor npm run test:e2e -- auth.spec.ts` failed after all 12 auth browser
  tests executed: 11 passed, 1 failed. The failed test was
  `recovers stored email-link credentials after sanitized same-tab reload`; the
  artifact ended authenticated but still at
  `/auth/email-link?returnTo=%2Faccount` with "This sign-in link is missing
  details." Trace evidence included local HMR fallback/hot-code-push activity
  during the URL wait.
- One justified retry of `meteor npm run test:e2e -- auth.spec.ts` failed after
  all 12 auth browser tests executed: 11 passed, 1 failed. The previously
  failed sanitized reload test passed. The failed test was
  `continues a same-account session and invalidates that link`; the
  post-sign-out reopen leg ended signed out on the sanitized email-link URL with
  "This sign-in link is missing details." Trace evidence again included local
  HMR fallback/hot-code-push activity.
- After a final same-account success cleanup-order tweak, `meteor npm run
typecheck`, `meteor npm run lint`, and `meteor npm exec prettier -- --check
imports/ui/pages/AuthEmailLinkPage.tsx` passed.
- `meteor npm run test:e2e -- auth.spec.ts --grep "continues a same-account
session and invalidates that link"` passed: 1 Chromium test on the final
  source state. No further full-suite retry was run.

## Remaining Blocker

The full focused browser command:

```sh
meteor npm run test:e2e -- auth.spec.ts
```

remains incomplete in this local workspace. The latest run executed all 12 auth
browser tests with 11 passing, 1 failing, and 0 skipped. The failed test was
`continues a same-account session and invalidates that link`.

The latest observed failure sequence was:

- The test signed in, requested a fresh same-account link, and selected
  `Continue with current session`.
- The targeted same-account browser scenario had already passed, and the first
  full-suite run passed this same test.
- On the allowed full-suite retry, after signing out and reopening the same
  link, clicking `Continue signing in` ended on
  `/auth/email-link?returnTo=%2Faccount` with the missing-details recovery
  state instead of the expected explicit invalid/replaced-link recovery copy.
- The trace included local HMR fallback/hot-code-push activity during the
  assertion window. The causal relationship to the missing-details state remains
  unresolved.

The first full-suite attempt for the same-account invalidation follow-up failed
one different test: `recovers stored email-link credentials after sanitized
same-tab reload`. Its artifact ended authenticated but still on the sanitized
email-link URL with missing-details recovery, also with HMR fallback/hot-code
push evidence. The allowed retry moved that test to pass, then failed the new
same-account invalidation scenario as described above.

The previously reported client-update setup failure did not reproduce after the
credential cleanup ordering correction; the targeted verification for that test
passed. The same-tab sanitized-link reload regression passed in targeted testing
and in the allowed full-suite retry, but failed once in the first full-suite run
for this follow-up.

Historical note: an earlier run passed 10 of 11 browser tests, then failed
during the `beforeEach` hook for `blocks forbidden client user updates after
sign-in` while waiting for `window.Meteor` after navigating to `/`. That remains
historical evidence, not the current follow-up failure mode.

## Next Action

Investigate the remaining sanitized email-link/full-suite instability without
adding sleeps, larger timeouts, weaker assertions, HMR/Rspack configuration
changes, database isolation changes, email transport changes, dependency
changes, or `Meteor.isTest` overrides. Do not mark CCPP-004D complete until the
required full auth browser suite passes.
