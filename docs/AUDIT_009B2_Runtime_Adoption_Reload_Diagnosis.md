# AUDIT 009B2 Runtime Adoption Reload Diagnosis

Date: 2026-09-18

## Scope

CCPP-009B2 closes out a narrow runtime adoption and browser reload diagnosis
pass for the existing Kaplay Match Result preview. It preserves available
evidence, verifies assertion/helper boundaries, documents the actual state, and
packages a review candidate.

It does not restart the 009B/009B1 runtime architecture, does not mark 009B2
accepted, does not weaken real-Kaplay success expectations, and does not begin
009C.

## Source Changes Present

`PredictionPresentationHost.tsx` now catches runtime update exceptions at both
failure points:

- initial `handle.update(...)` before adopting a newly created runtime as ready;
- later `runtimeHandle.update(...)` calls when React sends a new snapshot to an
  already-ready runtime.

Both paths dispose owned runtime resources and route through the same Standard
fallback state used by other renderer failures.

`tests/unit/prediction-presentation-host.test.ts` adds focused regressions for:

- adoption-time update failure;
- ready-runtime snapshot update failure.

`tests/e2e/kaplay-prediction-preview.spec.ts` adds:

- exact-path interception of the test Meteor HMR WebSocket at
  `/__meteor__hmr__/websocket`;
- bounded initial navigation/readiness retries through `gotoLocal(...)`;
- a React-root mount check for initial setup/revisit navigation;
- a main-frame navigation probe in the dirty-session preservation segment.

The browser assertions still require real Kaplay readiness for success paths.
Fallback Standard is accepted only in tests that deliberately trigger renderer
failure after a real runtime has become ready.

## Evidence Preservation

Before any additional checks, available evidence was copied to:

`/tmp/rugby-rooster-ccpp009b2-evidence-20260918/`

Preserved private raw evidence:

- current `test-results/`;
- current `.playwright-mcp/`;
- binary worktree diff;
- git status.

Packaged sanitized evidence:

- redacted network summaries;
- redacted console summaries;
- redacted stage/assertion summaries;
- trace member inventories confirming the relevant member names, including
  `1-trace.trace`;
- redacted error contexts;
- failing screenshots;
- passing 009B screenshot evidence;
- Playwright `.last-run.json`.

Raw traces may contain session state and are retained only in the private raw
evidence copy. No standalone Meteor server output log was available to preserve.

## Preserved Failure Findings

The latest preserved browser evidence records two failing tests. The browser
file is not green.

### Controlled Failure And Context Loss

Expected stage:

- a genuine Kaplay runtime should become ready before the test injects the
  controlled pointer failure.

Actual page state:

- Standard fallback rendered at Step 1 of 9;
- the runtime failure notice was visible;
- `Retry animations` was visible;
- no `kaplay-match-result-stage` was present at the failing assertion.

Navigation/request evidence:

- same-route document navigation to `/games/[fixture]/predict` is present
  before the failure;
- the preview module chunk
  `/build-chunks-local-playwright/imports_ui_predictions_kaplay_KaplayMatchResultPreview_tsx.js`
  returned `503`;
- `/sockjs/info` also returned `503`.

Console evidence:

- `HMR: websocket closed` messages preceded the failed chunk request;
- the trace identifies the failed application module request directly, so this
  audit does not infer a Kaplay vendor-chunk failure for this case.

### Dirty Saved-Session Runtime Failure

Expected stage:

- after unsaved dirty built-in/custom answers exist, the test should reach a
  genuine Kaplay runtime, click the canvas, then trigger the controlled
  `webglcontextlost` failure.

Actual page state:

- Standard fallback rendered at Step 1 of 10;
- the runtime failure notice was visible;
- `Retry animations` was visible;
- the Team 1 Standard radio remained checked;
- the stage appeared, but the canvas was absent when readiness failed.

Navigation/request evidence:

- setup/revisit document navigations occurred before the protected dirty
  segment;
- no additional document navigation is visible in the preserved network summary
  after the dirty segment was armed;
- the Kaplay vendor chunk
  `/__rspack__/build-chunks-local-playwright/vendors-node_modules_kaplay_dist_kaplay_mjs.js`
  returned `503`;
- a SockJS XHR also returned `503`.

Console evidence:

- `HMR: websocket closed` messages preceded the failed chunk request.

## Cause Discipline

The preserved traces support a concrete script-delivery/runtime-chunk failure
in the two remaining failures:

- preview module chunk `503` in the controlled-failure test;
- Kaplay vendor chunk `503` in the dirty-session test.

They also show HMR close messages, but that is an observation, not a complete
cause. This audit does not conclude that every browser failure is caused by HMR,
Kaplay, authentication, or a single bundler defect. It also does not start a
broad bundler/authentication redesign.

The exact-path HMR-isolated browser run is useful for reducing test noise. It
does not prove that ordinary development hot reload preserves unsaved
in-memory prediction answers.

## Prior-Run Reports

These were reported by the interrupted session and are retained as prior-run
context, not closeout verification:

| Reported item                          | Prior reported result                                                       |
| -------------------------------------- | --------------------------------------------------------------------------- |
| Adoption-time runtime update exception | Reached Standard fallback.                                                  |
| Post-ready runtime update exception    | Reached Standard fallback.                                                  |
| Focused host unit tests                | Passed 17/17.                                                               |
| Dirty saved-session case               | Passed in one combined run.                                                 |
| Other combined browser cases           | Still hit navigation/loading failures.                                      |
| Meteor HMR fallback message            | Preceded some same-URL navigation.                                          |
| Hard revisit                           | One run saw `client-rspack.js` return `503` and leave the React root empty. |
| Latest browser rerun                   | Still had missing-stage/fallback failures.                                  |

The full Kaplay browser file is not claimed green.

## Final Verification

Checks actually run during this closeout:

| Check                                                                                                                                                                                                                                                                                                                                                    | Result                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run test:unit -- tests/unit/prediction-presentation-host.test.ts`                                                                                                                                                                                                                                                                                   | Passed: 1 file, 17 tests.                                                                                                                              |
| `npm run typecheck`                                                                                                                                                                                                                                                                                                                                      | Passed.                                                                                                                                                |
| `npm run lint`                                                                                                                                                                                                                                                                                                                                           | Passed.                                                                                                                                                |
| `npm run lint:project`                                                                                                                                                                                                                                                                                                                                   | Passed; project invariant check passed.                                                                                                                |
| `git diff --check`                                                                                                                                                                                                                                                                                                                                       | Passed.                                                                                                                                                |
| `./node_modules/.bin/prettier --check docs/TEMP_009B2_Resume.md docs/AUDIT_009B2_Runtime_Adoption_Reload_Diagnosis.md docs/PLATFORM_Kaplay_Predictions.md docs/PLATFORM_Testing.md docs/MAP_System.md imports/ui/predictions/PredictionPresentationHost.tsx tests/unit/prediction-presentation-host.test.ts tests/e2e/kaplay-prediction-preview.spec.ts` | Initially failed on this audit file; after `./node_modules/.bin/prettier --write docs/AUDIT_009B2_Runtime_Adoption_Reload_Diagnosis.md`, rerun passed. |
| `git diff --check` after the Prettier write                                                                                                                                                                                                                                                                                                              | Passed.                                                                                                                                                |

No additional Playwright browser run was executed during this closeout. The
preserved browser evidence is the closeout browser status: two failing Kaplay
spec cases remain, and the full browser file is not green.

## Review Archive

Created and inspected:

`/tmp/rugby-rooster-ccpp009b2-runtime-adoption-reload-diagnosis-eomd-20260918.zip`

The archive includes:

- changed host source and surrounding Kaplay preview/runtime/session context;
- focused host unit tests;
- the complete modified Kaplay browser spec;
- Playwright/test launcher configuration needed to understand the run;
- sanitized passing and failing evidence;
- updated/new documentation;
- `evidence/verification-status.txt`.

The archive excludes local private settings, credentials, `node_modules`,
`.meteor` build/cache output, generated application builds, raw trace zips/raw
trace members, `test-results`, `playwright-report`, and unrelated archives. An
initial package pass accidentally included empty hidden staging directories; the
generated ZIP was cleaned and re-inspected before this audit was finalized.

This archive is an EOMD review candidate only. It does not mark CCPP-009B2
accepted, and CCPP-009C was not started.
