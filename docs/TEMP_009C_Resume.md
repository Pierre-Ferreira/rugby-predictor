# CCPP-009C Resume Checkpoint

## Status

CCPP-009C Visual Foundation & Rooster Shove is packaged for review.

Continuation update, 2026-09-18: the original missing-artwork blocker below is
historical. The supplied source PNGs are now present under
`assets/source/rooster/`, and the current worktree contains the prepared runtime
frames, atlas, generated manifest, motion helpers, runtime integration, browser
spec updates, and preserved review evidence. The final runtime-lifetime
correction and input-helper changes were unit/static verified in this
continuation, but the single continuation browser batch exited before executing
test cases. The EOMD review package is
`rugby-rooster-ccpp009c-visual-foundation-rooster-shove-eomd-20260918.zip`.

## Inspected Files

- `AGENTS.md`
- `docs/CORE_Predictions.md`
- `docs/PLATFORM_Kaplay_Predictions.md`
- `docs/PLATFORM_Prediction_Session.md`
- `docs/MAP_Rooster_Assets.md`
- `docs/PLATFORM_Testing.md`
- `docs/MAP_System.md`
- `rugby-rooster-ccpp009b4-development-kaplay-defaults-eomd-20260918.zip`
- `imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx`
- `imports/ui/predictions/kaplay/matchResultRuntime.ts`
- `tests/unit/prediction-presentation-host.test.ts`

## Environment

- Installed Kaplay version verified from `node_modules/kaplay/package.json`: `3001.0.19`.
- Initial `git status --short` produced no changed files before this checkpoint was created.

## Current Supplied Asset Paths

The supplied assets are now present and preserved unchanged at:

- `assets/source/rooster/cartoon_rooster_running_sprite_sheet.png`
- `assets/source/rooster/rooster_animation_loops_reference_sheet.png`

The prepared runtime outputs are at:

- `public/assets/rooster/match-result/frames/`
- `public/assets/rooster/match-result/rooster-shove-atlas.png`
- `public/assets/rooster/match-result/rooster-shove-manifest.json`
- `imports/ui/predictions/kaplay/roosterShoveManifest.generated.json`

Existing motion-review evidence has been preserved under
`artifacts/ccpp009c-review/`, and a pre-continuation evidence copy is under
`artifacts/ccpp009c-continuation-preserved-20260918/`.

Continuation browser-launch evidence is under
`artifacts/ccpp009c-continuation-browser-20260918/`. Visual-inspection contact
sheets generated from existing evidence are under
`artifacts/ccpp009c-continuation-visual-inspection-20260918/`.

## Historical Supplied Asset Blocker

Required input files named by the task:

- `cartoon_rooster_running_sprite_sheet.png`
- `rooster_animation_loops_reference_sheet.png`

Initial repository search in the first 009C pass did not find either PNG. The
previous CCPP-009B4 review archive also did not contain either file.

Broader exact-name search under `/home/pierreferreira` returned no matches for
either required file. Exact-name search under `/tmp` did not find either file
before protected system temp directories returned permission-denied entries.

## Historical Preparation Plan

Blocked until both supplied source images are available in the local workspace
or confirmed in an accessible attachment path.

When available:

1. Preserve originals unchanged.
2. Copy originals into a source-art location.
3. Inspect pixels, alpha, bounds, halos, holes, clipping and frame contamination.
4. Produce complete-character transparent frames, a runtime atlas, metadata with run/pushRun frame order, anchors, contact point and timing.
5. Generate contact sheet, transparency checks, and motion-review playback before integrating into the Match Result scene.

## Layout And Choreography Decisions

Pending asset inspection.

Target choreography remains one continuous left-to-right action:

`OFFSCREEN -> SPRINT -> CONTACT -> PUSH-RUN -> OFFSCREEN`

The selected answer must move to a separate selected state and remain untouched; the two rejected choices form one presentation-only shove group.

## Historical Completed Work Before Artwork Was Found

- Read required project instructions and core prediction/Kaplay/session/asset docs.
- Verified installed Kaplay version.
- Checked repository search results, broader exact-name local search, and
  previous 009B4 archive for the supplied art.
- Confirmed current Match Result preview/runtime still has no rooster sprite
  asset loading boundary.
- Created `docs/AUDIT_009C_Visual_Foundation_Rooster_Shove.md` to preserve the
  blocker record.
- Created this compaction-safe checkpoint before substantial changes.

## Historical Tests And Evidence Before Artwork Was Found

No application, asset, motion, or browser tests run yet. Inspection and blocker
documentation only.

Lightweight documentation checks:

- `git diff --check` - passed.
- `meteor npm run lint:project` - passed; command emitted npm's existing
  `Unknown env config "nodedir"` warning before the project invariant check
  passed.

## Continuation Results

- Source artwork blocker resolved; source PNGs are present and preserved.
- No pixel regeneration was performed during this continuation.
- Final runtime lifetime correction verified with
  `tests/unit/prediction-presentation-host.test.ts` using the real preview
  adapter and controlled runtime factory.
- Browser helper path corrected so canvas, keyboard, and visible Standard radio
  input paths stay distinct.
- Focused unit run passed: 2 files, 27 tests.
- `npm run typecheck`, `npm run lint`, and `npm run lint:project` passed after
  the source cleanup.
- One browser batch was attempted and preserved, but exited before Playwright
  executed tests; no rerun was attempted.
- Existing WebM recordings are present but too short to prove full integrated
  shove playback.

## Current Next Action

No further 009C implementation or browser rerun remains in this bounded
continuation. Future work should start from the packaged review candidate and
the browser-evidence limitations recorded in
`docs/AUDIT_009C_Visual_Foundation_Rooster_Shove.md`.

## Historical Limitations And Next Action

Historical blocker: required source art had not yet been found in the
repository, broader searched local workspace paths, `/tmp`, or the previous
review archive.

Next action: place both original supplied PNGs in the repository or provide
their exact accessible local paths, then resume asset preparation from this
checkpoint. Do not invent asset paths or substitute artwork.
