# TEMP 011D1 Resume

## CCPP

CCPP-011D1 - Documentation, Static Closeout & EOMD Packaging for Prediction
Access Control.

## Resume State

- This turn resumed after a remote-compaction failure.
- Runtime implementation and important verification already existed.
- No `docs/TEMP_011D1_Resume.md` existed before closeout.
- No 011D1 audit existed before closeout.
- Existing docs still described kickoff-only prediction locking and the older
  CCPP-011D `saveProvisional(expectedRevision: 0)` first-create behavior.

## Preserved Policy

Prediction access resolves in this order:

- Final result: locked; cannot reopen.
- Cancelled fixture: locked; cannot reopen.
- Admin override `open`: open after kickoff/result tracking.
- Admin override `locked`: locked before or after kickoff.
- Automatic with result tracking started: locked.
- Automatic at or after scheduled kickoff by server time: locked.
- Automatic before kickoff with no result tracking: open.

Server prediction writes use this resolver for both first creation and
revision/edit submission. Client access state is UX only.

## Implementation Sources

- Shared access resolver/types:
  `imports/shared/predictionAccess/resolver.ts`,
  `imports/shared/predictionAccess/types.ts`.
- Audit collection:
  `imports/api/predictionAccessAudits/collection.ts`.
- Fixture controls/audit:
  `imports/server/fixtures/server.ts`.
- Prediction write guard:
  `imports/server/predictions/server.ts`.
- Match Result first-create hardening:
  `imports/server/matchResults/server.ts`.
- Admin UI:
  `imports/ui/pages/AdminFixtureResultsPage.tsx`.
- Player UI:
  `imports/ui/pages/PredictionEntryPage.tsx`.

## Audit Trail

Internal collection: `prediction_access_audits`.

Stored fields include action, fixture ID, actor admin ID, timestamp,
fixtureRevisionBefore, fixtureRevisionAfter, and before/after prediction access
override values when present. The collection denies client writes and is not
published to player-facing clients.

## Result Create Boundary

Production first-create path:

- `matchResults.admin.startResultTracking`.

Production update-only path:

- `matchResults.admin.saveProvisional`.

`saveProvisional(expectedRevision: 0)` with no result is deliberate rejection
coverage only, not setup or production creation.

## Search Classification

Remaining `expectedRevision: 0` references are allowed as:

- deliberate server rejection coverage in
  `imports/server/matchResults/matchResults.app-test.ts`;
- fixture expected-revision validation coverage in `tests/unit/fixtures.test.ts`;
- historical CCPP-011D documentation now labelled as superseded by 011D1.

Browser setup paths checked use `startResultTracking` before provisional saves.

## Retained Browser Evidence

Focused browser result retained without rerun:

- `tests/e2e/prediction-access-control.spec.ts` passed.

Retained screenshots:

- `test-results/ccpp011d1-prediction-access-control/player-locked-after-admin-lock.png`
- `test-results/ccpp011d1-prediction-access-control/admin-reopened-after-result-start.png`
- `test-results/ccpp011d1-prediction-access-control/admin-relocked.png`

## Closeout Remaining

- None.

## Closeout Checks

- `meteor npm run test:unit -- tests/unit/prediction-access.test.ts` passed:
  1 file, 4 tests.
- `meteor npm run test:unit -- tests/unit/prediction-access.test.ts tests/unit/predictions.test.ts tests/unit/match-results.test.ts tests/unit/prediction-session.test.ts`
  passed after final formatting: 4 files, 36 tests.
- `meteor npm run typecheck` passed after final formatting.
- `meteor npm run lint` passed after final formatting.
- `meteor npm run lint:project` passed after final formatting.
- Changed-file Prettier check initially failed on five existing source/test
  files; after targeted Prettier write, the changed-file check passed.
- `meteor npm run test:integration` was rerun because Prettier touched
  server/shared files; it passed with 105 server tests.
- `git diff --check` passed.
- `file` confirmed the three retained 011D1 screenshots are PNG image data.

Playwright was not rerun during closeout. The final focused browser pass is
retained.

## EOMD Package

- Final archive:
  `rugby-rooster-ccpp011d1-prediction-access-control-eomd-20260922.zip`.
- `unzip -t` passed with no compressed-data errors.
- `unzip -l` confirmed representative docs, source, tests, browser spec, and
  screenshot paths.
- `unzip -p ... | file -` confirmed all three screenshot payloads inside the
  archive are PNG image data.
- `ls -l` confirmed the archive and original representative files remain in the
  repository.
