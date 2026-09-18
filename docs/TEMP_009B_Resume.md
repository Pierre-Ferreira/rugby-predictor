# TEMP 009B Resume - Kaplay Runtime, Mode Switching & Safe Fallback

Date: 2026-09-18

## Scope

CCPP-009B implements a development/test-only Kaplay preview for the Match Result prediction step only. Standard remains the default presentation. The accepted shared prediction session owner from 009A/009A1 remains above presentation selection, lazy loading, runtime failures and renderer switching.

Out of scope: full animated prediction flow, rooster artwork, shove animation, Kaplay Review/submission, production default activation, server contract changes, broad visual redesign, scores/leaderboards, results settlement changes and authentication/Postmark work.

## Actual Source Paths

Initial paths identified before implementation:

- `imports/ui/pages/PredictionEntryPage.tsx`
- `imports/ui/predictions/predictionSession.ts`
- `imports/ui/predictions/standardPredictionState.ts`
- `imports/ui/predictions/PredictionPresentationHost.tsx`
- `imports/ui/predictions/presentationMode.ts`
- `imports/ui/predictions/presentationPreference.ts`
- `imports/ui/predictions/reducedMotion.ts`
- `imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx`
- `imports/ui/predictions/kaplay/matchResultRuntime.ts`
- `imports/shared/predictions/sequence.ts`
- `imports/shared/predictions/messages.ts`
- `imports/shared/predictions/types.ts`
- `tests/unit/prediction-session-hook.test.ts`
- `tests/unit/prediction-session.test.ts`
- `tests/unit/prediction-sequence.test.ts`
- `tests/e2e/predictions.spec.ts`
- `package.json`
- `package-lock.json`
- `tests/settings/playwright-settings.json`
- `config/local/development.settings_EXAMPLE(json).txt`

This list will be refined during inspection.

## Dependency / Version Findings

- Kaplay was not previously installed.
- Installed `kaplay@3001.0.19` with `meteor npm install kaplay@3001.0.19`.
- Local package metadata reports `3001.0.19`.
- Official docs for the same version show `kaplay(gopt?: KAPLAYOpt)`, owned
  `canvas`, `global: false`, `pixelDensity`, `touchToMouse`, `quit()`,
  `onError(...)`, and `onLoadError(...)`.
- Local declarations in `node_modules/kaplay/dist/types.d.ts` match those
  options and lifecycle hooks. `onError` returns `void`; `onLoadError` returns
  a `KEventController | undefined`; `quit` is available on the context.

## Preview Activation Approach

- Added a small public settings gate:
  `public.rugbyRooster.kaplayPredictionPreview.enabled === true`.
- `Meteor.isProduction` keeps the preview unavailable even if a production
  settings file accidentally includes the public flag.
- Absent/false remains unavailable, and stored/browser preferences cannot
  override the application gate.
- `tests/settings/playwright-settings.json` enables the gate for isolated
  browser tests and also enables narrow client-side test controls.
- Development settings example documents the flag but leaves it `false`.
- No authentication, authorization, publication or method bypass was added.
- No broad `Meteor.isTest` override was added.

## Runtime Ownership

Planned ownership shape:

Route/auth/subscriptions -> surviving `usePredictionSession` owner -> presentation selection host -> Standard or lazy Kaplay preview.

The Kaplay runtime must not own prediction answers, revisions, message variants, dirty/discard state, conflicts or submission state.

Implementation so far:

- `usePredictionSession(...)` remains in `PredictionEntrySession` above the
  presentation host.
- `PredictionPresentationHost` selects Standard versus preview below that owner.
- `KaplayMatchResultPreview` receives the existing session state/actions and
  dispatches only `selectBuiltInChoice('matchResult', value)` after checking the
  current session still supports the Match Result preview.
- Runtime snapshots contain display text, selected state, choices and a session
  key only; answers are not duplicated as authoritative state.

## Implementation Checkpoints

1. Dependency/import boundary and preview policy: completed.
   - Kaplay dependency installed and version recorded.
   - Pure preview setting resolution, preference storage, reduced-motion hook
     and effective-mode projection added.
   - Actual `kaplay` import is dynamic inside
     `createDefaultKaplayMatchResultRuntime`.
2. Runtime ownership/loading/cleanup: completed.
   - Owned canvas, `global: false`, conservative pixel density and
     `touchToMouse: false` implemented.
   - Runtime adapter registers KAPLAY `onError`, `onLoadError`, `quit()`
     cleanup, context-loss handling, visibility pause and idempotent disposal.
   - React component uses a generation guard, initialization timeout and late
     completion disposal path.
3. Interactive Match Result integration: completed.
   - Match Result canvas scene draws real current team names plus Draw, current
     question/helper/deduction text and selected feedback.
   - Canvas pointer selection dispatches the shared session action.
   - DOM semantic radio bridge provides keyboard selection from the same state
     and action.
   - Shared Back/Continue/Return controls are available in the preview and use
     the existing session actions.
4. Fallback/lifecycle verification: completed.
   - Added pure policy/preference storage tests.
   - Added jsdom React lifecycle tests with mocked runtime factories and
     controlled promises.
   - Added focused real-browser Chromium preview tests covering real Kaplay
     canvas selection, Standard handoff, reduced-motion switch, delayed init
     cancellation, controlled pointer failure, context loss, keyboard
     selection and local preview-gate behavior.
5. Documentation and packaging: completed in closeout.
   - Platform and audit docs were drafted before compaction.
   - Closeout updated the audit/resume docs with actual final verification,
     screenshot regeneration and packaging status.

## Tests Run / Results

- `meteor npm run typecheck`
  - Initial run failed on an over-specified reduced-motion legacy listener type.
  - Rerun passed after using the DOM lib's declared media-query listener API.
- `meteor npm run test:unit -- tests/unit/prediction-presentation-mode.test.ts tests/unit/prediction-presentation-host.test.ts`
  - Initial run exposed Vitest/OXC JSX transform needs, then lifecycle selector
    harness timing.
  - Final run passed: 2 files, 10 tests.
- `meteor npm run test:e2e -- tests/e2e/kaplay-prediction-preview.spec.ts`
  - Initial run failed four selector assertions because Playwright matched
    "On" inside "Continue".
  - Rerun passed three tests and exposed a duplicate loading-copy selector.
  - Targeted failure-recovery rerun passed after selector fix.
  - Full rerun exposed a timing/state issue after delayed-load cancellation in
    the failure test; the test was made deterministic by reloading the same
    fixture before pointer/context-loss checks.
  - Final full run passed: 4 Chromium tests.

Screenshot evidence:

- `test-results/ccpp009b/desktop-match-result-preview.png`
- `test-results/ccpp009b/desktop-match-result-selected.png`
- `test-results/ccpp009b/narrow-match-result-preview.png`
- `test-results/ccpp009b/standard-after-fallback.png`

## Closeout Run - 2026-09-18

The interrupted changed-file Prettier command was checked with
`./node_modules/.bin/prettier --check --ignore-unknown <CCPP-009B changed files>`
and passed, so formatting had completed before compaction.

Static checks actually executed during closeout:

- `node -p "require('./node_modules/kaplay/package.json').version"`:
  `3001.0.19`.
- `./node_modules/.bin/prettier --check --ignore-unknown <CCPP-009B changed files>`:
  passed before further source edits and passed again after final source/doc
  updates.
- `meteor npm run typecheck`: passed.
- `meteor npm run lint:project`: passed.
- `git diff --check`: passed.
- `meteor npm run lint`: initially failed on React hook lint issues in the new
  host/preference/reduced-motion code and one unescaped apostrophe; passed
  after a scoped correction.
- `meteor npm run test:unit -- tests/unit/prediction-presentation-mode.test.ts tests/unit/prediction-presentation-host.test.ts`:
  rerun after the correction and passed, 2 files / 10 tests.
- `meteor npm run test:e2e -- tests/e2e/kaplay-prediction-preview.spec.ts`:
  rerun because the screenshot directory was missing; passed, 4 Chromium tests,
  and regenerated the visual evidence.

Closeout correction:

- The presentation host now keys runtime status/failure by active prediction
  session rather than synchronously resetting state in effects.
- The browser preference and reduced-motion hooks derive state from current
  inputs without synchronous effect setters.
- The fallback message apostrophe was escaped for JSX lint compliance.

Prior reported checks not rerun during closeout:

- The 57-test focused unit regression set covering session hook/reducer,
  sequence, predictions and presentation tests.
- The 3-test Standard browser regression slice covering submit/revisit,
  persisted locked display and stale conflict preservation.

Visual evidence status:

- The previously reported `test-results/ccpp009b` screenshot directory was not
  present at resume.
- The focused preview browser spec regenerated the four screenshots.
- The regenerated desktop preview, selected state, narrow viewport and
  Standard fallback screenshots were visually inspected.
- The regenerated evidence was copied to
  `/tmp/ccpp009b-preserved-evidence-20260918/ccpp009b` before packaging.

Packaging status:

- Created
  `rugby-rooster-ccpp009b-kaplay-runtime-fallback-eomd-20260918.zip`.
- `zipinfo -1` confirmed the expected allowlisted source, docs, safe configs,
  tests and screenshots.
- `unzip -t` reported no compressed-data errors.
- Final audit/resume packaging status was refreshed after ZIP creation and
  updated into the archive before final handoff.

No CCPP-009C work was started.
