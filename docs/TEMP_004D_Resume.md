# TEMP 004D - Browser Suite Resume Checkpoint

## Current State

CCPP-004D source, server tests, unit test coverage, and the targeted admin
browser test are implemented. The September 15, 2026 follow-up corrected the
browser wait helper argument order and simplified user-facing sign-in/admin
access copy.

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

## Remaining Blocker

The full focused browser command:

```sh
meteor npm run test:e2e -- auth.spec.ts
```

remains incomplete in this local workspace. The follow-up run executed all 11
tests with 9 passing, 2 failing, and 0 skipped. This run did not reproduce the
older `window.Meteor` setup wait.

The current trace-supported blocker is auth-link redemption after the app strips
credential query parameters from `/auth/email-link`:

- Same-account link continuation failed after signing out, reopening the same
  email link, and clicking
  `Continue signing in`. The observed URL stayed
  `/auth/email-link?returnTo=%2Faccount` instead of `/account`. Its trace also
  captured local `GET /__rspack__/build-chunks-local-playwright/main.css` and
  `GET /__rspack__/client-rspack.js` failures with `503 Service Unavailable`
  and `net::ERR_ABORTED`.
- Client update protection setup failed inside `signInWithEmailLink` after
  clicking `Continue signing in`. The observed URL stayed
  `/auth/email-link?returnTo=%2Faccount` instead of `/account`, and the trace
  showed the browser-rendered error `This sign-in link is missing details.`

Historical note: an earlier run passed 10 of 11 browser tests, then failed
during the `beforeEach` hook for `blocks forbidden client user updates after
sign-in` while waiting for `window.Meteor` after navigating to `/`. That remains
historical evidence, not the current follow-up failure mode.

## Next Action

Investigate the email-link credential preservation/cleanup path around
`AuthEmailLinkPage` and the browser helper expectations before declaring
CCPP-004D complete. Do not treat this follow-up as evidence that the underlying
auth browser suite is fixed.
