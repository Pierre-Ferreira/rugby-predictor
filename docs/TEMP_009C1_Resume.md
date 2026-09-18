# CCPP-009C1 Resume Checkpoint

## Status

Created early on 2026-09-18 before source edits for CCPP-009C1.

CCPP-009C1 is the corrective finish for the existing Match Result Rooster
interaction. It has three correction areas only:

1. Continuous, complete shove geometry.
2. Readable mobile choices in displayed CSS pixels.
3. Actual browser/motion evidence with complete normal-speed and slowed review
   recordings.

Rugby Rooster remains a standalone development product. The prepared 009C
source artwork, runtime frames, atlas, and manifest are present and must be
reused unchanged unless a concrete current asset defect is discovered.

## Current Source And Asset Paths

Inspected or identified:

- `AGENTS.md`
- `imports/ui/predictions/kaplay/matchResultMotion.ts`
- `imports/ui/predictions/kaplay/matchResultRuntime.ts`
- `imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx`
- `imports/ui/predictions/kaplay/roosterShoveManifest.generated.json`
- `public/assets/rooster/match-result/rooster-shove-manifest.json`
- `public/assets/rooster/match-result/rooster-shove-atlas.png`
- `public/assets/rooster/match-result/frames/`
- `assets/source/rooster/cartoon_rooster_running_sprite_sheet.png`
- `assets/source/rooster/rooster_animation_loops_reference_sheet.png`
- `tests/unit/match-result-motion.test.ts`
- `tests/unit/prediction-presentation-host.test.ts`
- `tests/e2e/kaplay-prediction-preview.spec.ts`
- `docs/AUDIT_009C_Visual_Foundation_Rooster_Shove.md`
- `docs/TEMP_009C_Resume.md`
- `docs/PLATFORM_Kaplay_Predictions.md`
- `docs/PLATFORM_Testing.md`
- `docs/MAP_System.md`
- `docs/MAP_Rooster_Assets.md`
- `docs/CORE_Predictions.md`

Initial `git status --short` was clean.

## Intended Small Changes

- In `matchResultMotion.ts`, derive the push phase from the actual contact
  endpoint so rejected cards and Rooster movement are continuous at
  `ROOSTER_SHOVE_PUSH_START_SECONDS`.
- In `matchResultMotion.ts`, compute exit travel from the layout stage,
  rejected-group geometry, sprite scale/anchor/contact offset, and a margin so
  the transformed Rooster trailing edge and rejected choices have cleared before
  the effect expires.
- In the motion/layout layer, make compact geometry reflect the actual canvas
  CSS width so displayed labels are at least approximately 16 CSS px and choice
  targets at least 44 CSS px on 360 px and 390 px portrait viewports.
- In `matchResultRuntime.ts`, use the same responsive projection for drawing,
  pointer conversion, focus outlines, and shove calculations.
- In `tests/e2e/kaplay-prediction-preview.spec.ts`, repair the canvas recording
  path and stale click geometry so browser evidence exercises actual canvas
  input and preserves the mounted scene until recording finalization.
- Create `docs/AUDIT_009C1_Shove_Exit_Mobile_Evidence.md` and update only
  relevant platform/map docs after verification.

No changes are expected to prediction session ownership, server prediction APIs,
authentication, or process cleanup.

## Completed Work

- Initial status/doc/source inspection completed.
- Existing 009C short WebM recordings identified as historical incomplete
  evidence only; they will not be reused as proof.
- Checkpoint A/B/C plan established:
  - A: geometry correction and pure tests.
  - B: mobile layout and input verification.
  - C: browser playback evidence, docs, and packaging.
- Checkpoint A completed:
  - push phase now starts from the contact endpoint;
  - final travel is derived from stage right edge, manifest contact anchor,
    sprite scale, rejected-group geometry, and an offscreen margin;
  - transformed Rooster bounds are projected for full-character exit
    assertions;
  - compact layout projects readable labels, wrapped long names, selection
    indicator bounds, and hit rectangles from one shared geometry layer.
- Checkpoint B source/test alignment completed:
  - runtime drawing consumes projected text blocks and indicator bounds;
  - isolated browser tests can read test-control-gated layout measurements from
    the runtime's actual projection;
  - canvas click helper now targets the projected choice rect instead of stale
    hard-coded positions;
  - canvas recording helper waits for recorder start and finalized media output
    before stopping tracks;
  - browser spec now records 360 px and 390 px mobile measurements, a mobile
    canvas crop, normal and slowed playback windows, and Off-during-motion
    Standard evidence.

## Tests And Evidence Outcomes

Run before the browser batch:

- `npm run test:unit -- tests/unit/match-result-motion.test.ts
tests/unit/prediction-presentation-host.test.ts`
  - passed: 2 files, 36 tests.
- `npm run typecheck`
  - passed.
- `npm run lint`
  - passed.
- `npm run lint:project`
  - passed.
- `git diff --check`
  - passed.

Planned browser budget:

- one focused browser batch after unit/static checks;
- at most one additional browser batch after an evidenced correction.

First browser batch:

- `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=artifacts/ccpp009c1-browser-20260918 npm
run test:e2e -- tests/e2e/kaplay-prediction-preview.spec.ts --workers=1
--retries=0`
  - exited with code 1 after about 4.0 seconds;
  - `.last-run.json` reported `failedTests: []`;
  - process snapshots show Playwright spawned Meteor and then closed while
    Meteor was still starting;
  - no screenshots, recordings, or per-test browser artifacts were produced;
  - preserved evidence is in `artifacts/ccpp009c1-browser-20260918/`.

Remaining browser-run budget after the evidenced command correction: 1
conditional correction batch.

Correction browser batch:

- `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=artifacts/ccpp009c1-browser-rerun-20260918
npm run test:e2e -- kaplay-prediction-preview.spec.ts --workers=1
--retries=0`
  - exited with code 1 after about 3.0 seconds;
  - `.last-run.json` reported `failedTests: []`;
  - process snapshots again show Playwright spawning Meteor and then closing
    while Meteor was still starting;
  - no screenshots, recordings, mobile measurements, or per-test artifacts were
    produced;
  - preserved evidence is in
    `artifacts/ccpp009c1-browser-rerun-20260918/`.

Remaining browser-run budget after the correction batch: 0. No additional
browser runner investigation should be started for this CCPP.

EOMD package:

- `rugby-rooster-ccpp009c1-shove-exit-mobile-evidence-eomd-20260918.zip`
  created from explicit copied paths.
- `zipinfo -t` passed: 82 files, 11,740,376 bytes uncompressed.
- `unzip -t` passed with no compressed-data errors.
- Included historical 009C WebMs were readable with `ffprobe`; durations remain
  `0.253016` seconds and `0.216625` seconds and are documented as failed
  historical evidence only.
- Repository originals remained present after packaging.

## Next Action

Stop after final ZIP refresh and final status response. Do not start another
milestone or browser runner.
