# Rugby Rooster Email Platform

## Scope

CCPP-004B enables real passwordless sign-in email for manual development while
keeping automated tests local-only. It remains part of Rugby Rooster, the
standalone prediction game, and does not import Rugby Tracker / Rucks and Mauls
email behaviour.

## Delivery Choice

Rugby Rooster uses the Meteor `email` package for the passwordless send path.
The installed app is Meteor `3.5.1` with `email@3.2.0`.

`quave:email-postmark` was checked because its documented settings shape
matches the requested local configuration. Packosphere documents version `1.3.0`
and states that it requires Meteor `email` package `2.2` or above. That version
requirement is compatible with this app, and the existing passwordless path uses
`Email.sendAsync`, which a custom Meteor email transport can intercept.

The package was not retained because its server code throws during package load
when package settings are absent, and its built-in failure path logs raw provider
errors. Those behaviours conflict with Rugby Rooster's required disabled local
development mode and secret-safe delivery failure handling. The application
therefore reads the same familiar settings key itself:

```json
{
  "email": {
    "enabled": true
  },
  "packages": {
    "quave:email-postmark": {
      "apiToken": "REPLACE_LOCALLY",
      "from": "pierre@tektite.biz",
      "supportEmail": "pierre@tektite.biz"
    }
  }
}
```

The adapter posts to Postmark's single-email API using
`X-Postmark-Server-Token`, `From`, `To`, `Subject`, `TextBody`, `HtmlBody`, and
`MessageStream: "outbound"`. `supportEmail` is mapped only to Postmark
`ReplyTo`.

## Configuration

Settings are read from:

- `email.enabled`
- `packages["quave:email-postmark"].apiToken`
- `packages["quave:email-postmark"].from`
- `packages["quave:email-postmark"].supportEmail`
- `private.rugbyRooster.appUrl`
- `private.rugbyRooster.mail.capture`
- `private.rugbyRooster.mail.from`
- `private.rugbyRooster.test.enableTestHelpers`

Delivery precedence is deterministic:

1. Isolated automated auth tests and explicit
   `private.rugbyRooster.mail.capture: true` use local capture and never invoke
   Postmark, even if Postmark credentials are present.
2. `email.enabled: false` in non-production uses local capture and selects no
   external provider. This preserves local no-delivery behaviour without logging
   passwordless links to the console.
3. `email.enabled: true` with capture disabled selects Postmark only when
   `apiToken` and `from` are present and the token is not a placeholder.
4. Enabled Postmark delivery is rejected if `MAIL_URL` or
   `Meteor.settings.packages.email` is also configured.
5. When `email.enabled` is omitted, existing Meteor email behaviour remains:
   `MAIL_URL` or `Meteor.settings.packages.email` selects Meteor's transport;
   otherwise non-production captures locally.
6. Production still rejects local capture, test-helper enablement, disabled
   passwordless delivery, and missing mail transport. Fully configured Postmark
   counts as a production transport.

Missing or placeholder Postmark credentials fail during startup with a sanitized
configuration error. The app does not print API tokens, complete passwordless
login URLs, or raw provider error bodies.

Passwordless email sender selection:

- Postmark `from` is used when configured.
- Otherwise `private.rugbyRooster.mail.from` is used.
- Otherwise Rugby Rooster falls back to a local no-reply address.
- `supportEmail` is added as Reply-To when configured.

## Local Settings

The real local settings path is:

```text
config/local/development.settings.json
```

This path is ignored by Git. A tracked placeholder example lives at:

```text
config/examples/development.postmark.settings.example.json
```

The suggested `private/env/development/settings.json` path was not used because
Meteor treats top-level `private/` as server assets and copies those files into
the application bundle. Local API keys should stay outside Meteor asset
directories.

Start manual development email testing with:

```sh
meteor npm run start:email
```

The script runs:

```sh
ROOT_URL=http://127.0.0.1:3000 meteor run --port 127.0.0.1:3000 --settings config/local/development.settings.json
```

`private.rugbyRooster.appUrl` in that settings file must remain
`http://127.0.0.1:3000` unless the startup command is changed to the same origin.
Open local links on a device that can reach the configured `appUrl`.

## Sender Verification

The Postmark server must be sending-enabled, and `pierre@tektite.biz` must be a
verified sender signature or belong to a verified sending domain in that
Postmark server. Do not commit the API token or include it in review archives.

## Manual Test Steps

1. Replace only `REPLACE_LOCALLY` in
   `config/local/development.settings.json` with the Rugby Rooster Postmark
   server token.
2. Start the app with `meteor npm run start:email`.
3. Open `http://127.0.0.1:3000/sign-in`.
4. Request a sign-in link for an inbox you can check.
5. Confirm the message arrives from `pierre@tektite.biz`.
6. Open the link on a device that can reach `http://127.0.0.1:3000`.
7. Confirm the link redeems and lands on the requested Rugby Rooster route.

Real Postmark delivery remains unverified until the user performs this manual
test with the real API key.

## References

- Packosphere `quave:email-postmark`: https://packosphere.com/quave/email-postmark
- Meteor Email API: https://docs.meteor.com/api/email
- Meteor Assets/private directory behaviour: https://docs.meteor.com/api/assets.html
- Postmark Email API: https://postmarkapp.com/developer/api/email-api
