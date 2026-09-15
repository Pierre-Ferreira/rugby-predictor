# TEMP 004D - Known Navigation Issue

## Status

The CCPP-004D full auth browser suite remains unresolved as of CCPP-004E. This
file exists so later work does not accidentally treat the issue as closed while
PWA foundation work proceeds.

## Known Failure Pattern

The latest documented full-suite runs for:

```sh
meteor npm run test:e2e -- auth.spec.ts
```

executed all 12 auth browser tests with 11 passing and 1 failing. The failing
test changed between runs:

- First full-suite run: `recovers stored email-link credentials after sanitized
same-tab reload`.
- Allowed retry: `continues a same-account session and invalidates that link`.

Both failure artifacts ended on the sanitized `/auth/email-link` route with
missing-details recovery while trace evidence showed local HMR fallback or
hot-code-push activity during assertion windows. The causal relationship remains
unproven.

Targeted same-account invalidation browser coverage passed after the final
CCPP-004D cleanup-order tweak, and Meteor integration tests passed for the
server-side invalidation contract. Those targeted passes do not close the full
auth browser suite blocker.

## Deferral Boundary

CCPP-004E does not investigate or resolve this issue. Do not use the PWA
foundation checks as evidence that the auth browser suite is healthy.

Future investigation should stay within the existing CCPP-004D guardrails:

- Do not add sleeps, larger timeouts, weaker assertions, HMR/Rspack
  configuration changes, database isolation changes, email transport changes,
  dependency changes, or `Meteor.isTest` overrides as a shortcut.
- Do not mark CCPP-004D complete until the required full auth browser suite
  passes on the source state being audited.
- Keep any trace notes sanitized: no login links, email tokens, raw storage
  dumps, secrets, or sensitive settings.
