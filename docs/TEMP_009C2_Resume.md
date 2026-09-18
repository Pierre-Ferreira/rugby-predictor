# CCPP-009C2 Resume Checkpoint

## Scope

Created early on 2026-09-18 for CCPP-009C2 after the provisional CCPP-009C1
state.

This milestone finishes the existing Match Result Kaplay interaction only:

1. Fit readable compact choices inside the complete stage.
2. Capture the actual browser-launch outcome and make only an evidenced small
   launch/output correction if needed.
3. Produce fresh integrated shove playback and mobile evidence when the bounded
   browser run executes.

No new Kaplay question screens, Review/submission animation, prediction scoring
changes, session ownership changes, server prediction API changes, artwork
regeneration, or broad platform redesign are in scope.

## Inspected Source

- `AGENTS.md`
- `imports/ui/predictions/kaplay/matchResultMotion.ts`
- `imports/ui/predictions/kaplay/matchResultRuntime.ts`
- `imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx`
- `imports/ui/predictions/kaplay/roosterShoveManifest.generated.json`
- `tests/unit/match-result-motion.test.ts`
- `tests/e2e/kaplay-prediction-preview.spec.ts`
- `scripts/run-playwright-tests.mjs`
- `playwright.config.ts`
- `tests/unit/test-launchers.test.ts`
- `docs/AUDIT_009C1_Shove_Exit_Mobile_Evidence.md`
- `docs/TEMP_009C1_Resume.md`
- `docs/PLATFORM_Kaplay_Predictions.md`
- `docs/PLATFORM_Testing.md`
- `docs/CORE_Predictions.md`

Initial `git status --short` was clean.

## Current Source And Asset State

The prepared Rooster asset set remains the accepted baseline and was not
regenerated:

- generated source manifest:
  `imports/ui/predictions/kaplay/roosterShoveManifest.generated.json`
- runtime atlas path:
  `/assets/rooster/match-result/rooster-shove-atlas.png`
- sprite name: `rooster-shove`
- run frames: `0, 1, 2, 3`
- pushRun frames: `4, 5, 6, 7`

The 009C1 motion corrections are present in source and must be preserved:

- push starts from the contact endpoint;
- contact-to-push movement is continuous;
- full transformed Rooster bounds are projected;
- rejected-group clearance is projected;
- total action remains approximately `0.76` seconds.

The remaining compact layout defect is structural: the pure projection still
returns a fixed `720 x 520` stage, and the React canvas still uses a fixed
`18/13` displayed aspect. Compact card height is not derived from actual display
scale and content, so sufficiently narrow canvases can make readable labels and
wrapped selected/rejected stacks exceed the old stage arrangement.

## Chosen Layout Correction

Use the existing projection as the single geometry model, but make compact
stage height content-driven:

- keep a stable logical stage width of `720`;
- derive display scale from measured canvas CSS width divided by logical stage
  width;
- derive minimum logical card heights from CSS targets (`44px` selectable
  height, `16px` primary labels, `14px` picked status);
- wrap labels and picked text before placing cards;
- compute initial and selected/rejected stack height before returning layout;
- grow stage height when any complete static arrangement needs more than the
  baseline height;
- propagate returned stage dimensions to runtime drawing, pointer conversion,
  canvas CSS aspect ratio, focus geometry, selected/rejected positions, Rooster
  ground/contact/exit projection, and browser evidence measurements.

This preserves the accepted 009C1 motion logic while removing the old fixed
desktop-height clipping assumption.

## Checks And Outcomes

Checkpoint A completed.

Source changes made:

- `matchResultMotion.ts` now derives compact minimum card height from the
  `44px` displayed target and label fonts from the `16px` displayed target.
- The pure projection now builds initial and all selected arrangements through
  the same `projectChoice` path, reserves the tallest required compact stage,
  and keeps a stable logical width of `720`.
- Compact stage height reserves the requested lower canvas width boundary of
  `272px` so ordinary 390px-to-360px style resizes do not need runtime
  recreation to avoid clipping.
- The selected/rejected arrangement keeps the selected answer above the
  rejected group, grows the stage for wrapped labels, and derives Rooster lane
  height from the rejected stack while preserving 009C1 horizontal contact and
  exit timing.
- `matchResultRuntime.ts` initializes Kaplay with the projected stage height,
  draws against the projected stage, maps pointer coordinates through the
  projected stage, and exposes content bounds in test-only debug evidence.
- `KaplayMatchResultPreview.tsx` measures the actual canvas shell width and
  applies the projected `stage.width / stage.height` aspect ratio instead of
  the fixed `18/13` canvas ratio.
- `kaplay-prediction-preview.spec.ts` now writes default 009C2 evidence paths
  and captures mobile initial, Draw rejected, settled, and crop evidence at
  390px and 360px in one prediction session.

Checks run:

- `npm run test:unit -- tests/unit/match-result-motion.test.ts`
  - passed: 1 file, 25 tests.
- `npm run test:unit -- tests/unit/match-result-motion.test.ts tests/unit/prediction-presentation-host.test.ts`
  - passed: 2 files, 47 tests.
- `npm run typecheck`
  - passed.
- `npm run lint`
  - passed.
- `npm run lint:project`
  - passed.

Planned checkpoint B:

- inspect launcher discovery/output capture before browser execution;
- one instrumented browser batch;
- one additional browser batch only after a directly evidenced small correction.

Planned checkpoint C:

- final docs/checks;
- EOMD package with current source, tests, docs, evidence, and manifest.

## Browser-Run Budget

CCPP-009C1 spent its two browser attempts and recorded zero test cases executed.
For 009C2 the allowed budget is:

- one planned instrumented browser batch after unit/static checks;
- one further batch only after a directly justified correction.

Test listing or static launcher inspection does not count as a browser batch.
Failed launches do count. Source/docs will not be edited while a watched browser
batch is running.

## Next Action

Implement checkpoint A: content-driven compact layout, consistent runtime/canvas
stage propagation, and expanded pure/component regressions for the requested
canvas widths and selection states.
