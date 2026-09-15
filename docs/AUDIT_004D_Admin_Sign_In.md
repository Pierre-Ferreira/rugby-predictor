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
