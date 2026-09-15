# AUDIT 005B - Fixture Edit Session

## Summary

CCPP-005B fixes admin fixture edit-form defects found in the CCPP-005A review.
The correction is client-side and preserves the existing server revision checks,
cursor pagination, and revision backfill.

Rugby Rooster remains separate from Rugby Tracker / Rucks and Mauls. This task
did not reopen authentication, email, HMR, test infrastructure, PWA, prediction,
match-event, deployment, or later game work.

## Defects Fixed

The admin form previously copied fixture details into local state when Edit was
clicked, but Save read `expectedRevision` from the live reactive fixture row. If
another admin updated the fixture while the form stayed unchanged, the browser
could submit old form values with the newer revision and overwrite that other
update.

The form also decided between edit and create from whether the edited fixture was
still present in the current visible page. Pagination cleared only the editing
ID, leaving old form values behind. If a reactive update moved the edited row
outside the current page, the visible-row lookup became null and Save could fall
through to `fixtures.admin.createDraft`.

## Edit-Session Contract

Clicking Edit now captures an explicit edit session:

- `fixtureId`
- `expectedRevision`

Those values remain stable while the admin edits. Reactive fixture updates can
change the list row, but they do not replace the captured revision and do not
overwrite unsaved form values.

Save branches on the explicit edit session, not on the visible-row lookup. An
active edit session always calls `fixtures.admin.editDetails` with the captured
fixture ID and revision. Create mode calls `fixtures.admin.createDraft` only when
there is no edit session.

Successful save and explicit cancellation clear both the edit session and form.
Next/Previous admin pagination uses the same reset path, so edit mode and old
form values end together.

## Conflict And Reload Behavior

When the server reports `fixture-conflict`, the UI keeps the original edit
session and preserves the user's unsaved values. It does not retry with the
latest revision.

The edit header now provides:

- `Cancel edit`, which clears the edit session and form.
- `Reload and replace form`, which is enabled while the edited fixture is still
  visible on the current page. Reload intentionally replaces unsaved form values
  and captures the latest visible revision.

If the edited fixture leaves the visible page, the UI remains in edit mode and
Save still targets the captured fixture ID/revision. Reload is disabled because
the current fixture is no longer present in the subscribed visible page. Saving a
stale off-page edit can return the existing server conflict/error, but it cannot
create a draft.

## Files Changed

- `imports/ui/fixtures/AdminFixtureManager.tsx` - replaced live-row edit
  identity with stable `editSession`, added cancel/reload controls, preserved
  conflict state, and reset form/session together on pagination.
- `tests/e2e/fixtures.spec.ts` - added browser regressions for stale edits,
  pagination while editing, disappearing edited rows, and explicit reload after
  conflict; adjusted fixture dates so browser pagination tests are robust against
  older isolated local test data.
- `docs/AUDIT_005B_Fixture_Edit_Session.md` - this audit.
- `docs/PLATFORM_Fixtures.md`, `docs/PLATFORM_Testing.md`,
  `docs/CORE_Build_Plan.md`, and `docs/MAP_System.md` - updated platform,
  testing, roadmap, and system-map documentation for the edit-session contract.

## Regression Coverage

Browser fixture regressions now cover:

- Stale edit after reactive update: open an edit form, change a field, perform a
  separate authorized fixture update, wait for revision `2` in the browser
  collection, submit the original form, assert a conflict, assert the competing
  update remains, and assert unsaved form values remain.
- Explicit reload after conflict: reload replaces the form with latest visible
  details and captures the latest revision, after which a save succeeds.
- Pagination while editing: Next fixtures clears edit mode and empties form
  fields together.
- Edited fixture leaves the visible page: a separate authorized update moves the
  fixture outside the current page; Save stays in edit mode, returns conflict,
  preserves unsaved form values, keeps Create Draft unavailable, and creates no
  visible draft.

The competing update is simulated with the existing authorized
`fixtures.admin.editDetails` method from an already signed-in platform-admin
browser session. No new authentication infrastructure was added.

## Verification

Commands run:

- `meteor npm exec prettier -- --write imports/ui/fixtures/AdminFixtureManager.tsx tests/e2e/fixtures.spec.ts` - completed; formatted the touched TS/TSX files.
- `meteor npm run typecheck` - initially failed with `TS2339` and `TS2717` in
  `tests/e2e/fixtures.spec.ts` because the test tried to add
  `window.Meteor.connection` to the global `Window` declaration. The helper was
  changed to a local cast.
- `meteor npm run lint` - passed.
- `meteor npm exec prettier -- --check imports/ui/fixtures/AdminFixtureManager.tsx tests/e2e/fixtures.spec.ts` - passed.
- `meteor npm run typecheck` - passed after the local-cast correction.
- `meteor npm run lint:project` - passed.
- `meteor npm run test:e2e -- fixtures.spec.ts` - first run failed: 3 passed and
  3 failed. The failures were caused by older isolated local Playwright fixture
  data from previous run IDs sorting ahead of the current test fixtures. The
  tests were adjusted to use near-past public pagination fixtures and far-future
  admin pagination fixtures, and the create/publish/cancel workflow now checks
  public detail by fixture ID.
- `meteor npm run typecheck` - passed after the browser-test isolation
  adjustment.
- `meteor npm run test:e2e -- fixtures.spec.ts` - passed: 6 Chromium tests.
- `meteor npm exec prettier -- --write docs/AUDIT_005B_Fixture_Edit_Session.md docs/PLATFORM_Fixtures.md docs/PLATFORM_Testing.md docs/CORE_Build_Plan.md docs/MAP_System.md imports/ui/fixtures/AdminFixtureManager.tsx tests/e2e/fixtures.spec.ts` -
  completed; all listed files were unchanged because they already matched
  Prettier style.
- `meteor npm run typecheck` - passed after documentation updates.
- `meteor npm run lint` - passed after documentation updates.
- `meteor npm run lint:project` - passed after documentation updates.
- `meteor npm run format:check` - blocked by pre-existing formatting issues in
  `docs/AUDIT_004A_Database_Isolation_Verification.md`,
  `docs/AUDIT_004A_Login_Navigation_Fix.md`,
  `imports/server/auth/mongoConnectionIdentity.ts`,
  `imports/shared/auth/testDatabaseIdentity.ts`, `playwright.config.ts`,
  `scripts/test-environment.mjs`, and `tests/unit/test-launchers.test.ts`.
- `meteor npm exec prettier -- --check docs/AUDIT_005B_Fixture_Edit_Session.md docs/PLATFORM_Fixtures.md docs/PLATFORM_Testing.md docs/CORE_Build_Plan.md docs/MAP_System.md imports/ui/fixtures/AdminFixtureManager.tsx tests/e2e/fixtures.spec.ts` -
  passed.

The npm warning `Unknown env config "nodedir"` appeared during Meteor npm
commands and did not fail the checks. Browser runs also printed Node warnings
about `NO_COLOR` being ignored because `FORCE_COLOR` was set; those warnings did
not fail the suite.

No unit tests were run for CCPP-005B because no shared framework-independent
fixture helper or server method behavior changed.

## Remaining Limitations

Reload uses the fixture document currently present in the subscribed admin page.
If the edited fixture has moved outside the visible page, reload is disabled and
the admin can cancel or navigate back to a page where the fixture is visible.

This task did not add an admin fixture detail publication, snapshot-isolated
pagination, fixture deletion, unpublishing, restoration, prediction submission,
match events, or broader test database cleanup.
