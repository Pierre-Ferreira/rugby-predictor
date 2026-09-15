# CCPP-004B Development Email Audit

## Scope

CCPP-004B enables Postmark-backed passwordless emails for manual Rugby Rooster
development while preserving local capture and zero external delivery in
automated tests. It does not send real email, commit, push, deploy, or start
CCPP-005.

## Package And Adapter Decision

The app runs Meteor `3.5.1` with `email@3.2.0`. `quave:email-postmark@1.3.0`
was checked and is compatible with the installed Meteor email package version
requirement because it documents `email@2.2` or above.

The package was not retained. Local inspection showed that it throws during
package load when `packages["quave:email-postmark"].apiToken` is absent, and its
error path can log raw provider errors. Those behaviours conflict with required
ordinary development modes where `email.enabled` can be false or credentials can
be absent, and with the requirement not to log secrets, raw provider errors, or
complete passwordless URLs.

Rugby Rooster instead implements a small server-side Postmark adapter that reads
the same requested settings shape. The adapter is configured only after the
shared auth runtime configuration selects Postmark.

## Implemented Behaviour

| Requirement                                                                                                                       | Result                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Isolated automated tests capture locally and never call Postmark.                                                                 | Satisfied. Capture and isolated helper settings take precedence over Postmark credentials.                                             |
| Manual development with `email.enabled: true` delivers through Postmark when valid settings are supplied and capture is disabled. | Satisfied. Postmark is selected only with a real token and sender.                                                                     |
| Development with `email.enabled: false` performs no external delivery.                                                            | Satisfied. Non-production disabled email uses local capture and no provider.                                                           |
| Missing or placeholder credentials fail clearly.                                                                                  | Satisfied. Startup validation rejects missing or placeholder `apiToken` and missing `from` without printing values.                    |
| Production safeguards are preserved.                                                                                              | Satisfied. Production rejects capture, test helpers, disabled passwordless delivery, and missing transport.                            |
| Postmark is recognized as a valid transport.                                                                                      | Satisfied. Fully configured Postmark sets `mailTransportProvider: "postmark"`.                                                         |
| Duplicate delivery is prevented.                                                                                                  | Satisfied. Enabled Postmark rejects `MAIL_URL` and `Meteor.settings.packages.email`.                                                   |
| Configured sender is used.                                                                                                        | Satisfied. Passwordless email options explicitly set From from Postmark settings, then private mail settings, then the local fallback. |
| `supportEmail` is mapped only to a supported purpose.                                                                             | Satisfied. It is used as Reply-To.                                                                                                     |
| Raw tokens, full login URLs, credentials, and raw provider errors are not logged.                                                 | Satisfied in the app adapter and tested for provider failure messages.                                                                 |

## Local Configuration

Real local settings path:

```text
config/local/development.settings.json
```

Tracked example:

```text
config/examples/development.postmark.settings.example.json
```

`config/local/*.json` is ignored by Git. The local settings file uses
`REPLACE_LOCALLY` until the user inserts the real Postmark server token.

The settings file is intentionally not under `private/` because Meteor copies
top-level `private/` files into server assets for the application bundle.

Startup command:

```sh
meteor npm run start:email
```

Expanded command:

```sh
ROOT_URL=http://127.0.0.1:3000 meteor run --port 127.0.0.1:3000 --settings config/local/development.settings.json
```

The configured `private.rugbyRooster.appUrl` matches the runtime `ROOT_URL` and
port: `http://127.0.0.1:3000`.

## Manual Test Steps

1. Insert the Rugby Rooster Postmark server token into
   `config/local/development.settings.json`.
2. Start the app with `meteor npm run start:email`.
3. Open `http://127.0.0.1:3000/sign-in`.
4. Request a sign-in link.
5. Check the inbox for delivery from `pierre@tektite.biz`.
6. Open the link on a device that can reach `http://127.0.0.1:3000`.
7. Confirm the sign-in link redeems and lands on the intended Rugby Rooster
   route.

Sender verification requirement: `pierre@tektite.biz` must be verified in the
dedicated Rugby Rooster Postmark server, either as a sender signature or through
a verified sending domain.

Real delivery remains unverified until the user performs the manual test with
the real API key.

## Verification

Commands run:

| Command                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meteor npm run test:unit -- --run tests/unit/auth-config.test.ts tests/unit/postmark-email.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Passed. 2 files, 20 tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `meteor npm run typecheck`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `meteor npm run lint`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `meteor npm run lint:project`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Passed. Project invariant check passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `meteor npm run test:integration`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Passed. 16 server tests, 16 passing. Client tests skipped by the integration launcher with `TEST_CLIENT=0`.                                                                                                                                                                                                                                                                                                                                                                                         |
| `git check-ignore -v config/local/development.settings.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Passed. `.gitignore:13:config/local/*.json` ignores the local settings file.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `meteor npm exec prettier -- --check package.json imports/shared/auth/config.ts imports/shared/auth/postmark.ts imports/server/auth/settings.ts imports/server/auth/accounts.ts imports/server/auth/mailSink.ts imports/server/auth/testSupport.ts imports/server/auth/postmarkTransport.ts tests/unit/auth-config.test.ts tests/unit/postmark-email.test.ts config/examples/development.postmark.settings.example.json docs/PLATFORM_Email.md docs/AUDIT_004B_Development_Email.md docs/PLATFORM_Authentication.md docs/PLATFORM_Testing.md docs/MAP_System.md` | Passed. All matched CCPP-004B files use Prettier style.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `meteor npm run format:check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Failed on 9 pre-existing CCPP-004A files outside this task: `docs/AUDIT_004A_Database_Isolation_Verification.md`, `docs/AUDIT_004A_Login_Navigation_Fix.md`, `imports/server/auth/mongoConnectionIdentity.ts`, `imports/server/auth/passwordless.app-test.ts`, `imports/shared/auth/testDatabaseIdentity.ts`, `imports/ui/pages/AuthEmailLinkPage.tsx`, `playwright.config.ts`, `scripts/test-environment.mjs`, `tests/unit/test-launchers.test.ts`. These files were not reformatted in CCPP-004B. |

No real emails were sent. The real local settings file and API token are not to
be included in the EOMD review ZIP.

## Follow-Up Status

CCPP-005 remains paused until the user manually verifies real development email.

## References

- Packosphere `quave:email-postmark`: https://packosphere.com/quave/email-postmark
- Meteor Email API: https://docs.meteor.com/api/email
- Meteor Assets/private directory behaviour: https://docs.meteor.com/api/assets.html
- Postmark Email API: https://postmarkapp.com/developer/api/email-api
