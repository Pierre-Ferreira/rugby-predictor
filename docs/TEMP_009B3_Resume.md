# TEMP 009B3 Resume

## Scope

CCPP-009B3 investigates isolated JavaScript/script delivery failures in the focused Kaplay browser acceptance file after the accepted 009B2 runtime corrections. This milestone must not restart runtime/session work or begin 009C.

## Initial Checkpoint

- Created: 2026-09-18
- Worktree at first checkpoint: clean (`git status --short` produced no entries)
- Repository: `/home/pierreferreira/Desktop/rugby-predictor`
- Product boundary: Rugby Rooster only; no Rugby Tracker / Rucks and Mauls assumptions
- External Codex compact 404: out of scope for this milestone

## Inspected Paths

- `AGENTS.md`
- `docs/TEMP_009B3_Resume.md`
- `docs/AUDIT_009B3_Isolated_Script_Delivery.md` (created during closeout)
- `docs/` inventory
- `imports/`, `tests/`, `scripts/`, `.meteor/` inventories
- `package.json`
- `playwright.config.ts`
- `rspack.config.ts`
- `scripts/run-playwright-tests.mjs`
- `scripts/test-environment.mjs`
- `tests/support/playwright-target.ts`
- `tests/e2e/kaplay-prediction-preview.spec.ts`
- `tests/e2e/predictions.spec.ts`
- `tests/settings/playwright-settings.json`
- `tests/unit/test-launchers.test.ts`
- `tests/unit/playwright-target.test.ts`
- `tests/unit/prediction-session.test.ts`
- `tests/unit/prediction-session-hook.test.ts`
- `imports/ui/predictions/predictionSession.ts`
- `imports/ui/pages/PredictionEntryPage.tsx`
- `imports/ui/predictions/PredictionPresentationHost.tsx`
- `imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx`
- `imports/ui/predictions/kaplay/matchResultRuntime.ts`
- `docs/CORE_Predictions.md`
- `docs/PLATFORM_Prediction_Session.md`
- `docs/AUDIT_009B2_Runtime_Adoption_Reload_Diagnosis.md`
- `docs/TEMP_009B2_Resume.md`
- `docs/PLATFORM_Kaplay_Predictions.md`
- `docs/PLATFORM_Testing.md`
- `docs/MAP_System.md`
- Preserved sanitized 009B2 summaries under
  `/tmp/rugby-rooster-ccpp009b2-evidence-20260918/sanitized/`

## Current Launch Command

- Package script: `test:e2e` -> `node scripts/run-playwright-tests.mjs`
- Launcher command: `playwright test ...args`
- Focused baseline command planned:
  `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=<run-dir> meteor npm run test:e2e -- kaplay-prediction-preview.spec.ts --workers=1 --retries=0`
- Playwright web server command:
  `meteor run --port 127.0.0.1:<testPort> --settings tests/settings/playwright-settings.json`
- Default current test port: `3200`; Meteor-managed Mongo: `3201`; Rspack dev server: `3202`.

## Worker / Retry Settings

- `playwright.config.ts`: `fullyParallel: false`, `workers: 1`, `retries: process.env.CI ? 1 : 0`.
- Diagnostic runs will pass `--workers=1 --retries=0`.
- Existing spec timeout: `test.describe.configure({ timeout: 60_000 })`.
- Existing helper retries remain limited to `gotoLocal(...)` setup/revisit navigation attempts before protected dirty-session edits.
- The combined Kaplay browser budget is exhausted as of this closeout:
  RUN 1 failed 4 passed / 1 failed, RUN 2 passed, and RUN 3 passed.

## Process / Port Ownership Approach

- `scripts/test-environment.mjs` refuses inherited Mongo connection variables and creates isolated e2e settings with `.meteor/local-playwright`, `RUGBY_ROOSTER_TEST_MODE=isolated`, and a generated `rr-e2e-*` run id.
- `playwright.config.ts` uses `reuseExistingServer: false`.
- `tests/support/playwright-target.ts` rejects non-loopback `PLAYWRIGHT_BASE_URL` values.
- Current listener inspection found the user's normal local app on `127.0.0.1:3000`, managed Mongo on `127.0.0.1:3001`, and Rspack dev server on `[::1]:3002`; the default e2e ports `3200/3201/3202` were not occupied.
- No unrelated Node/Meteor process will be killed or reused.
- Evidence mode now performs bounded cleanup only for isolated run-owned
  child-process trees matching `.meteor/local-playwright`, the exact Playwright
  test settings/app port, or the run-owned Rspack dev-server port and their
  descendants. It preserves Playwright exit status and logs before cleanup.

## Evidence Capture Location

- Must be outside app-watched source/build output.
- New launcher/spec instrumentation is gated by `RUGBY_ROOSTER_E2E_EVIDENCE_DIR`.
- Planned baseline location: `/tmp/rugby-rooster-ccpp009b3-<run-id>-<timestamp>/`.
- Captured files include launch manifest, safe env subset, process/listener snapshots, process events, Playwright stdout/stderr, browser request/response/failure/console/page-error/navigation/stage JSON, scenario screenshots, and Playwright output redirected to the run evidence directory.
- Confirmed evidence directories:
  - `/tmp/rugby-rooster-ccpp009b3-run1-20260918T110321Z`
  - `/tmp/rugby-rooster-ccpp009b3-run1-20260918T110321Z-escalated`
  - `/tmp/rugby-rooster-ccpp009b3-run2-20260918T112800Z`
  - `/tmp/rugby-rooster-ccpp009b3-run3-20260918T113100Z`
  - `/tmp/rugby-rooster-ccpp009b3-standard-20260918T113300Z`
  - `/tmp/rugby-rooster-ccpp009b3-standard-rerun-20260918T113600Z`

## Hypotheses

- Prior evidence may indicate a lifecycle boundary between Meteor readiness and lazy Rspack chunk availability, but this is not established.
- The old traces show Rspack dev-server WebSocket activity on `localhost:3202`; this does not by itself prove HMR/live-reload caused the failure.
- Playwright web-server readiness currently proves the app URL responds, not necessarily that later lazy chunks and SockJS remain continuously available.
- Historical preview/vendor/SockJS 503 responses did not reproduce in RUN 1,
  RUN 2, or RUN 3. Their root cause remains unconfirmed.

## Observations

- Historical paths to inspect against current emitted URLs include:
  - `/build-chunks-local-playwright/imports_ui_predictions_kaplay_KaplayMatchResultPreview_tsx.js`
  - `/__rspack__/build-chunks-local-playwright/vendors-node_modules_kaplay_dist_kaplay_mjs.js`
- Prior records do not establish whether startup, rebuild, restart, routing, or another lifecycle issue caused the 503s.
- RUN 1 escalated baseline completed the focused Kaplay file with 4 passed and
  1 failed. The failing dirty saved custom prediction had no browser 4xx/5xx
  responses and no failed requests. It submitted the initial prediction, the
  server helper observed revision 1, then an explicit revisit rendered Intro
  and never showed `Save revised prediction`. The intended dirty-state/Kaplay
  runtime failure segment was not reached.
- The supported explanation is a saved-entry/client-readiness boundary: the
  browser can initialize a blank Intro session before the current-entry
  subscription data is usable, even though a server helper can observe the row.
  This is not proof of a different account or a missing server write.
- The shared session now adopts a saved entry that arrives after blank
  initialization only while the local Intro form is untouched and no revision is
  captured. It also treats a successful submit as a local persisted baseline
  until the entry publication catches up.
- RUN 2 and RUN 3 exposed an isolated runner cleanup defect: run-owned Rspack
  children could outlive Playwright close and keep `[::1]:3202` listening. The
  cleanup fix is limited to run-owned process trees and does not target the
  user's normal dev listeners.
- A required small Standard regression first failed because the post-submit
  method acknowledgement arrived before the current-entry publication update,
  leaving `Discard changes` enabled. The persisted-baseline correction fixed
  this; the rerun passed.
- Installed versions inspected:
  - Meteor `3.5.1`
  - Node `v20.20.2`; Meteor Node `v24.15.0`
  - `@meteorjs/rspack@2.2.0`
  - `@rspack/core@1.7.12`
  - `@playwright/test@1.63.0`
  - `kaplay@3001.0.19`
  - `typescript@7.0.2`
- 009B2 preserved browser evidence had no standalone Meteor/server output, so 009B3 added server/process capture before baseline.

## Browser Run Budget

- RUN 1: `/tmp/rugby-rooster-ccpp009b3-run1-20260918T110321Z-escalated`, 4
  passed / 1 failed, workers=1, retries=0.
- RUN 2: `/tmp/rugby-rooster-ccpp009b3-run2-20260918T112800Z`, 5 passed,
  workers=1, retries=0.
- RUN 3: `/tmp/rugby-rooster-ccpp009b3-run3-20260918T113100Z`, 5 passed,
  workers=1, retries=0. This exhausted the combined Kaplay browser run budget.
- Additional shared-launcher Standard regression:
  `/tmp/rugby-rooster-ccpp009b3-standard-20260918T113300Z` failed before the
  persisted-baseline correction; rerun
  `/tmp/rugby-rooster-ccpp009b3-standard-rerun-20260918T113600Z` passed.
- No 009C or broader runtime/session architecture rewrite was started.

## Checkpoint Log

- 2026-09-18: Initial resume file created before substantive diagnosis or behavior changes.
- 2026-09-18: Inspected launch path, Rspack config, Kaplay spec/runtime/host, platform docs, installed versions, current listener ownership, and preserved 009B2 sanitized evidence. Added gated test instrumentation only; no production prediction behavior changed.
- 2026-09-18: Resumed from interrupted state. Confirmed both RUN 1 evidence
  directories existed, preserved the non-escalated sandbox launch as a failed
  launch, and used the escalated baseline as RUN 1.
- 2026-09-18: Corrected saved-entry revisit readiness in the shared prediction
  session and added reducer/hook regressions. Corrected evidence-mode launcher
  cleanup for run-owned Rspack child processes and added process-ownership unit
  coverage.
- 2026-09-18: RUN 2 and RUN 3 of the focused Kaplay file passed. The
  historical 503s did not reproduce, and no root cause was established for
  them.
- 2026-09-18: Required Standard saved-entry regression found post-submit
  persisted-baseline lag; the shared session now marks successful submit values
  as the local persisted baseline until publication catch-up. The Standard
  rerun passed.
- 2026-09-18: Development-preview access remains a separate agreed next UI
  task: ordinary development should eventually show supported Kaplay screens
  automatically while respecting explicit Off and reduced motion. This task did
  not implement that mode/default policy change.
- 2026-09-18: Final focused units, changed-file formatting, typecheck, lint,
  project invariants, and `git diff --check` passed. Created and inspected
  `/home/pierreferreira/Desktop/rugby-predictor/rugby-rooster-ccpp009b3-isolated-script-delivery-eomd-20260918.zip`;
  raw traces/videos were excluded from the archive.
