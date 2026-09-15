# Rugby Rooster Authentication Platform

## Scope

CCPP-004 implements passwordless account access and server-side authorisation for
Rugby Rooster. It does not implement fixtures, predictions, leagues,
leaderboards, prizes, sponsorships, animation, quizzes, AI reports, payments, or
Rugby Tracker / Rucks and Mauls concepts.

## Account Model

- Players sign in with email links through `accounts-passwordless`.
- Email identity is normalized by trimming whitespace and lowercasing.
- Provider-specific rewrites are not applied; plus addressing remains distinct.
- A link request can create a new account or return an existing player to the
  same account.
- New accounts remain unverified until the player redeems the latest valid email
  link.
- Login sessions expire after 30 days.
- Passwordless links expire after 15 minutes.
- A newer requested link invalidates an older outstanding link for that account.
- Replay, expired, malformed, and unsafe selector redemption attempts are
  rejected by the server.

## Routes

- `/sign-in` - email-link request form.
- `/auth/email-link` - confirmation page for passwordless link redemption.
- `/account` - authenticated verified player account summary.
- `/admin` - restricted platform-admin summary.

The email-link route strips token and email query parameters from the browser URL
after reading them. Pending link credentials are kept only in tab-scoped browser
state so local hot-code-push reloads can finish the same sign-in attempt without
leaving the token in the final URL. Pending credentials are cleared on success,
failure, or malformed new link input.

CCPP-004A adds account-aware confirmation behaviour for the email-link route.
When a verified browser session already matches the link email, the player can
continue with the current session without consuming the link. When a verified
browser session belongs to a different email, the page shows the current account,
the link target account, and explicit choices to switch accounts or keep the
current account. Switching logs out the current session before redeeming the link.

## Server Authority

Authoritative auth code lives under `imports/server/auth/`.

- `accounts.ts` configures accounts, passwordless emails, current-user publish
  fields, Meteor user update denial, package method hardening, link-request
  throttling, redemption throttling, and process-level token redemption locks.
- `methods.ts` registers `auth.requestSignInLink`, `auth.currentAccess`, and
  `admin.accessSummary`.
- `authorization.ts` resolves verified email state and platform-admin grants.
- `settings.ts` reads Rugby Rooster private settings and validates auth runtime
  safety before auth methods and test helpers are registered.
- `mailSink.ts` captures local/test emails without sending real mail.
- `postmarkTransport.ts` installs the guarded Postmark transport only when
  runtime settings select it.
- `testSupport.ts` registers test-only helper methods only when private test
  settings enable them and the app is in a verified isolated test environment.

The raw package method `requestLoginTokenForUser` is wrapped so callers cannot
inject arbitrary selectors, roles, profiles, unsafe return URLs, or privileged
user data. The package `login` method is wrapped for passwordless selectors so
only normalized email selectors are accepted for email-link redemption.

## Authorisation

Current implemented roles:

- Verified player - any signed-in user with a verified account email.
- Platform admin - a verified player with `roles.platformAdmin === true`.

The admin UI is not the authority. It calls `admin.accessSummary`, and the server
requires a verified user plus a platform-admin grant before returning the
summary. Client-side user-document fields are treated as UI hints only.

## Settings

Private settings live under `private.rugbyRooster`:

```json
{
  "private": {
    "rugbyRooster": {
      "appUrl": "http://127.0.0.1:3200",
      "mail": {
        "capture": true,
        "from": "Rugby Rooster <tests@rugbyrooster.local>"
      },
      "test": {
        "enableTestHelpers": true
      }
    }
  }
}
```

Email delivery configuration and precedence are documented in
`docs/PLATFORM_Email.md`. Production mail delivery requires `MAIL_URL`,
Meteor email package settings, or enabled Postmark settings. Production startup
rejects explicit local mail capture, explicit test-helper enablement, disabled
passwordless delivery, missing mail transport, and missing canonical app URL.
Local and test runs capture mail when configured or when no production mail
transport is present.

For Postmark development delivery, the app reads
`email.enabled` and `packages["quave:email-postmark"]` settings directly. The
configured Postmark `from` address is used for passwordless email, and
`supportEmail` is mapped to Reply-To only. Enabled Postmark delivery is rejected
when `MAIL_URL` or `Meteor.settings.packages.email` is also configured.

Auth throttles are configured under `private.rugbyRooster.throttle`. Each
throttle rule accepts `limit` as an integer from 1 to 10000 and `windowMinutes`
from 1 to 1440. Defaults are:

- `linkRequestByEmail`: 3 attempts per 15 minutes.
- `linkRequestByAddressAggregate`: 40 attempts per shared address per 15
  minutes.
- `redemptionByEmail`: 8 attempts per 15 minutes.
- `redemptionByAddress`: 40 attempts per shared address per 15 minutes.

The shared-address link-request and redemption defaults intentionally match so a
supported shared-IP request cohort has a coherent redemption allowance.
Per-email limits remain narrower to protect individual account identities.

Test helpers require `private.rugbyRooster.test.enableTestHelpers: true` plus an
isolated launcher environment with loopback `ROOT_URL`, generated
`RUGBY_ROOSTER_TEST_RUN_ID`, expected MongoDB host, expected MongoDB port,
expected Meteor-managed database name, and current-run ownership checks for
helper mutations. Before helper methods are registered, the server pings the
MongoDB connection used by Meteor, reads the active database name from the
driver `Db`, and reads the connected endpoint from the driver's topology
description. Helper mutations re-check the same active connection identity.
Helpers must not be exposed from ordinary development or production settings.

The isolated-helper database check supports local loopback MongoDB topology
metadata only. It accepts a driver `Single` topology with exactly one reported
endpoint, and the observed Meteor-managed single-node replica set shape:
`ReplicaSetWithPrimary` with one `RSPrimary` server. The active endpoint must
use the exact expected host and port, and the database name must match. The
check recognizes loopback host forms `127.0.0.1`, `localhost`, `::1`, and
`[::1]` only to reject non-loopback endpoints; it does not treat loopback host
aliases as interchangeable. It rejects missing, multiple, SRV, load-balanced,
unknown, non-loopback, wrong-host, wrong-port, wrong-database, and unsupported
topology metadata. This verifies the active endpoint plus database name used by
Meteor; it does not independently prove the MongoDB filesystem storage
directory or exclusive ownership of a MongoDB process.

Optional admin provisioning can grant or revoke `roles.platformAdmin` by verified
email during startup:

```json
{
  "private": {
    "rugbyRooster": {
      "adminProvisioning": {
        "action": "grant",
        "email": "admin@example.test"
      }
    }
  }
}
```

Provisioning skips grant requests when the account does not exist or is not
verified. Settings files must not contain production secrets in source control.
After a grant succeeds, the stored `roles.platformAdmin` flag remains on the
user account; remove the temporary `adminProvisioning` block from local settings
after confirming access. To deliberately undo a grant, change the same block to
`"action": "revoke"` for that verified email, restart the local app once so the
server unsets the stored role, confirm `/admin` is denied, and then remove the
temporary revoke block.

## Verification Coverage

- Unit tests cover email normalization, safe return-path validation, auth runtime
  configuration, isolated test launcher setup, isolated MongoDB identity
  comparison, and throttle configuration.
- Meteor full-app integration tests cover account creation, verification,
  returning-player reuse, resend invalidation, plus addressing, token expiry,
  replay rejection, concurrent redemption, package method hardening, throttling,
  throttle-bucket pruning, test-helper ownership checks, test-helper environment
  reporting, delivery failure, admin grant/revocation, current access, and
  publication field limits.
- Playwright tests cover captured email-link request/redemption, fresh-browser
  login, session restoration, sign-out, admin denial/grant/revocation,
  same-account continuation, different-account switch/keep choices, malformed
  new-link credential clearing, invalid-link recovery, blocked client user
  updates, mobile layout, and keyboard access.

## Current Limits

- No fixture, prediction, league, leaderboard, prize, sponsorship, quiz,
  animation, or AI permissions exist yet.
- Platform-admin grants are a minimal role flag for this milestone. Rich admin
  user management is future work.
- Account deletion, support flows, optional marketing preferences UI, and
  long-term consent/audit policies are future product decisions.
