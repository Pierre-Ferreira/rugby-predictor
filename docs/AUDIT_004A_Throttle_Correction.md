# AUDIT 004A Throttle Correction

## Scope

This CCPP-004A checkpoint corrects passwordless-auth throttle defaults and
validation only. It does not mark CCPP-004A complete.

No HMR, Rspack reload, browser navigation, database isolation, test launcher,
browser-suite, commit, push, deployment, or email-sending work was performed in
this checkpoint.

## Exact Changes

- `imports/shared/auth/config.ts`
  - Changed the default `redemptionByAddress` limit from 20 to 40.
  - Preserved per-email defaults: `linkRequestByEmail` remains 3 and
    `redemptionByEmail` remains 8.
  - Resolved throttle windows before returning them and rejected values outside
    the documented 1-to-1440-minute range, including tiny values that would
    round down to zero milliseconds.
- `tests/unit/auth-config.test.ts`
  - Added a regression test that locks shared-address link-request and
    redemption defaults to 40 attempts per 15 minutes while preserving per-email
    limits.
  - Added a regression test rejecting sub-minute throttle windows.
- `docs/PLATFORM_Authentication.md`
  - Documented throttle setting names, supported ranges, default limits, and the
    shared-address coherence rule.
- `docs/TEMP_004A_Resume.md`
  - Added this checkpoint and remaining-work status.

## Current Throttle Defaults

- `linkRequestByEmail`: 3 attempts per 15 minutes.
- `linkRequestByAddressAggregate`: 40 attempts per shared address per 15
  minutes.
- `redemptionByEmail`: 8 attempts per 15 minutes.
- `redemptionByAddress`: 40 attempts per shared address per 15 minutes.

## Verification

- `meteor npm run test:unit` passed: 6 test files, 57 tests.
- `meteor npm run typecheck` passed: `tsc --noEmit --incremental false`.

Both commands emitted npm's existing
`Unknown env config "nodedir"` warning.

## Remaining CCPP-004A Work

- The `Meteor.isTest` client override remains unaccepted.
- `RSPACK_NATIVE` was investigated previously but was not established as a
  suitable replacement.
- Rspack reload, Meteor HMR, and Meteor hot-code-push have distinct controls.
- Proposed workarounds must not be treated as implemented or verified until a
  future session explicitly implements and verifies them.
- Final CCPP-004A verification, completion audit, commit, push, and deployment
  remain undone.
