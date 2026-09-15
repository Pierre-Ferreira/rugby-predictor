# AUDIT 005 - Fixture Management And Public Browsing

## Summary

CCPP-005 implements the first Rugby Rooster fixture workflow. Platform admins
can create, edit, publish, and cancel fixtures. Anonymous visitors can browse
published upcoming and past scheduled fixtures and open public fixture detail
routes under `/games/:fixtureId`.

Rugby Rooster remains separate from Rugby Tracker / Rucks and Mauls.

## Implementation Evidence

Implemented:

- Fixture collection `fixtures`.
- Server-authorized admin methods for create draft, edit details, publish, and
  cancel.
- Explicit public and admin publications.
- Conditional writes for edit, publish, and cancel.
- Ruleset snapshot attachment at first publication.
- South African time admin entry conversion to UTC storage.
- Admin fixture list/form/status/actions inside the existing admin area.
- Public `/games` fixture browsing and `/games/:fixtureId` detail pages.
- Test-only fixture helpers gated by the existing isolated test environment.
- Isolated-only auth login-token helper for fixture browser setup, restricted to
  current-run-owned `example.test` users.

Not implemented:

- Prediction submission.
- Fixture deletion, unpublishing, restoration, results, live/completed
  transitions, match events, leagues, rosters, competition management,
  sponsorships, AI, service workers, offline caching, or custom question UI.

## Security And Privacy

All admin mutations require the existing verified platform-admin authorization
on the server. Client auth state is not authoritative.

Public fixture publications use explicit field projections and exclude actor
IDs, internal metadata, test ownership, and ruleset snapshots. Draft fixtures
are excluded from public lists and guessed-ID detail subscriptions.

Client collection writes are denied; authoritative writes go through Meteor
methods.

## Ruleset Snapshot Protection

Publishing validates and clones the default scoring ruleset snapshot. Ordinary
edits do not replace the snapshot. Repeated publication returns a no-op result
for already published fixtures and does not regenerate snapshot metadata.

This is server write-path protection plus cloned snapshot storage, not
database-level immutability.

## Verification

Commands run:

- `meteor npm run typecheck` - passed.
- `meteor npm run lint` - passed.
- `meteor npm run lint:project` - passed.
- `meteor npm run test:unit` - passed `9` files and `85` tests.
- `meteor npm run test:integration` - passed `33` server tests.
- `meteor npm run test:e2e -- fixtures.spec.ts` - passed `2` Chromium tests
  after adding unique browser fixture names so previous-run test data remained
  untouched.
- `meteor npm run test:e2e -- foundation.spec.ts` - passed `10` Chromium tests.
- `meteor npm exec prettier -- --check <changed CCPP-005 files>` - passed.

## Notes

The known CCPP-004D full auth browser-suite navigation issue remains deferred.
The fixture browser tests do not claim to resolve it.

EOMD archive created:
`rugby-rooster-ccpp005-fixture-management-eomd-20260915.zip`.
