# AUDIT 004D - Same-Account Link Invalidation

## Scope

This CCPP-004D follow-up changes Rugby Rooster's same-account passwordless-link
contract. It does not change Rugby Tracker / Rucks and Mauls behaviour, email
provider configuration, database isolation, HMR configuration, admin grants,
fixture work, PWA work, deployment, or production mail delivery.

## Product Rule

When a verified signed-in user opens a fresh passwordless link for the same
account and chooses **Continue with current session**, Rugby Rooster now keeps
the current session signed in, invalidates that specific link on the server, and
navigates to the safe return path only after the server confirms invalidation.
Reopening that same link after signing out must be rejected with recovery
guidance and requires requesting a new link.

This explicitly replaces the earlier CCPP-004A/004D behaviour that preserved the
unused same-account link.

A fresh valid passwordless link still redeems normally when the user is signed
out.

## Implementation

- Added `auth.invalidateSameAccountSignInLink`.
- The method requires an authenticated verified current account.
- The method validates the submitted email/token credentials and normalizes the
  link email.
- The link email must match a verified email on the current account.
- The submitted token is uppercased and hashed as `SHA256(email + token)`, the
  installed `accounts-passwordless` representation stored in
  `services.passwordless.tokens`.
- Invalidation uses one conditional `Meteor.users.updateAsync` selector covering
  the current user id, verified matching email, unexpired
  `services.passwordless.createdAt`, and the specific matching token element.
- The update unsets only `services.passwordless`, preserving existing login
  sessions and unrelated user fields.
- Invalid, expired, replaced, already-used, anonymous, unverified, and
  different-account attempts do not fall back to ordinary login.

The email-link UI now calls this method for same-account continuation, disables
the button while pending, clears pending link credentials on confirmed success,
and navigates only after the method resolves. Different-account "keep current
account" still clears only tab-held pending credentials and does not invalidate a
link for another account.

## Evidence

The user's manual observation that same-account continuation kept the current
session is recorded as user-reported evidence only. It was not proof that an
explicit server invalidation mechanism already worked, because the previous UI
path only cleared tab state and navigated.

Earlier login-link credential cleanup ordering changes did not establish the
cause of the previous full-suite browser failure. The current implementation
changes the product contract by invalidating the link on the server rather than
trying to preserve and later redeem the same link.

## Verification

Commands run on September 15, 2026:

| Command                                                                                                                                                                                                        | Result                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git status --short` before changes                                                                                                                                                                            | Clean.                                                                                                                                                                                                                                                                                                                                                                                               |
| `meteor npm exec prettier -- --write imports/shared/auth/methods.ts imports/server/auth/methods.ts imports/server/auth/passwordless.app-test.ts imports/ui/pages/AuthEmailLinkPage.tsx tests/e2e/auth.spec.ts` | Passed; `imports/server/auth/passwordless.app-test.ts` was reformatted and the other listed source/test files were unchanged by Prettier.                                                                                                                                                                                                                                                            |
| `meteor npm run typecheck`                                                                                                                                                                                     | Passed.                                                                                                                                                                                                                                                                                                                                                                                              |
| `meteor npm run lint`                                                                                                                                                                                          | Passed.                                                                                                                                                                                                                                                                                                                                                                                              |
| `meteor npm run test:integration`                                                                                                                                                                              | Passed: 24 server tests. New coverage passed for valid same-account invalidation, preserved current session, rejected redemption of the invalidated link, anonymous/unverified/different-account rejection, stale-token protection, and fresh signed-out redemption after invalidation.                                                                                                              |
| `meteor npm run test:e2e -- auth.spec.ts --grep "requests a real email link\|continues a same-account session and invalidates that link"`                                                                      | Passed: 2 Chromium tests. This covered the existing fresh-browser login scenario and the updated same-account continuation/reopen rejection scenario.                                                                                                                                                                                                                                                |
| `meteor npm run test:e2e -- auth.spec.ts`                                                                                                                                                                      | Failed after all 12 auth browser tests executed: 11 passed, 1 failed. The failed test was `recovers stored email-link credentials after sanitized same-tab reload`; the artifact ended authenticated but still at `/auth/email-link?returnTo=%2Faccount` with "This sign-in link is missing details." Trace evidence included local HMR fallback/hot-code-push activity during the URL wait.         |
| `meteor npm run test:e2e -- auth.spec.ts` one justified retry                                                                                                                                                  | Failed after all 12 auth browser tests executed: 11 passed, 1 failed. The previously failed sanitized reload test passed. The failed test was `continues a same-account session and invalidates that link`; the post-sign-out reopen leg ended signed out on the sanitized URL with "This sign-in link is missing details." Trace evidence again included local HMR fallback/hot-code-push activity. |
| `meteor npm run typecheck` after the final same-account success cleanup-order tweak                                                                                                                            | Passed.                                                                                                                                                                                                                                                                                                                                                                                              |
| `meteor npm run lint` after the final same-account success cleanup-order tweak                                                                                                                                 | Passed.                                                                                                                                                                                                                                                                                                                                                                                              |
| `meteor npm exec prettier -- --check imports/ui/pages/AuthEmailLinkPage.tsx`                                                                                                                                   | Passed.                                                                                                                                                                                                                                                                                                                                                                                              |
| `meteor npm run test:e2e -- auth.spec.ts --grep "continues a same-account session and invalidates that link"`                                                                                                  | Passed: 1 Chromium test on the final source state. No further full-suite retry was run.                                                                                                                                                                                                                                                                                                              |

## Status

The same-account invalidation behaviour change is implemented and covered by
passing server integration tests plus the targeted browser scenarios requested
for this change.

CCPP-004D is not marked complete because the required full auth browser suite
did not pass in this workspace after the allowed retry. The remaining blocker is
local browser-suite instability around sanitized email-link pages and hot code
push during assertions, not a reproduced failure of the server-side atomic
invalidation tests.

No real emails were sent. No secrets, captured email contents, login links,
admin grants, commits, pushes, deployments, PWA work, or fixture work were
performed.
