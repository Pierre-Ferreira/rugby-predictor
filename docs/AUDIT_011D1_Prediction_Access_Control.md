# CCPP-011D1 Prediction Access Control Audit

## Scope

CCPP-011D1 closes prediction access control for Rugby Rooster. It preserves the
existing prediction flow, result flow, and product identity. It does not begin
leagues, live event capture, admin +/- event buttons, AI, animations, or another
feature milestone.

## Effective Access Matrix

Canonical order:

- Final result: locked; cannot be reopened for prediction editing.
- Cancelled fixture: locked; cannot be reopened for prediction editing.
- Admin override `open`: open, including after scheduled kickoff or result
  tracking start.
- Admin override `locked`: locked, including before scheduled kickoff.
- Automatic mode with result tracking started: locked.
- Automatic mode at or after scheduled kickoff by server time: locked.
- Automatic mode before kickoff with no result tracking: open.

The explicit admin-open override after kickoff and after result tracking start
is intentional. Final and cancelled remain fail-closed before overrides.

## Implementation Summary

Primary source:

- `imports/shared/predictionAccess/resolver.ts`
- `imports/shared/predictionAccess/types.ts`
- `imports/api/predictionAccessAudits/collection.ts`
- `imports/server/fixtures/server.ts`
- `imports/server/predictions/server.ts`
- `imports/server/matchResults/server.ts`
- `imports/ui/pages/AdminFixtureResultsPage.tsx`
- `imports/ui/pages/PredictionEntryPage.tsx`

Prediction writes still use the single `predictions.submit` method. The server
loads fixture and match-result state, resolves access with server time, and
rejects locked writes before create or update. The player cannot submit a
timestamp, lock override, kickoff time, result-start state, final state, or
cancellation state.

## Admin Controls

Prediction access is fixture-owned through `predictionLockOverride`:

- absent: automatic;
- `locked`: admin locked;
- `open`: admin reopened.

Implemented admin methods:

- `fixtures.admin.lockPredictions`;
- `fixtures.admin.reopenPredictions`;
- `fixtures.admin.resetPredictionAccess`.

Each method requires platform-admin authorization, a published non-cancelled
fixture, and the expected fixture revision. Stale admin actions return
`fixture-conflict`. Reopen rejects confirmed final results, and cancelled
fixtures reject all access-control mutations as read-only.

## Audit Trail

Audit rows are stored internally in Mongo collection
`prediction_access_audits`, exported from
`imports/api/predictionAccessAudits/collection.ts`.

Rows include:

- `action`: `locked`, `reopened`, or `reset-to-automatic`;
- `fixtureId`;
- `actorAdminUserId`;
- `createdAt`;
- `fixtureRevisionBefore`;
- `fixtureRevisionAfter`;
- optional `predictionLockOverrideBefore`;
- optional `predictionLockOverrideAfter`;
- isolated-test ownership metadata when applicable.

Client writes are denied. The audit collection is not published to
player-facing clients, and raw admin identity stays internal.

## Player Protection

The high-risk stale-page path is covered:

1. Player editor is open while predictions are open.
2. Admin locks predictions.
3. Player attempts to save from the stale open page.
4. Server rejects with `prediction-access-locked`.
5. The stored prediction remains unchanged.
6. The player page adopts locked/read-only state from canonical fixture/result
   data.

If an admin later reopens predictions, the player can edit again from the
canonical saved entry. Dirty values from the rejected save do not become the
saved baseline.

## Result Interaction

In automatic mode, `Start result tracking` creates the canonical provisional
result and locks predictions. If an admin explicitly reopens predictions after
result tracking starts, access remains open. A later explicit Lock predictions
action closes access again. Saving or correcting provisional result observations
does not silently clear or reset the override.

Final confirmation closes prediction access and cannot be reopened in 011D1.
Cancelled fixtures also cannot reopen predictions.

## Match Result Hardening

`matchResults.admin.startResultTracking` is the only production path that
creates the first canonical match result at revision `1`.

`matchResults.admin.saveProvisional` updates an existing provisional result
only. Production `saveProvisional(expectedRevision: 0)` with no result rejects
with `result-not-found`; it no longer creates revision `1`.

Legacy blank/Pending result regression coverage remains isolated/test-owned and
does not rely on the production first-create branch.

## Evidence

Implementation verification reported before documentation closeout:

- Prediction-access pure resolver tests passed.
- `meteor npm run typecheck` passed after nullable/access and E2E typing
  corrections.
- `meteor npm run test:integration` passed 105 server tests.
- Focused browser journey `tests/e2e/prediction-access-control.spec.ts` passed.
- Focused unit slice for prediction access, predictions, match results, and
  prediction session passed.

Retained browser screenshots:

- `test-results/ccpp011d1-prediction-access-control/player-locked-after-admin-lock.png`
- `test-results/ccpp011d1-prediction-access-control/admin-reopened-after-result-start.png`
- `test-results/ccpp011d1-prediction-access-control/admin-relocked.png`

Closeout checks run on September 22, 2026:

- `meteor npm run test:unit -- tests/unit/prediction-access.test.ts` passed:
  1 file, 4 tests.
- `meteor npm run test:unit -- tests/unit/prediction-access.test.ts tests/unit/predictions.test.ts tests/unit/match-results.test.ts tests/unit/prediction-session.test.ts`
  passed after final formatting: 4 files, 36 tests.
- `meteor npm run typecheck` passed after final formatting.
- `meteor npm run lint` passed after final formatting.
- `meteor npm run lint:project` passed after final formatting.
- Changed-file Prettier check initially found five unformatted existing
  source/test files; `meteor npm exec prettier -- --write` was run on those
  files, then the changed-file Prettier check passed.
- `meteor npm run test:integration` was rerun because the formatting pass
  touched server/shared files; it passed with 105 server tests.
- `git diff --check` passed.
- `file` confirmed all three retained 011D1 screenshots are PNG image data.

Playwright was not rerun during closeout. The final focused browser result for
`tests/e2e/prediction-access-control.spec.ts` is retained because the closeout
did not materially change prediction-access browser behavior. No animation or
visual suites were run.

## EOMD Package

Final archive:

- `rugby-rooster-ccpp011d1-prediction-access-control-eomd-20260922.zip`

Status: built and verified.

Included material:

- prediction access resolver/types;
- fixture override persistence and internal audit collection/source;
- admin fixture control methods;
- prediction server write guard;
- player prediction lock/read-only source;
- admin Prediction Access UI;
- Match Result first-create hardening;
- relevant isolated test helpers;
- focused pure/unit/integration/browser tests;
- retained 011D1 browser screenshots;
- updated docs and command/check summary.

Excluded material:

- credentials and private settings;
- `node_modules`;
- `.meteor/local`;
- caches/build outputs;
- unrelated visual/animation evidence;
- historical archive files.

Package verification:

- `unzip -t rugby-rooster-ccpp011d1-prediction-access-control-eomd-20260922.zip`
  passed with no compressed-data errors.
- `unzip -l rugby-rooster-ccpp011d1-prediction-access-control-eomd-20260922.zip ...`
  confirmed representative docs, source, tests, browser spec, and screenshot
  paths are present.
- `unzip -p ... | file -` confirmed the three screenshot payloads inside the
  archive are PNG image data.
- `ls -l rugby-rooster-ccpp011d1-prediction-access-control-eomd-20260922.zip ...`
  confirmed the archive exists and original repository files remain.

## Deferred

CCPP-011D1 does not add:

- generic audit subsystem;
- player-visible admin identity;
- live event capture;
- admin +/- event buttons;
- kickoff automation;
- result revision to override reset coupling;
- leagues or aggregate competitions;
- AI;
- animations.
