# AUDIT 004 - Passwordless Accounts And Authorisation

## Status

Completed locally on September 15, 2026.

CCPP-004 implements passwordless email-link accounts, verified player access,
and a server-authorised platform-admin boundary for Rugby Rooster. No commit,
push, deployment, real email delivery, production target testing, fixture
management, prediction submission, leaderboard logic, AI integration, payment
feature, or Rugby Tracker / Rucks and Mauls functionality was performed.

## Requirement Map

| Requirement area                                     | Status | Evidence                                                                                                                  |
| ---------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| Preserve Rugby Rooster product boundary              | Met    | Auth docs, UI, tests, package name, and copy remain Rugby Rooster-specific.                                               |
| Passwordless accounts                                | Met    | `accounts-passwordless`, `/sign-in`, `/auth/email-link`, server account configuration, and browser/integration tests.     |
| No real email delivery during verification           | Met    | Test settings enable local mail capture; tests inspect captured mail only.                                                |
| Safe email identity handling                         | Met    | Shared helpers normalize whitespace/case and preserve plus addressing; unit and integration tests cover this.             |
| Safe return paths                                    | Met    | `resolveSafeReturnPath` allows known local routes/query values and rejects external/control-character destinations.       |
| Server-owned auth operations                         | Met    | Meteor methods and wrapped package handlers sanitize requests, throttle attempts, and perform server-side checks.         |
| Direct package method hardening                      | Met    | Integration tests reject arbitrary selectors and malicious user data.                                                     |
| Token expiry, replay, resend, and concurrency safety | Met    | Integration tests cover expired, replayed, stale, and concurrent redemption behavior.                                     |
| Verified account access                              | Met    | `/account` requires authenticated verified email before showing player details.                                           |
| Admin authorisation                                  | Met    | `admin.accessSummary` requires a verified platform-admin grant; browser and integration tests cover grant and revocation. |
| Client write restrictions                            | Met    | `Meteor.users.deny({ update: () => true })`; Playwright verifies forbidden client updates fail.                           |
| Narrow current-user publication fields               | Met    | Accounts publish only `emails` and `roles`; integration and browser tests verify no `services` exposure.                  |
| Test-only helper safety                              | Met    | Helpers require private test settings, non-production runtime, and `@example.test` identities.                            |
| Documentation and audit                              | Met    | README, product, build-plan, architecture, authentication, testing, map, and this audit were updated.                     |

## Files Changed

- `.github/workflows/verification.yml`
- `.gitignore`
- `.meteor/.gitignore`
- `.meteor/packages`
- `.meteor/versions`
- `.prettierignore`
- `AGENTS.md`
- `README.md`
- `docs/AUDIT_004_Passwordless_Accounts_Authorisation.md`
- `docs/CORE_Build_Plan.md`
- `docs/CORE_Product.md`
- `docs/MAP_System.md`
- `docs/PLATFORM_Architecture.md`
- `docs/PLATFORM_Authentication.md`
- `docs/PLATFORM_Testing.md`
- `eslint.config.mjs`
- `imports/server/auth/`
- `imports/shared/auth/`
- `imports/shared/routes.ts`
- `imports/shared/types/meteor-passwordless.d.ts`
- `imports/ui/App.tsx`
- `imports/ui/auth/`
- `imports/ui/components/AuthStates.tsx`
- `imports/ui/layouts/AdminLayout.tsx`
- `imports/ui/layouts/PublicLayout.tsx`
- `imports/ui/navigation.ts`
- `imports/ui/pages/AccountPage.tsx`
- `imports/ui/pages/AdminPage.tsx`
- `imports/ui/pages/AuthEmailLinkPage.tsx`
- `imports/ui/pages/HomePage.tsx`
- `imports/ui/pages/SignInPage.tsx`
- `package-lock.json`
- `package.json`
- `playwright.config.ts`
- `scripts/check-project-invariants.mjs`
- `server/main.ts`
- `tests/e2e/auth.spec.ts`
- `tests/e2e/foundation.spec.ts`
- `tests/settings/integration-settings.json`
- `tests/settings/playwright-settings.json`
- `tests/unit/auth-helpers.test.ts`
- `tests/unit/routes.test.ts`
- `tsconfig.json`

## Implemented Behavior

- `auth.requestSignInLink` accepts an email and safe return path, then delegates
  to the hardened package request method.
- The passwordless package request path accepts only normalized email selectors,
  strips malicious user data, applies email/address throttles, and returns the
  same acknowledgement for new and returning players.
- Login accepts passwordless email selectors only for token redemption and
  applies email/address throttles plus a process-level lock for concurrent use
  of the same token.
- Passwordless email templates use Rugby Rooster copy and include a canonical
  `/auth/email-link` URL with `email`, `token`, and safe `returnTo` query
  values.
- The email-link page removes `email` and `token` from the URL after reading
  them. Pending credentials are kept in tab-scoped `sessionStorage` only while
  redemption is pending, so local hot-code-push reloads do not strand a valid
  sign-in attempt.
- `/account` shows verified player account details and sign-out.
- `/admin` shows a server-authorised summary only to verified platform admins.
- Test settings use local mail capture and gated helper methods; no real emails
  are sent by tests.

## Verification Commands

| Command                           | Result | Evidence                                                                          |
| --------------------------------- | ------ | --------------------------------------------------------------------------------- |
| `meteor npm run format:check`     | Passed | Prettier reported all matched files use code style after formatting the audit.    |
| `meteor npm run lint`             | Passed | ESLint completed with no findings after the browser-test helper fixes.            |
| `meteor npm run lint:project`     | Passed | Project invariant check passed.                                                   |
| `meteor npm run typecheck`        | Passed | `tsc --noEmit --incremental false` completed after the browser-test helper fixes. |
| `meteor npm run test:unit`        | Passed | 4 unit-test files and 44 tests passed.                                            |
| `meteor npm run test:integration` | Passed | 11 Meteor app server tests passed.                                                |
| `meteor npm run test:e2e`         | Passed | 14 Playwright Chromium tests passed after local-navigation helper hardening.      |

The recurring npm warning `Unknown env config "nodedir"` appeared during Meteor
npm commands and did not fail verification.

The final Playwright command ran against the Playwright-managed local Meteor
server on `127.0.0.1`; no remote browser target or production host was used.
Remote GitHub Actions execution was not observed from this workspace.

## Earlier Failed Checks And Fixes

- Initial `meteor npm run format:check` failed on interrupted-session formatting
  drift. `meteor npm run format` was run and the final formatting check passed.
- Initial `meteor npm run lint:project` entered generated
  `.meteor/local-playwright/` output. The project-invariant ignore list was
  updated and the final project check passed.
- Initial `meteor npm run lint` entered generated `_build-local-playwright/`
  output. ESLint ignores were updated and the final lint passed.
- Initial Playwright attempts reused or started unstable generated
  Meteor/Rspack output. Generated local build directories were cleared, and
  `.prettierignore`, `tsconfig.json`, and project-invariant ignores now exclude
  local browser-test build output.
- A later Playwright run exposed Meteor/Rspack hot-code-push updates during
  tests. `AuthEmailLinkPage` now preserves pending credentials across a
  tab-local hot-code-push reload, and auth e2e navigation retries local
  `net::ERR_ABORTED` page loads once.
- The resumed finalisation `meteor npm run format:check` failed only because
  this audit needed Prettier wrapping. `meteor npm run format` updated the audit,
  and the final formatting check passed.
- The resumed finalisation Playwright run failed once with 13 passed and 1
  timeout during initial navigation to `/sign-in?returnTo=/account`. The auth
  browser helper now waits for `domcontentloaded` plus the Meteor client API
  instead of the full load event, with a bounded retry for local navigation
  aborts/timeouts.
- The next Playwright run failed once with 13 passed and 1 `beforeEach` failure
  because a local hot-code-push navigation destroyed the page context during a
  test-helper Meteor method call. Helper Meteor method calls now retry once only
  for that transient context-destruction case; actual method errors are still
  surfaced to the test.

## Security Notes

- `insecure` and `autopublish` remain absent.
- No unrestricted client database writes were added.
- Admin data is not authorised by client checks; `admin.accessSummary` enforces
  server-side verified-player and platform-admin requirements.
- The current-user publication field set is intentionally narrow: `emails` and
  `roles` only.
- Test helpers are unavailable unless private local settings explicitly enable
  them and `Meteor.isProduction` is false.
- Source and documentation contain no production mail credentials, tokens, or
  captured email contents.

## Remaining Limitations

- Fixture management, prediction submission, scoring persistence, match-event
  capture, leagues, leaderboards, prizes, sponsorships, animation, quizzes, AI,
  payments, and rich admin user management remain future milestones.
- Account deletion, support workflows, marketing preference UI, and long-term
  consent/audit policy remain unresolved product decisions.
- Remote GitHub Actions execution was not observed from this workspace.
- Existing CCPP-002 development dependency maintenance findings remain
  unresolved.

## EOMD Handover

Archive:

- `/tmp/rugby-rooster-ccpp004-eomd-20260915.zip`
- Verified with `unzip -tq`; no compressed-data errors were detected.
- Verified with `zipinfo -1`; the archive contains 113 repository-relative
  entries.
- A forbidden-entry scan found no dependency directories, generated browser
  traces, generated local builds, local Meteor databases, temp checkpoints,
  `.env` files, image/video trace artifacts, SQLite/DB files, or log files.

Important review paths:

- `docs/PLATFORM_Authentication.md`
- `imports/server/auth/`
- `imports/shared/auth/`
- `imports/ui/pages/SignInPage.tsx`
- `imports/ui/pages/AuthEmailLinkPage.tsx`
- `imports/ui/pages/AccountPage.tsx`
- `imports/ui/pages/AdminPage.tsx`
- `imports/server/auth/passwordless.app-test.ts`
- `tests/e2e/auth.spec.ts`
- `tests/unit/auth-helpers.test.ts`
