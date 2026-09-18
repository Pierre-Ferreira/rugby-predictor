# CCPP-009C Resume Checkpoint

## Status

Started CCPP-009C Visual Foundation & Rooster Shove.

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

## Supplied Asset Paths

Required input files named by the task:

- `cartoon_rooster_running_sprite_sheet.png`
- `rooster_animation_loops_reference_sheet.png`

Initial repository search did not find either PNG. The previous CCPP-009B4
review archive also did not contain either file.

Broader exact-name search under `/home/pierreferreira` returned no matches for
either required file. Exact-name search under `/tmp` did not find either file
before protected system temp directories returned permission-denied entries.

## Preparation Plan

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

## Completed Work

- Read required project instructions and core prediction/Kaplay/session/asset docs.
- Verified installed Kaplay version.
- Checked repository search results, broader exact-name local search, and
  previous 009B4 archive for the supplied art.
- Confirmed current Match Result preview/runtime still has no rooster sprite
  asset loading boundary.
- Created `docs/AUDIT_009C_Visual_Foundation_Rooster_Shove.md` to preserve the
  blocker record.
- Created this compaction-safe checkpoint before substantial changes.

## Tests And Evidence

No application, asset, motion, or browser tests run yet. Inspection and blocker
documentation only.

Lightweight documentation checks:

- `git diff --check` - passed.
- `meteor npm run lint:project` - passed; command emitted npm's existing
  `Unknown env config "nodedir"` warning before the project invariant check
  passed.

## Limitations And Next Action

Current blocker: required source art has not yet been found in the repository,
broader searched local workspace paths, `/tmp`, or the previous review archive.

Next action: place both original supplied PNGs in the repository or provide
their exact accessible local paths, then resume asset preparation from this
checkpoint. Do not invent asset paths or substitute artwork.
