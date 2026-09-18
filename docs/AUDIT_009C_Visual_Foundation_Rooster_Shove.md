# CCPP-009C Visual Foundation & Rooster Shove Audit

## Status

Blocked before implementation.

CCPP-009C requires two supplied source images before the sprite preparation,
motion inspection, Match Result shove integration, browser evidence, and review
package can be completed:

- `cartoon_rooster_running_sprite_sheet.png`
- `rooster_animation_loops_reference_sheet.png`

Neither file is currently available in this repository or in the searched local
workspace paths.

## Inspection Completed

- Read `AGENTS.md`.
- Read the current prediction, Kaplay preview, prediction-session, asset-map,
  testing, and system-map docs.
- Verified installed Kaplay version from `node_modules/kaplay/package.json`:
  `3001.0.19`.
- Inspected the previous CCPP-009B4 review archive:
  `rugby-rooster-ccpp009b4-development-kaplay-defaults-eomd-20260918.zip`.
- Inspected the current Match Result preview/runtime boundary:
  - `imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx`
  - `imports/ui/predictions/kaplay/matchResultRuntime.ts`
  - `tests/unit/prediction-presentation-host.test.ts`

The current preview remains the accepted 009B4 one-screen Match Result runtime:
it draws a simple canvas scene, keeps a visible DOM choice bridge, and has no
rooster sprite asset loading yet.

## Asset Search Evidence

The required files were not found by:

- repository file search for rooster/sprite/asset paths;
- exact-name search under `/home/pierreferreira`;
- exact-name search under `/tmp` before protected system temp directories
  returned permission-denied entries;
- listing the previous CCPP-009B4 review archive contents.

No substitute mascot artwork was downloaded, generated, copied from another
product, or invented.

## Work Not Started

Because the supplied source art is absent, the following 009C deliverables were
not started:

- source-art copy and preservation;
- transparent frame extraction;
- runtime atlas and animation metadata;
- run/pushRun motion-review harness;
- Match Result visual rewrite;
- continuous rooster shove integration;
- focused unit/browser animation tests;
- screenshots, recordings, or review archive.

This follows the task instruction to identify missing required inputs and avoid
inventing asset paths or replacement artwork.

## Next Action

Place both original supplied PNGs in the repository or provide their exact
accessible local paths, then resume from `docs/TEMP_009C_Resume.md`.

The next pass should preserve the originals unchanged, produce a reproducible
small asset pack, checkpoint motion evidence before integration, and continue
with the four requested checkpoints A through D.

## Verification

No application, asset, motion, or browser tests were run because implementation
did not begin.

Lightweight documentation checks run:

- `git diff --check` - passed.
- `meteor npm run lint:project` - passed; command emitted npm's existing
  `Unknown env config "nodedir"` warning before the project invariant check
  passed.
