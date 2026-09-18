# CCPP-009C1 Shove Exit, Mobile Readability & Browser Evidence Audit

## Status

Source correction, focused unit/component verification, static checks, and EOMD
packaging are complete.

The required integrated browser playback evidence is blocked. The one planned
browser batch and one correction batch both exited before Playwright executed
test cases. No 009C1 normal-speed WebM, slowed WebM, desktop screenshot, mobile
screenshot, mobile crop, Standard-after-interruption screenshot, or mobile
measurement JSON was produced. This audit does not claim visual acceptance from
unit tests, filenames, or the historical 009C short recordings.

## Scope

CCPP-009C1 was limited to the existing Match Result Kaplay screen:

- fix contact-to-push continuity;
- make the complete Rooster and rejected choices exit before effect removal;
- make compact choices readable in displayed CSS pixels;
- repair the browser recording and evidence path.

No additional Kaplay prediction screens, server contracts, prediction-session
ownership changes, authentication changes, process-cleanup changes, rollout
settings, or artwork regeneration were added.

## Asset Set

The prepared 009C asset set was verified and reused unchanged:

- `assets/source/rooster/cartoon_rooster_running_sprite_sheet.png`
- `assets/source/rooster/rooster_animation_loops_reference_sheet.png`
- `public/assets/rooster/match-result/frames/`
- `public/assets/rooster/match-result/rooster-shove-atlas.png`
- `public/assets/rooster/match-result/rooster-shove-manifest.json`
- `imports/ui/predictions/kaplay/roosterShoveManifest.generated.json`
- `scripts/prepare-rooster-shove-assets.mjs`

No source PNGs, prepared frames, atlas pixels, manifest metadata, source hashes,
or preparation outputs were regenerated.

## Source Changes

### Motion And Layout

`imports/ui/predictions/kaplay/matchResultMotion.ts` now projects one shared
geometry model for drawing, hit testing, focus bounds, readable text, and shove
motion.

The contact-to-push boundary now derives push start from the actual contact
endpoint:

- contact still nudges the rejected group and Rooster by 10 scene units;
- push starts at that nudged group position;
- Rooster contact relation to the rejected group remains stable through the
  boundary;
- push bounce starts from the contact endpoint height, avoiding a vertical snap.

The exit endpoint is no longer a stale desktop constant. It is derived from:

- the layout stage right boundary;
- the manifest contact anchor and rendered sprite scale;
- the rejected-group left/width geometry;
- a compact/desktop offscreen margin;
- a safety interval so representative 60 fps, 30 fps, and larger-frame samples
  are already clear before expiry.

`ShoveProjection` now includes `roosterBounds`, the full transformed draw bounds
for conservative exit assertions. The short total duration remains
`0.76` seconds.

Compact layout now accounts for displayed CSS pixels via `displayScale`.
Projected choice labels carry wrapped text blocks, line height, font size,
selection-indicator bounds, and card bounds. At canvas widths representative of
360 px and 390 px portrait viewports, primary labels project to at least 16 CSS
px and selectable cards project to at least 44 CSS px high. Long team names wrap
instead of shrinking below the readable target.

### Runtime

`imports/ui/predictions/kaplay/matchResultRuntime.ts` now consumes the projected
text blocks and selection-indicator geometry instead of recalculating label
sizes while drawing.

The runtime also exposes the last projected layout only when the existing
isolated `testControls` setting is enabled. The browser spec uses this to click
the actual drawn card centers and to record actual canvas CSS dimensions and
derived label/target sizes. Ordinary development does not expose a new public
debug API.

### Browser Spec

`tests/e2e/kaplay-prediction-preview.spec.ts` was updated so that, if the
browser runner executes:

- canvas clicks use the runtime's projected choice rectangles instead of stale
  hard-coded compact positions;
- recording waits for `MediaRecorder` to enter `recording`;
- recording captures a pre-selection interval, the selection through canvas
  input, and a post-shove settled state;
- stop/finalize waits for the completed blob before stopping tracks;
- 009C1 evidence writes to `test-results/ccpp009c1/` by default;
- 360 px and 390 px mobile screenshots and measurement JSON are collected;
- a natural-resolution mobile canvas crop is collected;
- Off-during-motion Standard preservation is a separate scenario;
- Continue-during-motion remains separate from full-playback recording.

## Preserved Behaviour

The correction preserves:

- automatic local-development access for the Match Result Kaplay screen;
- one runtime per owned initialization attempt;
- snapshot updates without runtime recreation;
- shared prediction answer ownership;
- answer-first selection semantics;
- both teams and Draw;
- selected answer separate from rejected cards;
- Change my selection restoring choices;
- valid Continue during motion;
- explicit Off and reduced-motion fallback;
- required-asset failure fallback;
- dirty-session preservation coverage in the existing browser spec.

No unrestricted client writes, broad publications, server prediction API
changes, authentication changes, or process-cleanup changes were made.

## Verification

Checks actually run after the final source edits:

- `npm run test:unit -- tests/unit/match-result-motion.test.ts tests/unit/prediction-presentation-host.test.ts`
  - passed: 2 files, 36 tests.
- `npm run typecheck`
  - passed.
- `npm run lint`
  - passed.
- `npm run lint:project`
  - passed.
- `git diff --check`
  - passed before final documentation and packaging edits.

Focused motion/layout coverage includes:

- samples immediately before, at, and after entry/contact and contact/push
  boundaries;
- desktop and compact continuity checks;
- nondecreasing Rooster and rejected-group horizontal movement through push
  start;
- stable hand/group contact relation;
- full transformed Rooster clearance;
- rejected-group clearance;
- pushRun frame coverage through exit;
- representative 60 fps, 30 fps, and larger-frame samples before expiry;
- compact 360/390-style readability targets;
- long-name wrapping;
- selected/rejected/indicator bounds separation;
- pointer hit testing against projected card centers.

The browser runner was attempted twice within the bounded budget:

- Planned batch:
  - command:
    `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=artifacts/ccpp009c1-browser-20260918 npm run test:e2e -- tests/e2e/kaplay-prediction-preview.spec.ts --workers=1 --retries=0`
  - exit code: 1;
  - duration: about 4.0 seconds;
  - `.last-run.json`: `failedTests: []`;
  - process snapshots show Playwright spawned Meteor and then closed while
    Meteor was still starting;
  - no browser screenshots, recordings, or per-test artifacts were produced.
- Correction batch:
  - command:
    `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=artifacts/ccpp009c1-browser-rerun-20260918 npm run test:e2e -- kaplay-prediction-preview.spec.ts --workers=1 --retries=0`
  - exit code: 1;
  - duration: about 3.0 seconds;
  - `.last-run.json`: `failedTests: []`;
  - process snapshots again show Playwright spawned Meteor and then closed while
    Meteor was still starting;
  - no browser screenshots, recordings, or per-test artifacts were produced.

No additional browser investigation or runner batch was started after the
bounded attempts.

## Historical 009C Media

The old integrated 009C WebMs remain historical failed evidence, not proof for
009C1:

- `test-results/ccpp009c/match-result-shove-normal-speed.webm`
  - `ffprobe` duration: `0.253016` seconds;
  - size: `11476` bytes.
- `test-results/ccpp009c/match-result-shove-slow-review.webm`
  - `ffprobe` duration: `0.216625` seconds;
  - size: `8389` bytes.

Those files were not relabelled as successful 009C1 playback evidence.

## Remaining Limitations

- No successful 009C1 browser run executed test cases.
- No actual 009C1 normal-speed or slowed recording exists.
- No actual 009C1 desktop/mobile/interruption screenshots exist.
- No actual 009C1 browser-measured mobile CSS dimensions exist.
- Integrated visual acceptance remains blocked until the isolated browser
  launcher produces executable test cases and media output.

## Package

Review archive:
`rugby-rooster-ccpp009c1-shove-exit-mobile-evidence-eomd-20260918.zip`.

The archive includes corrected source, relevant unchanged host/session context,
prepared unchanged Rooster assets, focused tests, updated docs, preserved
zero-test browser-launch evidence, and historical 009C failed media labelled by
path and audit context. It does not include credentials, `.env`, `node_modules`,
`.meteor/local`, generated builds/caches, raw private settings, or unrelated
archives.

Package verification completed:

- `zipinfo -t rugby-rooster-ccpp009c1-shove-exit-mobile-evidence-eomd-20260918.zip`
  - passed: 82 files, 11,740,376 bytes uncompressed.
- `unzip -t rugby-rooster-ccpp009c1-shove-exit-mobile-evidence-eomd-20260918.zip`
  - passed with no compressed-data errors.
- Historical media entries inside the ZIP were readable with `ffprobe`:
  - `test-results/ccpp009c/match-result-shove-normal-speed.webm`:
    `0.253016` seconds;
  - `test-results/ccpp009c/match-result-shove-slow-review.webm`:
    `0.216625` seconds.
- Repository originals were confirmed still present after packaging, including
  corrected motion source, the runtime atlas, source artwork, and historical
  009C WebM files.
