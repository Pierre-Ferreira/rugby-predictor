# AUDIT 004C - Development Admin Provisioning

## Scope

CCPP-004C prepares local development platform-admin access before CCPP-005. It
uses the existing Rugby Rooster passwordless account and server-owned
admin-provisioning mechanism. It does not introduce another login flow, change
the role model, create accounts, send emails, commit, push, deploy, or start
CCPP-005.

The confirmed intended development admin login email is `pierre@tektite.biz`.
This address was not inferred from sender configuration; it was confirmed by the
user for this task.

## Existing Mechanism

- `imports/server/auth/accounts.ts` configures `accounts-passwordless`,
  normalizes account email addresses, publishes only `emails` and `roles` for
  the current user, and denies client-side user updates.
- `imports/server/auth/authorization.ts` defines verified-account checks,
  platform-admin checks, `grantPlatformAdminByEmail`,
  `revokePlatformAdminByEmail`, and `provisionPlatformAdminFromSettings`.
- `imports/server/auth/server.ts` validates auth settings, registers auth
  methods, registers isolated test helpers only when permitted, and runs
  `provisionPlatformAdminFromSettings()` during `Meteor.startup`.
- `imports/server/auth/methods.ts` exposes `admin.accessSummary`; the method
  calls `requirePlatformAdmin`, so `/admin` data requires both a verified user
  and a server-owned `roles.platformAdmin` grant.
- `imports/ui/pages/AdminPage.tsx` does not authorize admin access by itself. It
  renders the result of the server-authorized method and shows denied states when
  the server rejects access.

The supported settings schema is:

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

`"action": "revoke"` uses the same email shape to remove the stored grant.

## Configuration Change

Prepared local-only settings file:

```text
config/local/development.settings.json
```

The ignored local settings now include:

```json
{
  "private": {
    "rugbyRooster": {
      "adminProvisioning": {
        "action": "grant",
        "email": "pierre@tektite.biz"
      }
    }
  }
}
```

Existing Postmark credentials, sender settings, app URL settings, and unrelated
local settings were preserved and were not printed into this audit. Ordinary
development test helpers remain disabled.

## Status

| Item                                 | Status                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Configuration prepared               | Confirmed locally in `config/local/development.settings.json`.                                           |
| Grant actually applied               | Not confirmed by Codex. The app was not started and no database mutation was performed during this task. |
| Manual admin check                   | Not confirmed by Codex. The user must sign in and check `/admin`.                                        |
| Manual ordinary-account denial check | Not confirmed by Codex. The user must verify with a separate ordinary account/session.                   |

## User-Reported Manual Verification

On September 15, 2026, the user reported that the intended admin account could
access `/admin` and that an ordinary account was denied access. Codex did not
rerun those CCPP-004C manual checks during CCPP-004D; this note records the
user-reported result only.

If `pierre@tektite.biz` does not already exist as a verified passwordless
account in the local development database, the first startup with this setting
will skip the grant. Complete passwordless sign-in for that email, then restart
the app so startup provisioning can apply the grant to the now-verified account.

## Manual Verification Flow

1. Start or restart the local development app:

   ```sh
   meteor npm run start:email
   ```

2. Sign in with `pierre@tektite.biz` through the existing passwordless flow at
   `http://127.0.0.1:3000/sign-in`.
3. If this is the first verified sign-in for that local account, restart the app
   again with `meteor npm run start:email` so startup provisioning can apply the
   grant.
4. Open `http://127.0.0.1:3000/admin` in the signed-in browser and confirm the
   admin summary loads.
5. In a separate browser profile or private session, sign in with a different
   ordinary verified account.
6. Open `http://127.0.0.1:3000/admin` in that ordinary session and confirm admin
   access is denied.

## Removing The Temporary Grant Instruction

After the admin summary loads for `pierre@tektite.biz`, remove the
`private.rugbyRooster.adminProvisioning` block from
`config/local/development.settings.json`. The successful grant persists because
the implementation stores `roles.platformAdmin: true` on the Meteor user
document.

## Deliberate Revoke Procedure

Do not revoke during normal CCPP-004C setup. To undo the grant deliberately:

1. Change the local settings block to:

   ```json
   {
     "private": {
       "rugbyRooster": {
         "adminProvisioning": {
           "action": "revoke",
           "email": "pierre@tektite.biz"
         }
       }
     }
   }
   ```

2. Restart the local app once with `meteor npm run start:email`.
3. Sign in as `pierre@tektite.biz`, open `/admin`, and confirm access is denied.
4. Remove the temporary `adminProvisioning` block again.

## Verification

Performed in this task:

| Check                                           | Result                                                                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git status --short` before changes             | Clean.                                                                                                                                                                    |
| Redacted local settings inspection              | Confirmed no existing `adminProvisioning`, Postmark settings present, and ordinary development test helpers disabled.                                                     |
| Redacted local settings inspection after update | Confirmed `adminProvisioning.action: "grant"` and `adminProvisioning.email: "pierre@tektite.biz"`; confirmed Postmark token key still present without printing its value. |

Reused historical evidence because no application source code changed:

- `docs/AUDIT_004_Passwordless_Accounts_Authorisation.md` records prior passing
  integration and Playwright coverage for passwordless sign-in, verified-account
  access, admin grant/revocation, denied ordinary-user access, current-user
  publication limits, and blocked client user updates.
- `docs/AUDIT_004A_HMR_Workaround_Resolution.md` records later targeted browser
  coverage passing for admin denial, admin access after grant, and access removal
  after revocation.

No full auth browser pipeline, integration suite, email delivery test, or
database mutation was run for this local settings and documentation task. No
new authentication mechanism, role model, unrestricted client write, test-helper
exposure, production database provisioning, sender-derived grant, domain-derived
grant, or fabricated verified account was introduced.
