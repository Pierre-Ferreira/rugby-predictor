# TEMP 009B1 Resume - Initialization Recovery And Storage Safety

Date: 2026-09-18

## Scope

CCPP-009B1 corrects three recovery defects in the accepted CCPP-009B Kaplay
Match Result preview:

- safe acquisition of browser storage before preference reads/writes;
- host-owned end-to-end loading ownership from preview-module load through
  runtime readiness;
- genuine retry of the outer preview loader after recoverable first-load
  failure.

Standard remains the ordinary experience. Kaplay remains an explicitly enabled
development/test Match Result preview only. No CCPP-009C visual or full-flow
animation work is in scope.

## Source Inspected

Initial inspection confirmed these active paths:

- `AGENTS.md`
- `package.json`
- `.meteor/versions`
- `imports/ui/predictions/presentationPreference.ts`
- `imports/ui/predictions/PredictionPresentationHost.tsx`
- `imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx`
- `imports/ui/predictions/kaplay/matchResultRuntime.ts`
- `imports/ui/predictions/presentationMode.ts`
- `tests/unit/prediction-presentation-host.test.ts`
- `tests/unit/prediction-session-hook.test.ts`
- `tests/e2e/kaplay-prediction-preview.spec.ts`
- `docs/PLATFORM_Kaplay_Predictions.md`
- `docs/PLATFORM_Prediction_Session.md`
- `docs/AUDIT_009B_Kaplay_Runtime_Fallback.md`
- `docs/TEMP_009B_Resume.md`
- `docs/MAP_System.md`

Kaplay is already installed in `package.json` as `^3001.0.19`; no dependency
upgrade is planned.

## Chosen Correction Approach

- Replace the unsafe `window.localStorage` default parameter with a small
  protected storage-acquisition helper. Missing storage, `window.localStorage`
  getter exceptions, malformed values, `getItem` failures, and `setItem`
  failures will keep Standard and prediction interaction usable.
- Move preview-module loading ownership into `PredictionPresentationHost` so
  the same attempt covers outer module import plus runtime initialization.
- Replace module-level `React.lazy` retry behavior with an explicit injectable
  loader boundary that can be invoked again by explicit Retry while preserving
  module caching on success.
- Pass an attempt controller into the preview so runtime allocation/adoption,
  late resolution, rejection, timeout, cancellation, and cleanup are owned by
  one current attempt identity.
- Keep `usePredictionSession(...)` and Standard prediction persistence logic
  unchanged unless inspection reveals an unavoidable direct coupling.

## Files Changed

- `docs/TEMP_009B1_Resume.md` created.
- `imports/ui/predictions/presentationPreference.ts`
- `imports/ui/predictions/PredictionPresentationHost.tsx`
- `imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx`
- `imports/ui/predictions/kaplay/matchResultRuntime.ts`
- `imports/ui/predictions/kaplay/previewAttempt.ts`
- `imports/server/fixtures/testSupport.ts`
- `imports/shared/predictions/methods.ts`
- `imports/server/predictions/testSupport.ts`
- `tests/unit/prediction-presentation-host.test.ts`
- `tests/e2e/kaplay-prediction-preview.spec.ts`

## Completed Work

- Checked `git status --short`; pre-existing local change is
  `tsconfig.tsbuildinfo`.
- Read project guardrails and current 009B platform/audit/resume docs.
- Verified the current defects:
  - `useAnimationPreference` still has `storage = window.localStorage` in a
    default argument.
  - `PredictionPresentationHost` still uses a module-level `React.lazy`
    preview component.
  - runtime initialization timeout is still a child-owned `Promise.race`, so a
    late original runtime promise can outlive timeout ownership.
- Checkpoint A completed:
  - added protected `acquireAnimationPreferenceStorage()`;
  - removed `window.localStorage` from the hook default argument;
  - kept `getItem`/`setItem` failure handling and in-memory preference
    retention.
- Checkpoint B completed:
  - replaced module-level `React.lazy` with an explicit host loader boundary;
  - added host-owned attempt identity, one end-to-end deadline, retry loader
    invocation, late module/runtime invalidation, late-handle disposal, and
    timer cleanup;
  - moved runtime startup through a preview attempt controller and removed the
    child-owned `Promise.race` timeout;
  - tightened runtime adapter cleanup when setup throws after the Kaplay
    context exists.
- Checkpoint C implementation completed:
  - added focused React/jsdom regressions for storage, outer loader retry,
    shared deadline budget, late runtime completion/rejection, retry isolation,
    unmount disposal, timer cleanup, and StrictMode replay;
  - added a real browser same-session dirty saved-prediction scenario with
    custom Number and Choice questions, actual Kaplay readiness, controlled
    context-loss fallback, persisted revision observation through a private
    isolated-test helper, and explicit Standard save.
- Closeout resumed after remote compaction:
  - preserved the available local `test-results` snapshot under
    `artifacts/ccpp009b1-eomd-evidence/pre-closeout-test-results/`;
  - found no local failure screenshots, error-context files, logs, or raw
    browser traces to copy from `test-results` or `playwright-report`;
  - made one narrow static-check correction in
    `PredictionPresentationHost.tsx`, moving render-time ref writes/reads out
    of render and exposing the active preview attempt controller through React
    state.

## Tests / Checks And Outcomes

- `npm run test:unit -- tests/unit/prediction-presentation-host.test.ts`
  passed after host/preview ownership changes: 1 file, 4 tests.
- `npm run test:unit -- tests/unit/prediction-presentation-host.test.ts`
  passed after expanded regressions: 1 file, 15 tests.
- `npm run test:unit -- tests/unit/prediction-presentation-host.test.ts tests/unit/prediction-presentation-mode.test.ts`
  passed: 2 files, 21 tests.
- `npm run typecheck` passed.
- `npm run test:e2e -- tests/e2e/kaplay-prediction-preview.spec.ts -g "preserves a dirty"`
  first failed because an intermediate assertion expected `First Half` while
  UI copy is `First half`; corrected the assertion.
- The next dirty-scenario rerun reached preview activation but saw a same-URL
  reload while waiting for the first Kaplay mount; this destroyed the dirty
  in-memory edits. A separate focused run of the existing real-preview case
  warmed/verified the local browser preview path.
- `npm run test:e2e -- tests/e2e/kaplay-prediction-preview.spec.ts -g "renders a real"`
  passed: 1 Chromium test.
- `npm run test:e2e -- tests/e2e/kaplay-prediction-preview.spec.ts -g "preserves a dirty"`
  passed on bounded rerun: 1 Chromium test.
- Later combined Kaplay browser runs were reported to repeatedly fail the dirty
  saved-session scenario with an observed same-URL reload. The other four
  combined Kaplay cases were reported passing. The full Kaplay browser file is
  not recorded as green.
- Standard submit/revisit, persisted-lock, and conflict browser slice were
  reported passing.
- Closeout check before correction:
  `npm run lint` failed with seven `react-hooks/refs` errors in
  `PredictionPresentationHost.tsx`.
- Closeout focused rerun after correction:
  `npm run test:unit -- tests/unit/prediction-presentation-host.test.ts`
  passed: 1 file, 15 tests.
- Closeout final static checks after correction passed:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run lint:project`
  - `git diff --check`
  - changed-file Prettier check for the modified docs/source/test files.

## Remaining Work

- Keep the combined dirty-session Kaplay browser failure open for review; do
  not start CCPP-009C.

## Review ZIP

Created and inspected:

`rugby-rooster-ccpp009b1-initialization-recovery-storage-eomd-20260918.zip`

The archive is an EOMD review candidate. It includes the current source,
tests, docs, manifests/test configuration, isolated-test helper context, and
sanitized closeout evidence. It excludes local private settings, credentials,
`node_modules`, `.meteor/local*`, generated build/cache output, and raw browser
traces.
