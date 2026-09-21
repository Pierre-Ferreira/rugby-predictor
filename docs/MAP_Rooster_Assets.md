# Rugby Rooster Asset Map

## Scope

CCPP-009A inspected repository asset locations for existing Rooster artwork
that could inform later Kaplay stages. This is an inventory only. No images were
generated, downloaded, cropped, converted, or assembled into sprite atlases.

CCPP-009C began with a required supplied-art check for the approved first-pass
rooster shove prototype. The required source images were not present in the
repository, searched local workspace paths, `/tmp`, or the previous CCPP-009B4
review archive, so no runtime sprite preparation was started.

Continuation update, 2026-09-18: the CCPP-009C missing-artwork statement is now
historical. The supplied source PNGs are present under `assets/source/rooster/`
and have been prepared into the current first-pass Match Result shove runtime
asset set. The preparation preserves the source images, generates fixed-size
transparent frames, a KAPLAY sprite atlas, a public manifest, a source-side
generated manifest, and review evidence. Current quality notes and verification
limitations belong in `docs/AUDIT_009C_Visual_Foundation_Rooster_Shove.md`.

CCPP-009C1 reused this asset set unchanged while correcting motion/layout
projection. No source images, prepared frames, atlas pixels, manifest anchors,
source hashes, or preparation outputs changed.

CCPP-010A reuses the prepared transparent frame PNGs directly from React/CSS
Match Result browser animation. The active prediction route no longer consumes
the Kaplay atlas/runtime, but the atlas and generated manifests remain as
historical 009 assets and deferred-cleanup material.

CCPP-012B reuses a small subset of the prepared frame PNGs as static
player-facing personality images through `RugbyRoosterPersonality`. No new
artwork was generated. The repository currently has a small static mood catalog
derived from actually available prepared assets/icons rather than the full
historical expression set discussed conceptually.

Inspected locations:

- `public/`
- `imports/`
- `client/`

## Active Static UI

These files are loaded by current player-facing static placements, including
`RugbyRoosterPersonality` and the public layout app-icon mark.

| Path                                                           | Type / Dimensions    | Current use                                               |
| -------------------------------------------------------------- | -------------------- | --------------------------------------------------------- |
| `public/assets/rooster/match-result/frames/rooster-run-1.png`  | PNG, 276 x 268 sRGBA | `confident` mood in `RugbyRoosterPersonality`.            |
| `public/assets/rooster/match-result/frames/rooster-run-2.png`  | PNG, 276 x 268 sRGBA | `thinking` mood in `RugbyRoosterPersonality`.             |
| `public/assets/rooster/match-result/frames/rooster-run-3.png`  | PNG, 276 x 268 sRGBA | `nervous` mood in `RugbyRoosterPersonality`.              |
| `public/assets/rooster/match-result/frames/rooster-run-4.png`  | PNG, 276 x 268 sRGBA | `waiting` mood in `RugbyRoosterPersonality`.              |
| `public/assets/rooster/match-result/frames/rooster-push-1.png` | PNG, 276 x 268 sRGBA | `shocked` mood in `RugbyRoosterPersonality`.              |
| `public/assets/rooster/match-result/frames/rooster-push-2.png` | PNG, 276 x 268 sRGBA | `disappointed` mood in `RugbyRoosterPersonality`.         |
| `public/assets/rooster/match-result/frames/rooster-push-4.png` | PNG, 276 x 268 sRGBA | `celebrating` mood in `RugbyRoosterPersonality`.          |
| `public/icons/rr-icon-192.png`                                 | PNG, 192 x 192 RGBA  | `neutral` mood fallback and public-layout icon placement. |

## Animation-Specific

These files are retained for the accepted Match Result prediction animation
and historical Kaplay/runtime review paths. Some prepared frames are also used
as static personality stills above; `rooster-push-3.png` is animation-only in
the current source.

| Path                                                                                        | Type / Dimensions         | Current use                                                                                             |
| ------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `public/assets/rooster/match-result/frames/rooster-run-1.png` through `rooster-run-4.png`   | PNG, 276 x 268 sRGBA each | Match Result React/CSS run-frame sequence in `imports/ui/predictions/reactPredictionPresentation.tsx`.  |
| `public/assets/rooster/match-result/frames/rooster-push-1.png` through `rooster-push-4.png` | PNG, 276 x 268 sRGBA each | Match Result React/CSS push-frame sequence in `imports/ui/predictions/reactPredictionPresentation.tsx`. |
| `public/assets/rooster/match-result/rooster-shove-atlas.png`                                | PNG, 1136 x 552 sRGBA     | Historical KAPLAY atlas retained with superseded prediction runtime artifacts.                          |
| `public/assets/rooster/match-result/rooster-shove-manifest.json`                            | JSON                      | Public manifest with frame, animation, source hash, and anchor metadata.                                |
| `imports/ui/predictions/kaplay/roosterShoveManifest.generated.json`                         | JSON                      | Generated source-side manifest retained with historical Kaplay modules.                                 |

## Reference / Historical

These files are source, icon-source, or app-icon assets. They are not intended
for direct page personality loading.

| Path                                                                | Type / Dimensions     | Status / notes                                            |
| ------------------------------------------------------------------- | --------------------- | --------------------------------------------------------- |
| `assets/source/rooster/cartoon_rooster_running_sprite_sheet.png`    | PNG, 1672 x 941 sRGBA | Preserved CCPP-009C source sheet for run/push extraction. |
| `assets/source/rooster/rooster_animation_loops_reference_sheet.png` | PNG, 1672 x 941 sRGB  | Preserved CCPP-009C labelled reference sheet.             |
| `public/favicon.svg`                                                | SVG                   | Favicon source/reference only.                            |
| `public/icons/apple-touch-icon.png`                                 | PNG, 180 x 180 RGBA   | PWA/touch icon.                                           |
| `public/icons/rr-icon-512.png`                                      | PNG, 512 x 512 RGBA   | PWA icon.                                                 |
| `public/icons/rr-icon-source.svg`                                   | SVG                   | Monogram app-icon source.                                 |
| `public/icons/rr-maskable-512.png`                                  | PNG, 512 x 512 RGBA   | Maskable PWA icon.                                        |
| `public/icons/rr-maskable-source.svg`                               | SVG                   | Maskable icon source.                                     |

## Available Assets Before CCPP-012B Reclassification

| Path                                                                                        | Type / Dimensions         | Status                        | Notes                                                                           |
| ------------------------------------------------------------------------------------------- | ------------------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| `assets/source/rooster/cartoon_rooster_running_sprite_sheet.png`                            | PNG, 1672 x 941 sRGBA     | CCPP-009C source art          | Preserved original runtime sheet for run/push extraction.                       |
| `assets/source/rooster/rooster_animation_loops_reference_sheet.png`                         | PNG, 1672 x 941 sRGB      | CCPP-009C source art          | Preserved reference-only labelled sheet.                                        |
| `public/assets/rooster/match-result/frames/rooster-run-1.png` through `rooster-run-4.png`   | PNG, 276 x 268 sRGBA each | Active React animation frames | First-pass running frames used by the CCPP-010A Match Result shove decoration.  |
| `public/assets/rooster/match-result/frames/rooster-push-1.png` through `rooster-push-4.png` | PNG, 276 x 268 sRGBA each | Active React animation frames | First-pass push-run frames used by the CCPP-010A Match Result shove decoration. |
| `public/assets/rooster/match-result/rooster-shove-atlas.png`                                | PNG, 1136 x 552 sRGBA     | Historical KAPLAY atlas       | Atlas retained for superseded CCPP-009 Match Result runtime cleanup/review.     |
| `public/assets/rooster/match-result/rooster-shove-manifest.json`                            | JSON                      | Historical asset manifest     | Public manifest with frame, animation, source hash, and anchor metadata.        |
| `imports/ui/predictions/kaplay/roosterShoveManifest.generated.json`                         | JSON                      | Historical source manifest    | Generated manifest imported by superseded motion/runtime code.                  |
| `public/favicon.svg`                                                                        | SVG                       | Reference/app icon            | Favicon source only; not runtime-ready mascot animation art.                    |
| `public/icons/apple-touch-icon.png`                                                         | PNG, 180 x 180 RGBA       | App icon                      | Touch icon only.                                                                |
| `public/icons/rr-icon-192.png`                                                              | PNG, 192 x 192 RGBA       | App icon                      | PWA icon only.                                                                  |
| `public/icons/rr-icon-512.png`                                                              | PNG, 512 x 512 RGBA       | App icon                      | PWA icon only.                                                                  |
| `public/icons/rr-icon-source.svg`                                                           | SVG                       | Reference/app icon source     | Source for monogram-style app icon.                                             |
| `public/icons/rr-maskable-512.png`                                                          | PNG, 512 x 512 RGBA       | App icon                      | Maskable PWA icon only.                                                         |
| `public/icons/rr-maskable-source.svg`                                                       | SVG                       | Reference/app icon source     | Source for maskable icon.                                                       |

## CCPP-012B Mood Catalog Limitation

There are no standalone expression PNGs for cooked, crying, tantrum, shocked,
or similar historical concept moods. Current static personality moods are
semantic labels applied to prepared run/push still frames and the 192px app-icon
fallback. Future expression artwork should be added only through an explicit
asset task with real repository files and updated documentation.

## Historical Not Found

Before the continuation supplied-art recovery, no repository files were found
for:

- Rooster expression sheets;
- shove storyboards;
- transparent mascot poses;
- run or push animation frames;
- sprite sheets;
- texture atlases;
- Kaplay-ready runtime artwork;
- required CCPP-009C supplied inputs
  `cartoon_rooster_running_sprite_sheet.png` and
  `rooster_animation_loops_reference_sheet.png`.

## Future Asset Requirements

Missing runtime artwork did not block CCPP-009A. CCPP-009C now has first-pass
runtime artwork for the Match Result shove. Future asset work should preserve
the originals unchanged, regenerate through
`scripts/prepare-rooster-shove-assets.mjs` only when a concrete source or
quality change requires it, and keep new evidence outside watched application
source directories.
