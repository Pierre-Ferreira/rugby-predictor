# CCPP-009C2 Compact Layout Playback Audit

## Status

Closeout documentation, retained browser evidence preservation, static
verification, and EOMD packaging are complete.

The recorded focused browser result remains `7 passed / 1 failed`. The browser
budget was exhausted before this closeout conversation, so the small
dirty-session test-precondition correction was not rerun and must not be
treated as an `8/8` browser pass.

## Scope

CCPP-009C2 was bounded to the existing development/test Match Result Kaplay
surface:

- fit readable compact choices inside the complete projected stage;
- propagate the projected stage height through runtime drawing, hit testing,
  canvas sizing, focus geometry, and evidence measurements;
- preserve the prepared 009C Rooster artwork and atlas unchanged;
- capture and preserve fresh normal-speed, slowed, desktop, and mobile browser
  evidence when the bounded browser run executed.

No new Kaplay screens, Review/submission animation, prediction scoring changes,
server prediction APIs, authentication changes, process-cleanup redesign,
production rollout, or artwork regeneration were in scope.

## Current Source And Assets

The prepared Rooster asset set remains the accepted source/runtime baseline and
was not regenerated:

- `imports/ui/predictions/kaplay/roosterShoveManifest.generated.json`
- `public/assets/rooster/match-result/rooster-shove-atlas.png`
- `public/assets/rooster/match-result/rooster-shove-manifest.json`
- `public/assets/rooster/match-result/frames/`
- `assets/source/rooster/cartoon_rooster_running_sprite_sheet.png`
- `assets/source/rooster/rooster_animation_loops_reference_sheet.png`
- `scripts/prepare-rooster-shove-assets.mjs`

The runtime sprite remains `rooster-shove`, with run frames `0, 1, 2, 3` and
pushRun frames `4, 5, 6, 7`.

## Source Changes Before Closeout

The interrupted 009C2 implementation was already present in the working tree at
the start of this closeout:

- `imports/ui/predictions/kaplay/matchResultMotion.ts` keeps the stable logical
  width at `720`, derives compact displayed scale from measured canvas width,
  wraps labels and picked text before placement, derives minimum logical card
  heights from `44px` target controls and readable label sizes, and grows the
  stage height for the tallest initial or selected/rejected arrangement.
- The compact stage reserves the requested lower canvas width boundary around
  272 CSS px so 390 px and 360 px mobile-style resizes do not clip content.
- `imports/ui/predictions/kaplay/matchResultRuntime.ts` initializes and draws
  against the projected stage height, maps pointer input through that stage,
  exposes test-control-gated content bounds, and preserves the 009C1 continuous
  shove projection.
- `imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx` measures the
  actual canvas shell width and applies the projected stage aspect ratio rather
  than the old fixed `18 / 13` display ratio.
- `tests/e2e/kaplay-prediction-preview.spec.ts` writes default 009C2 evidence
  paths and captures desktop, normal-speed, slowed, 390 px, and 360 px evidence
  in the focused Kaplay browser run.

The 009C1 motion corrections are preserved: push starts from the contact
endpoint, contact-to-push movement is continuous, full transformed Rooster
bounds are projected, rejected-group clearance is projected, and the shove
action remains short at about `0.76` seconds.

## Previous-Run Results

These outcomes were reported by the interrupted 009C2 conversation before this
closeout. Where retained logs verify an item, that is noted below.

- Focused motion/layout and host unit/component run: reported passed,
  `47` tests.
- `npm run typecheck`: reported passed before browser execution.
- `npm run lint`: reported passed before browser execution.
- `npm run lint:project`: reported passed before browser execution.
- Test discovery: reported eight focused browser tests.
- First browser attempt:
  - retained at
    `/tmp/rugby-rooster-ccpp009c2-browser-20260918`;
  - retained `exit.json` records exit code `1`, duration `2968` ms, and no
    failed test id in `.last-run.json`;
  - retained launch/process evidence shows the attempt exited before executable
    cases were recorded.
- Second permitted browser attempt:
  - retained at
    `/tmp/rugby-rooster-ccpp009c2-browser-rerun-20260918`;
  - retained `playwright-stdout.log` verifies eight focused tests ran,
    `7 passed / 1 failed`;
  - retained `exit.json` records exit code `1` and duration `65364` ms.
- Normal recording:
  - retained file:
    `browser-artifacts/match-result-shove-normal-speed.webm`;
  - `ffprobe -count_frames` in closeout verified `65` frames at `926 x 669`;
  - approximate duration remains the previous-run report, about `2.594`
    seconds, because this WebM did not expose container duration metadata to
    `ffprobe`.
- Slowed recording:
  - retained file:
    `browser-artifacts/match-result-shove-slow-review.webm`;
  - `ffprobe -count_frames` in closeout verified `117` frames at `926 x 669`;
  - approximate duration remains the previous-run report, about `4.724`
    seconds, because this WebM did not expose container duration metadata to
    `ffprobe`.
- Retained 390 px measurement JSON verifies:
  - canvas CSS width `314px`;
  - projected stage `720 x 716`;
  - label sizes around `16.14` CSS px for initial choices;
  - card target heights around `47.1` to `71.85` CSS px depending on wrapped
    state.

The different launch outcomes occurred in different execution environments.
This audit records that coincidence only; it does not claim a proven
sandbox/HMR historical root cause.

## Preserved Evidence

Before running closeout checks, both retained evidence trees were copied to:

`/tmp/rugby-rooster-ccpp009c2-preserved-closeout-20260918`

The copied evidence includes:

- first-attempt `exit.json`, `launch-manifest.json`, `.last-run.json`, and
  process event/snapshot records;
- second-attempt `exit.json`, `launch-manifest.json`, `.last-run.json`,
  `playwright-stdout.log`, `playwright-stderr.log`, `runner-output.jsonl`, and
  process event/snapshot records;
- normal-speed integrated WebM and contact sheet;
- slowed integrated WebM and contact sheet;
- normal recording extracted frames;
- desktop default/selected screenshots;
- 390 px mobile preview, Draw rejected, settled, and canvas crop screenshots;
- 360 px mobile preview, Draw rejected, settled, and canvas crop screenshots;
- `mobile-layout-measurements.json`;
- dirty-session failure screenshot, video, and error context.

Raw Playwright trace ZIPs and raw process snapshots are preserved privately in
the copied evidence tree but are not included in the sanitized review ZIP.
Process snapshots contain unrelated local process details. The raw trace may
contain browser/session state. The review ZIP includes sanitized failure
context, screenshots, logs, launch manifests, exit records, process events, and
media instead.

## Visual Evidence Inspected

CCPP-009C3 correction note: the normal-speed footage shows the Rooster entering
left-to-right. The earlier wording that described entry from the right was a
direction typo only; the historical execution outcomes below are unchanged.

The normal-speed recording is the primary integrated playback evidence.
Closeout inspection opened and reviewed:

- `match-result-shove-normal-contact-sheet.png`:
  - selectable choices;
  - Rooster head-first left-to-right entry;
  - leg cycling while moving;
  - contact with the rejected stack;
  - continuous push;
  - rejected choices exiting;
  - selected answer remaining.
- `match-result-shove-slow-contact-sheet.png`:
  - same motion sequence at slower timing;
  - supplemental motion evidence only, because text appears as dark blocky
    glyphs in this sheet.
- `normal-shove-exit-frame.png`:
  - selected card remains at top while the Rooster pushes rejected choices.
- `normal-shove-settled-frame.png`:
  - selected answer remains after complete exit.
- `mobile-390-match-result-preview.png`:
  - unselected initial choice state at the 390 px viewport.
- `mobile-360-choice-area-crop.png`:
  - restored choices with the previous Draw selection still highlighted, not a
    fresh untouched initial state.
- `test-failed-1.png` from the dirty-session case:
  - selected-answer presentation with the selected Springboks card and no
    selectable card stack.

`normal-shove-contact-frame.png` opened successfully but visibly shows the
pre-contact choices rather than the contact moment, so it is not cited as the
contact proof.

## Recorded Browser Failure

The failing second-attempt case was:

`preserves a dirty saved custom prediction through same-session runtime failure`

Retained `playwright-stdout.log` and `error-context.md` show:

- the test had already reached Match Result with the existing team-one answer
  selected;
- the page snapshot exposed a checked radio for that selected answer;
- `Change my selection` was visible;
- the selected-answer presentation intentionally made projected canvas cards
  non-hit-testable;
- the test called `clickCanvasChoice(page, 0)` before using `Change my
selection`;
- the helper failed with `Kaplay choice layout is not currently hit-testable`.

This confirms the test-precondition explanation. The evidence does not prove an
application defect in selected-card hit testing.

## Closeout Source Correction

During closeout, only the dirty-session browser spec sequence was corrected:

- file: `tests/e2e/kaplay-prediction-preview.spec.ts`;
- after Kaplay readiness in the dirty-session protected segment, the test now
  clicks the visible `Change my selection` action;
- it waits for the test-control-gated runtime layout to contain three
  hit-testable choices and no selected-only card;
- it then uses `clickCanvasChoice(page, 0)`, preserving real canvas pointer
  input;
- dirty built-in/custom-answer assertions, revision checks,
  failure-recovery assertions, and explicit revised-save assertions are kept.

No hidden semantic controls are force-clicked. No inactive selected cards were
made interactive for the test. No session actions are invoked directly. No
reload/relogin/reseed was added after dirty edits. The requirement that real
Kaplay becomes ready remains.

Test precondition updated after the 7/8 run; browser correction not rerun.

## Closeout Verification

Checks executed during this closeout:

- `file` on representative retained WebM/PNG evidence:
  - passed; files were recognized as WebM or PNG.
- `identify -format '%f %wx%h\n'` on retained PNG evidence:
  - passed; representative screenshot/contact-sheet dimensions were reported.
- `ffprobe -v error -count_frames ... match-result-shove-normal-speed.webm`:
  - passed; `65` frames, `926 x 669`.
- `ffprobe -v error -count_frames ... match-result-shove-slow-review.webm`:
  - passed; `117` frames, `926 x 669`.
- `ffprobe` on the dirty-session failure video:
  - passed; duration `14.000000` seconds, `350` frames, `800 x 450`.
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

## Remaining Limitations

- Browser result remains `7 passed / 1 failed` for the recorded 009C2 run.
- The dirty-session browser spec correction is unrerun because the permitted
  browser budget was already exhausted.
- The first browser launch remains a zero-case failure.
- Raw trace/process-snapshot evidence remains private rather than included in
  the sanitized review ZIP.
- CCPP-009C2 is not milestone acceptance and does not begin CCPP-009D.

## Package

Review archive:

`rugby-rooster-ccpp009c2-compact-layout-playback-eomd-20260918.zip`

The archive includes corrected layout/runtime/preview source, relevant
unchanged host/session context, exact runtime assets/manifests and preparation
context, current unit/browser tests, fresh normal/slowed recordings,
desktop/mobile screenshots and measurements, sanitized failure and launch
evidence, a source/run/evidence manifest, updated docs, and actual closeout
command outcomes.

Excluded from the archive:

- secrets and private settings;
- dependencies;
- Meteor/build caches;
- unrelated archives;
- raw Playwright trace ZIPs;
- raw process snapshots with unrelated local process command lines.

Package verification completed:

- `zipinfo -t rugby-rooster-ccpp009c2-compact-layout-playback-eomd-20260918.zip`
  - passed.
- `unzip -t rugby-rooster-ccpp009c2-compact-layout-playback-eomd-20260918.zip`
  - passed with no compressed-data errors.
- Media entries extracted from the ZIP opened through `ffprobe`:
  - normal-speed WebM: `65` frames;
  - slowed WebM: `117` frames;
  - dirty-session failure video: `14.000000` seconds.
