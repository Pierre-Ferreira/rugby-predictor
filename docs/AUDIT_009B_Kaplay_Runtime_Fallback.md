# AUDIT 009B Kaplay Runtime Fallback

## Scope

CCPP-009B implements a development/test-only Kaplay runtime preview for the
Match Result prediction step. Rugby Rooster remains a standalone product and no
Rugby Tracker / Rucks and Mauls architecture, branding, permissions, or product
features were imported.

Implemented:

- `kaplay@3001.0.19` dependency and lockfile entry.
- Settings-gated preview availability for non-production development/test
  setups.
- DOM Animations On/Off control with resilient local preference persistence.
- Reduced-motion observation and immediate Standard fallback.
- Effective-mode policy that keeps gate, preference, reduced motion, step
  support, and runtime state separate.
- Lazy client-only Kaplay import.
- Owned canvas and non-global KAPLAY context.
- Bounded initialization timeout of `10_000ms`.
- Runtime cleanup with `quit()`, listener/controller disposal, obsolete
  generation guards, visibility pause, and context-loss fallback.
- One real interactive Kaplay Match Result screen using the shared prediction
  session, actual fixture team names, Draw, current message text, current
  selected answer, and shared navigation actions.
- DOM semantic radio bridge for keyboard and accessible choice semantics.
- Standard fallback for unsupported steps, Off, reduced motion, loading cancel,
  initialization/runtime failure, and read-only persisted display.

Not implemented:

- Rooster production artwork.
- Shove/sprint animation.
- Full built-in/custom question Kaplay flow.
- Kaplay Review/submission.
- Public/default rollout.
- FPS-based quality fallback.
- New persistence schemas.
- Prediction/server redesign.
- Scores, leaderboards, result settlement, authentication/Postmark, service
  worker/offline caching, or admin UI refresh.

## Implementation Summary

`PredictionEntryPage.tsx` still owns route, authentication, subscriptions,
loading states, feedback, and read-only persisted saved-entry display. The
shared `usePredictionSession(...)` owner remains above presentation selection.

`PredictionPresentationHost` sits below the shared session and selects Standard
or the preview. It renders the external Animations control and owns runtime
failure latching/retry. It does not own prediction answers.

The preview imports `KaplayMatchResultPreview` lazily. That component creates
and updates a runtime snapshot for the canvas while rendering a DOM question
and radio bridge. The runtime adapter dynamically imports `kaplay`, constructs
the context with `global: false`, draws the Match Result choices, hit-tests
pointer input against canvas coordinates, and dispatches the shared
`selectBuiltInChoice` action only after current-step eligibility checks.

## Dependency And API Findings

- `kaplay@3001.0.19` is the installed and lockfile-resolved version.
- Official docs and local declarations match the required APIs:
  `kaplay(...)`, `KAPLAYOpt.canvas`, `KAPLAYOpt.global`,
  `KAPLAYOpt.pixelDensity`, `KAPLAYOpt.touchToMouse`, `ctx.quit()`,
  `ctx.onError(...)`, and `ctx.onLoadError(...)`.
- Local declarations show `onError` returns `void` and `onLoadError` returns
  `KEventController | undefined`.

## Preview Activation

Preview availability requires:

```json
{
  "public": {
    "rugbyRooster": {
      "kaplayPredictionPreview": {
        "enabled": true
      }
    }
  }
}
```

The gate is ignored in production. Missing/false settings mean unavailable.
Stored On preferences and query parameters cannot override the disabled
application gate.

The Playwright settings enable the preview and `testControls` for isolated
browser coverage. The development settings example documents the flag with
`enabled: false`.

## Verification

### Prior-Run Reported Results

The following results were reported before the remote-compaction interruption
and were not all repeated during the closeout:

- `meteor npm run typecheck` initially failed on an over-specified
  reduced-motion legacy listener type, then passed after correction.
- `meteor npm run test:unit -- tests/unit/prediction-presentation-mode.test.ts tests/unit/prediction-presentation-host.test.ts`
  initially exposed Vitest/OXC JSX transform needs and test harness timing,
  then passed: 2 files, 10 tests.
- `meteor npm run test:e2e -- tests/e2e/kaplay-prediction-preview.spec.ts`
  passed 4 Chromium tests after selector/loading/determinism fixes.
- `meteor npm run test:unit -- tests/unit/prediction-session-hook.test.ts tests/unit/prediction-session.test.ts tests/unit/prediction-sequence.test.ts tests/unit/predictions.test.ts tests/unit/prediction-presentation-mode.test.ts tests/unit/prediction-presentation-host.test.ts`
  passed: 6 files, 57 tests.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts -g "submits valid predictions\|shows persisted saved entry\|preserves unsaved answers"`
  passed: 3 Chromium tests covering Standard submit/revisit, locked persisted
  display, and stale conflict preservation.

### Closeout Checks Actually Executed

| Check                                                                                                                         | Result                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node -p "require('./node_modules/kaplay/package.json').version"`                                                             | Passed: `3001.0.19`.                                                                                                                                                                                                                                                       |
| `./node_modules/.bin/prettier --check --ignore-unknown <CCPP-009B changed files>`                                             | Passed before further source edits, confirming the interrupted changed-file formatting had completed. Final closeout rerun after source/doc updates also passed.                                                                                                           |
| `meteor npm run typecheck`                                                                                                    | Passed. Existing npm `nodedir` warning emitted.                                                                                                                                                                                                                            |
| `meteor npm run lint:project`                                                                                                 | Passed: project invariant check passed. Existing npm `nodedir` warning emitted.                                                                                                                                                                                            |
| `git diff --check`                                                                                                            | Passed.                                                                                                                                                                                                                                                                    |
| `meteor npm run lint`                                                                                                         | Initial closeout run failed on the new presentation host/preference/reduced-motion hooks: synchronous effect state resets, one memo dependency warning, and one unescaped apostrophe. Fixed without disabling rules. Rerun passed. Existing npm `nodedir` warning emitted. |
| `meteor npm run test:unit -- tests/unit/prediction-presentation-mode.test.ts tests/unit/prediction-presentation-host.test.ts` | Rerun after the lint correction passed: 2 files, 10 tests. Existing npm `nodedir` warning emitted.                                                                                                                                                                         |
| `meteor npm run test:e2e -- tests/e2e/kaplay-prediction-preview.spec.ts`                                                      | Rerun because the recorded screenshot directory was missing. Passed: 4 Chromium tests. Existing npm `nodedir` and `NO_COLOR`/`FORCE_COLOR` warnings emitted.                                                                                                               |

### Closeout Correction

One implementation correction was necessary during closeout. The presentation
host now keys runtime status/failure by the active prediction session instead
of synchronously resetting state in effects, and the browser preference and
reduced-motion hooks derive current input state without synchronous effect
setters. The rendered fallback apostrophe was escaped. No Kaplay runtime
reimplementation or milestone expansion was performed.

Skipped by design during closeout:

- the previously passing 57-test focused session/sequence/presentation unit
  set;
- the previously passing 3-test Standard browser regression slice.

## Browser Evidence

On closeout, the previously reported `test-results/ccpp009b` screenshot
directory was missing. The focused preview browser spec was rerun to regenerate
the evidence, and the regenerated files were inspected visually.

Regenerated by the passing focused preview browser spec:

- `test-results/ccpp009b/desktop-match-result-preview.png`
- `test-results/ccpp009b/desktop-match-result-selected.png`
- `test-results/ccpp009b/narrow-match-result-preview.png`
- `test-results/ccpp009b/standard-after-fallback.png`

Representative inspection confirmed:

- real Kaplay Match Result preview with current fixture team names and Draw;
- selected state reflected in the canvas and DOM radio bridge;
- narrow viewport rendering for long team names;
- Standard fallback after controlled runtime failure.

Tested browser/viewports:

- Chromium desktop default Playwright viewport.
- Chromium emulated narrow portrait viewport `390x760`.

This is not physical-device performance evidence.

## Known Limitations

- The animated preview is limited to Match Result.
- Other steps use Standard by design.
- Reduced motion always forces Standard.
- Runtime failure remains latched until explicit retry or deliberate On.
- Test-only fault controls exist only behind isolated preview settings and do
  not mutate answers or call prediction methods.
- No broad auth-navigation issue was reopened.

## Review Archive

Created and inspected review archive:

- `rugby-rooster-ccpp009b-kaplay-runtime-fallback-eomd-20260918.zip`

Inspection performed:

- `zipinfo -1 rugby-rooster-ccpp009b-kaplay-runtime-fallback-eomd-20260918.zip`
  confirmed the expected allowlisted dependency manifests, safe settings
  examples, prediction presentation source, contextual session/Standard source,
  changed tests, safe test configuration, docs and screenshots.
- `unzip -t rugby-rooster-ccpp009b-kaplay-runtime-fallback-eomd-20260918.zip`
  reported no compressed-data errors.

The archive excludes actual local private settings, secrets, `.env` files,
`node_modules`, `.meteor/local`, generated application builds/caches and
unrelated archives.
