# AUDIT 004D - Admin-Specific Passwordless Sign-In

## Scope

CCPP-004D adds an admin-specific passwordless sign-in request path for Rugby
Rooster. It preserves ordinary player sign-in, the existing
`accounts-passwordless` token and redemption mechanism, existing token expiry
and replay behaviour, safe return-path validation, and server-side admin
authorisation.

This task did not change email transport configuration, database isolation,
local admin grants, HMR configuration, fixture/scoring behaviour, deployment, or
Rugby Tracker / Rucks and Mauls concepts.

## Behaviour

- Signed-out visitors to `/admin` are offered the admin sign-in mode at
  `/sign-in?mode=admin&returnTo=/admin`.
- Admin-mode valid submissions show the same acknowledgement:
  “If this account is eligible for admin access, we’ve sent a sign-in link.”
- The acknowledgement shape remains `{ acknowledged: true, expiresInMinutes:
15 }` for eligible admins and ineligible valid addresses.
- Ordinary `/sign-in` remains available for public player accounts and can still
  create or return player accounts for non-admin users.
- Signed-in ordinary users who visit `/admin` remain signed in, see access
  denied, and get an explicit "Use another account" action.

## Server Eligibility

The admin request method `auth.requestAdminSignInLink` delegates to the hardened
passwordless package request wrapper with `returnTo: "/admin"`.

For any admin-directed request, including calls through
`auth.requestSignInLink` or the exposed package method
`requestLoginTokenForUser`, the server:

- Normalizes and validates the email with the existing email helpers.
- Applies the existing per-email and shared-address link-request throttles before
  eligibility is checked.
- Requires an existing account whose exact normalized requested email is
  verified.
- Requires the server-owned `roles.platformAdmin === true` grant.
- Returns the generic acknowledgement without creating an account, generating a
  token, sending mail, or invalidating an existing token when the request is
  ineligible.

Eligible admin-directed requests reuse the existing passwordless token,
delivery, `/auth/email-link`, and package `login` redemption path. Sending or
redeeming a link never grants admin permissions; `admin.accessSummary` still
calls `requirePlatformAdmin` on every request, so revocation after link delivery
prevents admin access.

Delivery failures are logged with a sanitized context/error-code diagnostic.
Admin-directed delivery failures return the same generic acknowledgement to
avoid revealing whether the requested account was eligible. Ordinary player link
requests keep the existing public delivery-failure error.

## Changed Files

- `imports/shared/auth/methods.ts`
- `imports/shared/auth/redirects.ts`
- `imports/server/auth/accounts.ts`
- `imports/server/auth/authorization.ts`
- `imports/server/auth/methods.ts`
- `imports/server/auth/passwordless.app-test.ts`
- `imports/ui/auth/SignOutButton.tsx`
- `imports/ui/components/AuthStates.tsx`
- `imports/ui/pages/AdminPage.tsx`
- `imports/ui/pages/AuthEmailLinkPage.tsx`
- `imports/ui/pages/SignInPage.tsx`
- `tests/e2e/auth.spec.ts`
- `tests/unit/auth-helpers.test.ts`
- `docs/AUDIT_004C_Development_Admin.md`
- `docs/AUDIT_004D_Admin_Sign_In.md`
- `docs/MAP_System.md`
- `docs/PLATFORM_Authentication.md`
- `docs/PLATFORM_Testing.md`
- `docs/TEMP_004D_Resume.md`

## Verification

Commands run on September 15, 2026:

| Command                                                                                                | Outcome                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `git status --short` before changes                                                                    | Clean.                                                                                                                                                                                                                                                                                                                                                       |
| `meteor npm run test:unit -- --run tests/unit/auth-helpers.test.ts`                                    | Passed: 1 file, 5 tests.                                                                                                                                                                                                                                                                                                                                     |
| `meteor npm run test:integration`                                                                      | Passed: 21 server tests.                                                                                                                                                                                                                                                                                                                                     |
| `meteor npm run typecheck`                                                                             | Passed.                                                                                                                                                                                                                                                                                                                                                      |
| `meteor npm run lint`                                                                                  | Initially failed on one task-owned `useMemo` lint issue in `SignInPage.tsx`; after correction, passed.                                                                                                                                                                                                                                                       |
| `meteor npm run lint:project`                                                                          | Passed.                                                                                                                                                                                                                                                                                                                                                      |
| `meteor npm exec prettier -- --write <changed files>`                                                  | Completed; changed files were formatted.                                                                                                                                                                                                                                                                                                                     |
| `meteor npm exec prettier -- --check <changed files>`                                                  | Passed: all matched changed files use Prettier style.                                                                                                                                                                                                                                                                                                        |
| `meteor npm run format:check`                                                                          | Failed on 7 pre-existing files outside CCPP-004D changes: `docs/AUDIT_004A_Database_Isolation_Verification.md`, `docs/AUDIT_004A_Login_Navigation_Fix.md`, `imports/server/auth/mongoConnectionIdentity.ts`, `imports/shared/auth/testDatabaseIdentity.ts`, `playwright.config.ts`, `scripts/test-environment.mjs`, and `tests/unit/test-launchers.test.ts`. |
| `meteor npm run test:e2e -- auth.spec.ts --grep "uses generic admin sign-in acknowledgement"`          | Passed: 1 browser test.                                                                                                                                                                                                                                                                                                                                      |
| `meteor npm run test:e2e -- auth.spec.ts`                                                              | Not fully passed in this local run. Latest run passed 10 of 11 browser tests, then failed in `beforeEach` for `blocks forbidden client user updates after sign-in` while waiting for `window.Meteor` during isolated local app startup. Earlier failed auth-link navigation assertions were corrected and subsequently passed in-suite.                      |
| `meteor npm run test:e2e -- auth.spec.ts --grep "denies ordinary players\|uses generic admin sign-in"` | Not fully passed in this local run: the ordinary/admin denial test passed, then the admin test failed in `beforeEach` waiting for `window.Meteor`. The same admin test passed alone on a fresh launch.                                                                                                                                                       |

## Remaining Limitations

- The full Playwright auth suite has an intermittent local Meteor-client startup
  timeout in this workspace. It is checkpointed in `docs/TEMP_004D_Resume.md`.
- No production email was sent. Automated verification used captured local/test
  mail only.
- No real admin grants were created, revoked, committed, pushed, or deployed.

## Follow-up - 2026-09-15 Browser Wait and Copy Cleanup

Scope:

- Corrected `tests/e2e/auth.spec.ts` so `waitForMeteorClient` passes
  `undefined` as the browser-function argument and
  `{ timeout: NAVIGATION_ATTEMPT_TIMEOUT_MS }` as the third
  `page.waitForFunction` options argument.
- Inspected the other `waitForFunction` calls in `tests/e2e/auth.spec.ts`; no
  matching misplaced-timeout calls were present.
- Preserved the exact admin acknowledgement:
  “If this account is eligible for admin access, we’ve sent a sign-in link.”
- Removed explanatory acknowledgement-equivalence copy from the sign-in success
  state.
- Replaced user-facing platform-admin grant implementation wording in the
  sign-in/admin access UI with plain authorised-account wording.

Commands run on September 15, 2026:

| Command                                                                                                                                                                               | Outcome                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meteor npm exec prettier -- --write imports/ui/pages/SignInPage.tsx imports/ui/pages/AdminPage.tsx tests/e2e/auth.spec.ts`                                                           | Passed; `tests/e2e/auth.spec.ts` was formatted and the two UI files were unchanged by Prettier.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `meteor npm run test:e2e -- auth.spec.ts`                                                                                                                                             | Failed after all 11 tests executed: 9 passed, 2 failed, 0 skipped. This did not reproduce the earlier `window.Meteor` setup wait failure. The failures were URL assertions after clicking `Continue signing in`: `continues an already signed-in same-account session without consuming the link` remained on `/auth/email-link?returnTo=%2Faccount` at `tests/e2e/auth.spec.ts:432`; `blocks forbidden client user updates after sign-in` remained on `/auth/email-link?returnTo=%2Faccount` in `signInWithEmailLink` at line 138.                                               |
| Playwright trace inspection for the 2 browser failures                                                                                                                                | Raw traces were inspected locally and not copied into docs. In the same-account failure, the trace showed local `GET /__rspack__/build-chunks-local-playwright/main.css` and `GET /__rspack__/client-rspack.js` returning `503 Service Unavailable` with `net::ERR_ABORTED`, plus browser console `Failed to load resource` errors; the final observed URL was `/auth/email-link?returnTo=%2Faccount`. In the client-update failure, the trace showed the sanitized URL `/auth/email-link?returnTo=%2Faccount` and the browser error text `This sign-in link is missing details.` |
| `meteor npm run typecheck`                                                                                                                                                            | Passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `meteor npm run lint`                                                                                                                                                                 | Passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `meteor npm exec prettier -- --write imports/ui/pages/SignInPage.tsx imports/ui/pages/AdminPage.tsx tests/e2e/auth.spec.ts docs/AUDIT_004D_Admin_Sign_In.md docs/TEMP_004D_Resume.md` | Passed; docs were formatted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `meteor npm exec prettier -- --check imports/ui/pages/SignInPage.tsx imports/ui/pages/AdminPage.tsx tests/e2e/auth.spec.ts docs/AUDIT_004D_Admin_Sign_In.md docs/TEMP_004D_Resume.md` | Passed: all matched changed files use Prettier style.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Follow-up status:

- CCPP-004D remains open because the required full auth browser suite did not
  pass.
- The new trace-supported blocker is auth-link redemption after credential URL
  cleanup, not the previously observed `window.Meteor` startup wait.
- No retries, timeout increases, weakened assertions, authentication behaviour
  changes, real emails, grant changes, commits, pushes, deployments, PWA work,
  or fixture work were performed in this follow-up.
