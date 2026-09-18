# TEMP 009B2 Resume - Runtime Adoption And Reload Diagnosis

Date: 2026-09-18

## Scope

CCPP-009B2 is a bounded verification, documentation, and packaging pass for
the existing Kaplay Match Result preview architecture. It does not restart
CCPP-009B/009B1, does not reimplement the accepted host-owned runtime attempt,
and does not begin CCPP-009C.

The closeout focuses on:

- preserving browser failure evidence before another Playwright run overwrites
  `test-results`;
- verifying that runtime update exceptions recover through Standard fallback;
- verifying that the Kaplay browser tests still distinguish real-runtime
  success from intentional renderer failure;
- documenting the exact HMR WebSocket interception and navigation retry
  boundaries;
- packaging a review candidate with sanitized evidence.

## Current Diff At Resume

Tracked changes present at resume:

- `imports/ui/predictions/PredictionPresentationHost.tsx`
- `tests/unit/prediction-presentation-host.test.ts`
- `tests/e2e/kaplay-prediction-preview.spec.ts`
- `tsconfig.tsbuildinfo`

No existing `docs/TEMP_009B2_Resume.md` or
`docs/AUDIT_009B2_Runtime_Adoption_Reload_Diagnosis.md` was present, so this
checkpoint and the audit were created from the actual diff and preserved local
evidence. The `tsconfig.tsbuildinfo` change was already present in the
worktree; it is left untouched and is not treated as source evidence for this
review package.

## Evidence Preserved Before Additional Tests

Before running more checks, the available overwrite-prone artifacts were copied
to:

`/tmp/rugby-rooster-ccpp009b2-evidence-20260918/`

Raw private evidence preserved under `raw/`:

- current `test-results/`;
- current `.playwright-mcp/`;
- `worktree-before-closeout.diff`;
- `git-status-before-closeout.txt`.

Sanitized evidence generated under `sanitized/`:

- trace member inventories for both preserved failures;
- redacted network summaries;
- redacted console summaries;
- redacted stage/assertion summaries;
- redacted Playwright error contexts;
- failing screenshots;
- passing `test-results/ccpp009b/` screenshots;
- `.last-run.json`;
- pre-closeout git status.

Raw trace zips remain private in the raw evidence copy and are not intended for
the review archive. No standalone Meteor server stdout/stderr log was present
under `test-results`, `playwright-report`, or the inspected artifact paths.

## Runtime Update Corrections Present

`PredictionPresentationHost.tsx` now routes both runtime update failure points
through the existing failure path:

- initial runtime `handle.update(...)` during adoption is wrapped before the
  runtime is published as ready;
- ready runtime snapshot `runtimeHandle.update(...)` is wrapped during later
  React snapshot updates.

If either update throws, the host disposes owned runtime resources, latches the
failure, and renders Standard with the current session answers. The new unit
tests cover adoption-time update failure and ready-runtime snapshot update
failure.

## Browser Test Boundary Review

The browser spec still keeps these cases distinct:

- real Kaplay success tests require `kaplay-match-result-stage`, a visible
  `kaplay-match-result-canvas`, and actual canvas interaction;
- intentional failure tests first require a real ready runtime, then trigger a
  controlled failure and require Standard recovery;
- the dirty-session runtime-failure test first requires a real ready runtime,
  clicks the canvas, then triggers `webglcontextlost` and checks that the same
  dirty session resumes in Standard before any explicit save.

No success assertion was changed to accept "canvas or Standard".

The added WebSocket route is scoped to the exact Meteor HMR path:

`/__meteor__hmr__/websocket`

It does not match application DDP/SockJS WebSockets, prediction requests, all
development-server traffic, or arbitrary WebSocket URLs.

`gotoLocal(...)` retries bounded transient initial navigation/setup failures
and now waits for both `Meteor.call` and a mounted React root. The protected
dirty-session segment creates a main-frame navigation probe only after unsaved
edits exist and does not call hidden `goto`, reload, relogin, or fixture
rebuild helpers after arming that probe.

## Preserved Browser Failure Observations

The preserved `test-results/.last-run.json` records the latest browser run as
failed with two failed tests. The full browser file is not green.

### Controlled Failure / Context Loss

Test:

`kaplay-prediction-preview.spec.ts >> Kaplay prediction preview >> recovers from delayed initialization, controlled failure and context loss`

Expected stage:

- after returning to Match Result and enabling animations for the controlled
  pointer failure, a real Kaplay runtime should become ready before the
  deliberate pointer failure runs.

Actual page state:

- Standard fallback was visible at Step 1 of 9;
- the runtime failure notice was visible;
- `Retry animations` was visible;
- `kaplay-match-result-stage` was absent.

Navigation and request evidence:

- document requests were present for `/`, `/`, and `/games/[fixture]/predict`;
- another same-route document request for `/games/[fixture]/predict` occurred
  before the failed readiness assertion;
- the preview chunk request
  `/build-chunks-local-playwright/imports_ui_predictions_kaplay_KaplayMatchResultPreview_tsx.js`
  returned `503`;
- `/sockjs/info` also returned `503`.

Console evidence:

- `HMR: websocket closed` messages occurred before the failed chunk request;
- the concrete application script failure recorded in this trace is the preview
  module chunk `503`.

### Dirty Saved-Session Runtime Failure

Test:

`kaplay-prediction-preview.spec.ts >> Kaplay prediction preview >> preserves a dirty saved custom prediction through same-session runtime failure`

Expected stage:

- after creating unsaved dirty built-in and custom answers and entering Match
  Result, a real Kaplay runtime should become ready before the controlled
  `webglcontextlost` failure runs.

Actual page state:

- Standard fallback was visible at Step 1 of 10;
- the runtime failure notice was visible;
- `Retry animations` was visible;
- the Team 1 radio remained checked in Standard;
- `kaplay-match-result-stage` had appeared, but
  `kaplay-match-result-canvas` was absent when readiness failed.

Navigation and request evidence:

- setup/revisit document requests occurred before the protected dirty segment;
- no additional document request is visible in the preserved network summary
  after the dirty segment was armed;
- the Kaplay vendor chunk request
  `/__rspack__/build-chunks-local-playwright/vendors-node_modules_kaplay_dist_kaplay_mjs.js`
  returned `503`;
- a SockJS XHR also returned `503`.

Console evidence:

- `HMR: websocket closed` messages occurred before the failed chunk request;
- the concrete application script failure recorded in this trace is the Kaplay
  vendor chunk `503`.

These observations support a script-delivery/runtime-chunk failure in the
preserved traces. They do not prove that every remaining browser failure has
the same cause, and they do not prove that ordinary development hot reload
preserves unsaved in-memory prediction answers.

## Prior-Run Reports Not Re-Executed Here

The interrupted conversation reported:

- adoption-time initial runtime update exceptions reached fallback;
- post-ready snapshot update exceptions reached fallback;
- focused host unit tests passed 17/17;
- the dirty saved-session case passed in one combined run;
- other combined cases still encountered navigation/loading failures;
- a Meteor HMR fallback message preceded some same-URL navigation;
- one hard revisit received `503` for `client-rspack.js` and left the React
  root empty;
- spec-scoped HMR WebSocket interception was added;
- navigation readiness/retry handling was changed;
- the latest browser rerun still had missing-stage/fallback failures.

Those are prior-run reports only. This closeout does not treat them as newly
executed checks.

## Remaining Closeout Work

- Focused host unit rerun completed:
  `npm run test:unit -- tests/unit/prediction-presentation-host.test.ts`
  passed 17/17.
- Static checks completed:
  - `npm run typecheck` passed.
  - `npm run lint` passed.
  - `npm run lint:project` passed.
  - `git diff --check` passed before and after final formatting.
  - changed-file Prettier check initially found this audit needed formatting;
    after formatting, the changed-file check passed.
- No additional Playwright browser run was executed during this closeout.
- EOMD review candidate created and inspected:
  `/tmp/rugby-rooster-ccpp009b2-runtime-adoption-reload-diagnosis-eomd-20260918.zip`

CCPP-009B2 is not accepted by this checkpoint, and CCPP-009C remains unstarted.
