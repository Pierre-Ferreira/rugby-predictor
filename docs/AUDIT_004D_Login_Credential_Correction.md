# AUDIT 004D - Login Credential Correction

## Scope

This follow-up investigated lost passwordless login-link credentials in Rugby
Rooster's `/auth/email-link` browser flow. It stayed within CCPP-004D auth
browser behavior and did not change PWA, fixture, scoring, database isolation,
email transport, HMR/Rspack configuration, dependencies, real admin grants,
deployment, or Rugby Tracker / Rucks and Mauls behavior.

## Observed Event Sequence

The targeted observation run for
`blocks forbidden client user updates after sign-in` did not reproduce the
missing-details failure. Temporary isolated diagnostics recorded only lifecycle
event names, pathname, and credential-presence booleans. No emails, tokens,
full query strings, storage contents, or complete login links were recorded.

The healthy observed sequence was:

1. `/auth/email-link` loaded with both query credential booleans present.
2. The page stored pending credentials in tab-scoped storage before URL cleanup.
3. The URL was sanitized to `/auth/email-link?returnTo=%2Faccount`; query
   credential booleans became false while stored and component credential
   booleans remained true.
4. Clicking `Continue signing in` began redemption with component and stored
   credentials still present.
5. Redemption succeeded, then credentials were cleared and the URL moved to
   `/account`.

The full-suite run after the correction failed a different auth browser path:

1. The same-account test signed in, requested a link for the same account, and
   used `Continue with current session` without consuming that link.
2. The test signed out, reopened the same link, clicked `Continue signing in`,
   and expected `/account`.
3. The browser remained on `/auth/email-link?returnTo=%2Faccount`.
4. The saved Playwright artifact metadata still showed local browser-run asset
   churn: `1-trace.network` contained 27 `503` occurrences, 3 `ERR_ABORTED`
   occurrences, and 24 mentions of `client-rspack` or
   `build-chunks-local-playwright`. The causal relationship to credential loss
   remains unresolved.

## Established Cause And Correction

The corrected defect was a cleanup-ordering weakness in the successful
redemption paths. Before this follow-up, `/auth/email-link` cleared pending
tab-scoped credentials before initiating the SPA route change. If the local
browser document was interrupted while it was still on the sanitized email-link
route, the page could render the missing-details state with no credential copy
left in the URL or tab storage.

The correction is intentionally small:

- Successful anonymous redemption now marks navigation in progress, navigates to
  the safe return path, and then clears pending credentials.
- Successful explicit account switching uses the same ordering.
- Malformed new links still clear pending credentials.
- Invalid, expired, and replayed token handling still clears credentials and
  shows the existing invalid-link recovery.
- Credentials are still stored only in module state plus tab-scoped
  `sessionStorage`; no persistent `localStorage` credential storage was added.
- Token redemption is not automatically retried after an uncertain outcome.

The remaining same-account full-suite failure is an unresolved blocker, not a
completed root-cause closure.

## Files Changed

- `imports/ui/pages/AuthEmailLinkPage.tsx` - moved credential cleanup after the
  successful navigation call in both redemption success paths.
- `tests/e2e/auth.spec.ts` - added a focused browser regression for recovering
  tab-scoped credentials after the email-link URL has been sanitized and the tab
  reloads before redemption.
- `docs/AUDIT_004D_Login_Credential_Correction.md` - this follow-up audit.
- `docs/TEMP_004D_Resume.md` - updated checkpoint and remaining blocker.
- `docs/AUDIT_004D_Admin_Sign_In.md` - added a short reference to this
  follow-up.

Maintained authentication documentation was not changed because the intended
user-facing behavior remains the same: credentials are hidden from the URL,
same-tab reload recovery is supported before redemption, and pending credentials
are cleared after successful redemption or failure paths.

## Regression Coverage

Added browser regression:

- `recovers stored email-link credentials after sanitized same-tab reload`

The regression requests a real captured link, opens it, verifies the final URL
has no email/token query credentials, verifies tab-scoped storage contains a
pending credential record, reloads the same sanitized tab, redeems the link, and
verifies the account page is reached and pending storage is cleared.

Existing malformed-link and same-account tests were preserved.

## Verification

Commands run on September 15, 2026:

| Command                                                                                                                                                                                                      | Result                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git status --short`                                                                                                                                                                                         | Clean before this follow-up's edits.                                                                                                                                                                                                                                                                                                         |
| `git diff --stat`                                                                                                                                                                                            | No output before this follow-up's edits.                                                                                                                                                                                                                                                                                                     |
| `meteor npm run test:e2e -- auth.spec.ts --grep "blocks forbidden client user updates after sign-in"`                                                                                                        | Observation run passed: 1 Chromium test. Temporary diagnostics showed the healthy credential lifecycle listed above. The temporary diagnostic edit also produced a TypeScript checker message about a temporary duplicate window-field type; the diagnostics were removed before final edits.                                                |
| `meteor npm run test:e2e -- auth.spec.ts --grep "blocks forbidden client user updates after sign-in\|recovers stored email-link credentials after sanitized same-tab reload"`                                | Targeted verification passed: 2 Chromium tests.                                                                                                                                                                                                                                                                                              |
| `meteor npm run test:e2e -- auth.spec.ts`                                                                                                                                                                    | Failed: 11 passed, 1 failed, 0 skipped. The failed test was `continues an already signed-in same-account session without consuming the link`, which remained on `/auth/email-link?returnTo=%2Faccount` after clicking `Continue signing in` during the post-sign-out reuse leg. The required full auth browser suite therefore did not pass. |
| `unzip -l test-results/auth-passwordless-authenti-f544e--without-consuming-the-link-chromium/trace.zip`                                                                                                      | Confirmed the failed full-suite run produced a Playwright trace archive. The archive itself is not included in the review ZIP.                                                                                                                                                                                                               |
| `unzip -p test-results/auth-passwordless-authenti-f544e--without-consuming-the-link-chromium/trace.zip 1-trace.network \| rg -c "503"`                                                                       | Reported 27 sanitized `503` occurrences in the saved network trace metadata.                                                                                                                                                                                                                                                                 |
| `unzip -p test-results/auth-passwordless-authenti-f544e--without-consuming-the-link-chromium/trace.zip 1-trace.network \| rg -c "ERR_ABORTED"`                                                               | Reported 3 sanitized `ERR_ABORTED` occurrences in the saved network trace metadata.                                                                                                                                                                                                                                                          |
| `unzip -p test-results/auth-passwordless-authenti-f544e--without-consuming-the-link-chromium/trace.zip 1-trace.network \| rg -c "client-rspack\|build-chunks-local-playwright"`                              | Reported 24 sanitized local Rspack asset mentions in the saved network trace metadata.                                                                                                                                                                                                                                                       |
| `meteor npm exec prettier -- --write imports/ui/pages/AuthEmailLinkPage.tsx tests/e2e/auth.spec.ts docs/AUDIT_004D_Login_Credential_Correction.md docs/TEMP_004D_Resume.md docs/AUDIT_004D_Admin_Sign_In.md` | Passed. Prettier left the source/test files unchanged and formatted updated docs.                                                                                                                                                                                                                                                            |
| `meteor npm run typecheck`                                                                                                                                                                                   | Passed.                                                                                                                                                                                                                                                                                                                                      |
| `meteor npm run lint`                                                                                                                                                                                        | Passed.                                                                                                                                                                                                                                                                                                                                      |
| `meteor npm exec prettier -- --check imports/ui/pages/AuthEmailLinkPage.tsx tests/e2e/auth.spec.ts docs/AUDIT_004D_Login_Credential_Correction.md docs/TEMP_004D_Resume.md docs/AUDIT_004D_Admin_Sign_In.md` | Passed: all matched files use Prettier style.                                                                                                                                                                                                                                                                                                |

## Current Status

CCPP-004D is not complete. The client-update setup path and the new
same-tab-reload regression passed after the correction, but the required full
auth browser suite failed one same-account link reuse test. The remaining
blocker is preserved as unresolved instead of being treated as fixed by the
targeted pass.
