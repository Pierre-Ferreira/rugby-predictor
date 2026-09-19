# CCPP-009C2 Resume Checkpoint

## Status

CCPP-009C2 closeout is complete as of 2026-09-18.

Do not restart CCPP-009C2. Do not regenerate the Rooster artwork or prepared
atlas. Do not begin CCPP-009D from this checkpoint.

This checkpoint now reflects the post-compaction closeout: retained browser
evidence was preserved, the missing audit was created, a small dirty-session
test-precondition correction was made, static checks were run, and the EOMD
review ZIP was created.

## Scope

CCPP-009C2 finished the existing Match Result Kaplay interaction only:

1. Fit readable compact choices inside the complete projected stage.
2. Capture and preserve actual browser-launch outcomes.
3. Preserve fresh integrated normal-speed/slowed shove playback and mobile
   evidence from the bounded browser run.
4. Package current source, docs, tests, assets, and sanitized evidence for
   review.

No new Kaplay question screens, Review/submission animation, prediction scoring
changes, session ownership changes, server prediction API changes, artwork
regeneration, or broad platform redesign were added.

## Current Source And Asset State

The prepared Rooster asset set remains the accepted baseline and was not
regenerated:

- generated source manifest:
  `imports/ui/predictions/kaplay/roosterShoveManifest.generated.json`
- runtime atlas path:
  `public/assets/rooster/match-result/rooster-shove-atlas.png`
- runtime manifest path:
  `public/assets/rooster/match-result/rooster-shove-manifest.json`
- sprite name: `rooster-shove`
- run frames: `0, 1, 2, 3`
- pushRun frames: `4, 5, 6, 7`

The 009C1 motion corrections are preserved:

- push starts from the contact endpoint;
- contact-to-push movement is continuous;
- full transformed Rooster bounds are projected;
- rejected-group clearance is projected;
- total action remains approximately `0.76` seconds.

The 009C2 layout/runtime correction is present:

- `matchResultMotion.ts` derives compact minimum card height from displayed
  `44px` controls and label fonts from displayed `16px` targets;
- compact stage height is content-driven while logical stage width remains
  `720`;
- stage height is reserved for both initial and selected/rejected
  arrangements;
- the lower canvas width boundary around 272 CSS px is reserved;
- selected/rejected stacks wrap long labels and preserve separation;
- `matchResultRuntime.ts` initializes/draws/maps pointer input against the
  projected stage;
- `KaplayMatchResultPreview.tsx` measures canvas shell width and applies the
  projected stage aspect ratio;
- the browser spec writes 009C2 evidence paths and captures normal/slowed,
  desktop, 390 px, and 360 px evidence.

## Prior Run Results

Before closeout, the interrupted conversation reported:

- focused motion/layout and host tests: `47` passed;
- `npm run typecheck`: passed;
- `npm run lint`: passed;
- `npm run lint:project`: passed;
- browser test discovery: eight focused tests;
- first browser attempt: exited before cases executed;
- second permitted browser attempt: `7 passed / 1 failed`;
- normal recording: `65` frames, approximately `2.594` seconds;
- slowed recording: `117` frames, approximately `4.724` seconds;
- 390 px viewport measurements:
  - canvas width `314px`;
  - stage `720 x 716`;
  - labels approximately `16.14` CSS px;
  - card heights approximately `47-72` CSS px.

Retained logs verified the second browser run as `7 passed / 1 failed`, and
closeout `ffprobe` verified `65` and `117` frames for the normal/slowed WebMs.
The WebM files did not expose duration metadata to `ffprobe`, so durations
remain previous-run reports.

## Preserved Evidence

Original retained evidence paths:

- `/tmp/rugby-rooster-ccpp009c2-browser-20260918`
- `/tmp/rugby-rooster-ccpp009c2-browser-rerun-20260918`

Closeout copied both trees to:

`/tmp/rugby-rooster-ccpp009c2-preserved-closeout-20260918`

The copied evidence contains launch/exit records, runner/server logs,
process-event records, normal/slowed WebMs, contact sheets, extracted frames,
desktop screenshots, 360/390 mobile screenshots/crops, mobile measurement JSON,
and dirty-session failure screenshot/video/error context.

Raw traces and raw process snapshots remain private and are not included in the
sanitized review ZIP.

## Dirty-Session Browser Failure

The retained failure artifact confirms the test reached the existing
selected-answer presentation:

- selected answer was visible;
- the selected radio was checked;
- `Change my selection` was visible;
- projected selected cards were intentionally non-hit-testable.

The failed sequence attempted `clickCanvasChoice(page, 0)` without first using
`Change my selection`. That explains
`Kaplay choice layout is not currently hit-testable`.

Closeout changed only `tests/e2e/kaplay-prediction-preview.spec.ts`:

- click `Change my selection`;
- wait for three hit-testable projected choices and no selected-only card;
- then use actual canvas pointer input through `clickCanvasChoice(page, 0)`;
- keep dirty built-in/custom-answer, revision, failure-recovery, and
  explicit-save assertions.

Test precondition updated after the 7/8 run; browser correction not rerun.

## Visual Evidence Notes

Normal-speed footage is the primary integrated playback evidence. Slowed
footage and contact sheets supplement it.

Closeout inspection confirmed:

- head-first Rooster entry;
- leg cycling;
- contact in the contact sheet;
- continuous push;
- complete exit;
- selected answer remaining after exit;
- compact text/target measurements and content fit.

State distinction to preserve:

- `mobile-390-match-result-preview.png` is an unselected initial choice state.
- `mobile-360-choice-area-crop.png` is restored choices with the previous Draw
  selection still highlighted, not a fresh untouched initial state.

Do not relabel one as the other.

## Closeout Checks

Checks executed during closeout:

- `file` on representative retained media:
  - passed.
- `identify -format '%f %wx%h\n'` on retained PNG evidence:
  - passed.
- `ffprobe -v error -count_frames ... match-result-shove-normal-speed.webm`:
  - passed; `65` frames.
- `ffprobe -v error -count_frames ... match-result-shove-slow-review.webm`:
  - passed; `117` frames.
- `ffprobe` on the dirty-session failure video:
  - passed; duration `14.000000` seconds, `350` frames.
- `npm run typecheck`:
  - passed.
- `npm run lint`:
  - passed.
- `npm run lint:project`:
  - passed.
- `./node_modules/.bin/prettier --check` on changed source/docs:
  - passed.
- `git diff --check`:
  - passed after final documentation edits.

No closeout browser tests were run. No unit/component tests were rerun during
closeout because only the e2e test sequence and documentation changed after the
previous reported unit/component pass.

## Review Package

Review archive:

`rugby-rooster-ccpp009c2-compact-layout-playback-eomd-20260918.zip`

The archive includes current source/tests/docs/assets, fresh normal/slowed
recordings, desktop/mobile screenshots and measurements, sanitized failure and
launch evidence, and source/run/evidence manifests.

Package verification completed with:

- `zipinfo -t`
- `unzip -t`
- `ffprobe` on extracted ZIP media entries

## Next Action

Stop. Do not start another browser run or another milestone from this
checkpoint.
