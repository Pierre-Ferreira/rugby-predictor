# Rugby Rooster Fixtures

## Scope

CCPP-005 adds the first usable fixture workflow for Rugby Rooster:

- Platform admins create draft fixtures.
- Platform admins edit ordinary fixture details while a fixture is active.
- Platform admins publish valid drafts.
- Platform admins cancel fixtures.
- Anonymous visitors browse published upcoming and past scheduled fixtures.
- Anonymous visitors open public fixture detail pages under `/games/:fixtureId`.

This milestone does not add prediction submission, results, match events,
automatic live/completed transitions, unpublishing, deletion, restoration,
leagues, rosters, competition management, club directories, sponsorships, AI, or
offline fixture caching.

## Fixture Model

Fixtures use Team 1 and Team 2 terminology. Team and competition values are text
for this milestone.

Each fixture has:

- Team 1 display name.
- Team 2 display name.
- Competition display name.
- Scheduled kickoff stored as a UTC instant.
- Optional venue display name.
- Visibility of `draft` or `published`.
- Cancellation state separate from visibility.
- Server-owned integer revision for optimistic conflict protection.
- Server-owned created and updated timestamps.
- Server-owned responsible admin IDs for create/update/publish/cancel.
- A scoring ruleset snapshot once published.

## States

Draft fixtures:

- Are visible only in the admin workflow.
- Can be edited while not cancelled.
- Can be published when valid and not cancelled.
- Can be cancelled.

Published fixtures:

- Are visible in public lists and detail pages.
- Can have ordinary details corrected while not cancelled.
- Keep the ruleset snapshot created at first publication.
- Can be cancelled.

Cancelled fixtures:

- Keep their existing visibility.
- Remain visible publicly when they were already published.
- Are read-only for this milestone.
- Cannot be restored, unpublished, deleted, or published from cancelled draft
  state.

Publishing an already published fixture returns a predictable no-op result.
Cancelling an already cancelled fixture returns a predictable no-op result.

Kickoff passing does not change state. A past scheduled fixture is only a
fixture whose scheduled kickoff is before the current browsing boundary.

## Timezone Policy

No previous Rugby Rooster timezone policy existed. CCPP-005 uses explicitly
labelled South African time for admin entry:

- Entry label: `South African time (Africa/Johannesburg)`.
- Admin `datetime-local` values are converted to UTC before storage.
- Stored kickoff values remain UTC instants.
- Public and admin display uses SAST labels.

The conversion helper treats Africa/Johannesburg as UTC+02:00 and is tested
independently of the test machine timezone.

## Public Browsing

`/games` now lists published fixtures instead of a placeholder. Visitors can
switch between:

- Upcoming fixtures, ordered by kickoff ascending.
- Past scheduled fixtures, ordered by kickoff descending.

Both lists use bounded cursor pagination instead of a total-result cap. A page
is ordered by scheduled kickoff and then fixture ID, so fixtures with identical
kickoff times keep a deterministic order and can cross page boundaries without
being skipped. Visitors move with Next/Previous page controls.

The public browsing boundary is refreshed every 30 seconds. When that refresh
runs, the public list returns to the first page for the selected mode so the
upcoming/past split is recalculated against one coherent boundary. Switching
between Upcoming and Past also resets to the first page.

Fixture cards and detail pages show Team 1, Team 2, competition, kickoff, venue
when present, and cancellation status. They do not expose admin actor IDs,
internal test ownership, stored revisions, or ruleset snapshots.

Prediction submission is not implemented. Public fixture screens state that
predictions are not open yet.

## Deferred Decisions

- Prediction submission deadlines and reopening.
- Fixture deletion, unpublishing, and restoration.
- Results entry and automatic live/completed transitions.
- Match-event capture.
- Team, roster, competition, and venue management systems.
- Fixture-specific custom question configuration.
- Offline fixture caching or service-worker support.
