# Rugby Rooster Asset Map

## Scope

This map classifies current Rugby Rooster mascot, animation, source, and icon
assets. It is an inventory and maintenance guide; it is not permission to load
large source sheets into player pages or to start new artwork/animation work.

CCPP-009C prepared the Match Result run/push animation asset set from supplied
source sheets. CCPP-010A reused those prepared transparent frame PNGs for the
React/CSS Match Result browser animation while retaining the historical Kaplay
atlas/runtime files.

CCPP-012B temporarily mapped static player personality moods to the available
run/push frames and app icon because no expression pack was present in the
repository at that time.

CCPP-012B1 supersedes that temporary mapping. The approved September 21 mascot
personality source sheets were found, copied unchanged into
`assets/source/rooster/personality/`, and prepared into clean runtime PNGs under
`public/assets/rooster/personality/`. Non-running moods now use those approved
expression assets. Match Result run/push frames remain animation-specific, with
`rooster-run-1.png` retained only as the explicit `running` action mood.

The exact CCPP-012B1 asset-map edit had not landed before the remote compaction
failure; the file still documented the older CCPP-012B temporary run/push-frame
mapping. This revision records the current implemented state.

## Active Static Personality UI

These are the runtime files used by
`imports/ui/components/player/RugbyRoosterPersonality.tsx`.

| Mood           | Runtime path                                                  | Type / Dimensions    | Pose       | Notes                                             |
| -------------- | ------------------------------------------------------------- | -------------------- | ---------- | ------------------------------------------------- |
| `confident`    | `public/assets/rooster/personality/rooster-confident.png`     | PNG, 593 x 640 sRGBA | Full body  | Approved canonical beer-bellied mascot pose.      |
| `thinking`     | `public/assets/rooster/personality/rooster-thinking.png`      | PNG, 412 x 420 sRGBA | Bust       | Approved expression-sheet crop.                   |
| `celebrating`  | `public/assets/rooster/personality/rooster-celebrating.png`   | PNG, 465 x 429 sRGBA | Bust       | Approved expression-sheet crop.                   |
| `nervous`      | `public/assets/rooster/personality/rooster-nervous.png`       | PNG, 427 x 438 sRGBA | Bust       | Approved expression-sheet crop.                   |
| `shocked`      | `public/assets/rooster/personality/rooster-shocked.png`       | PNG, 486 x 445 sRGBA | Bust       | Approved expression-sheet crop.                   |
| `disappointed` | `public/assets/rooster/personality/rooster-disappointed.png`  | PNG, 415 x 438 sRGBA | Bust       | Approved expression-sheet crop.                   |
| `tantrum`      | `public/assets/rooster/personality/rooster-tantrum.png`       | PNG, 481 x 573 sRGBA | Full body  | Approved expression-sheet crop.                   |
| `crying`       | `public/assets/rooster/personality/rooster-crying.png`        | PNG, 409 x 573 sRGBA | Full body  | Approved expression-sheet crop.                   |
| `cooked`       | `public/assets/rooster/personality/rooster-cooked.png`        | PNG, 391 x 578 sRGBA | Full body  | Approved expression-sheet crop.                   |
| `superCooked`  | `public/assets/rooster/personality/rooster-super-cooked.png`  | PNG, 640 x 460 sRGBA | Gag object | Corrected crop from supplied Super-Cooked source. |
| `running`      | `public/assets/rooster/match-result/frames/rooster-run-1.png` | PNG, 276 x 268 sRGBA | Action     | Explicit Running/action mood only.                |

Runtime usage notes:

- Non-running moods must not point back to Match Result run/push frames.
- Source-sheet labels, headings, underlines, and neighbouring poses are not
  page runtime assets.
- Source sheets stay preserved unchanged and are not loaded by ordinary
  player-facing routes.
- Runtime files are transparent/background-clean PNGs with reserved dimensions
  in the component.

## Animation-Specific

These files are retained for the accepted Match Result prediction animation and
historical Kaplay/runtime review paths. They are not substitutes for static
personality moods.

| Path                                                                                        | Type / Dimensions         | Current use                                                                                             |
| ------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `public/assets/rooster/match-result/frames/rooster-run-1.png` through `rooster-run-4.png`   | PNG, 276 x 268 sRGBA each | Match Result React/CSS run-frame sequence in `imports/ui/predictions/reactPredictionPresentation.tsx`.  |
| `public/assets/rooster/match-result/frames/rooster-push-1.png` through `rooster-push-4.png` | PNG, 276 x 268 sRGBA each | Match Result React/CSS push-frame sequence in `imports/ui/predictions/reactPredictionPresentation.tsx`. |
| `public/assets/rooster/match-result/rooster-shove-atlas.png`                                | PNG, 1136 x 552 sRGBA     | Historical KAPLAY atlas retained with superseded prediction runtime artifacts.                          |
| `public/assets/rooster/match-result/rooster-shove-manifest.json`                            | JSON                      | Public manifest with frame, animation, source hash, and anchor metadata.                                |
| `imports/ui/predictions/kaplay/roosterShoveManifest.generated.json`                         | JSON                      | Generated source-side manifest retained with historical Kaplay modules.                                 |

The only bridge from this group into `RugbyRoosterPersonality` is the explicit
`running` mood, which uses `rooster-run-1.png` for action/match-day contexts.

## Source / Reference

### Preserved Personality Source Sheets

The approved CCPP-012B1 source images are preserved unchanged here:

| Path                                                                       | Type / Dimensions     | Status / notes                                                                   |
| -------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------- |
| `assets/source/rooster/personality/rooster-canonical-confident-source.png` | PNG, 1300 x 1209 sRGB | Canonical confident full-body mascot source.                                     |
| `assets/source/rooster/personality/rooster-expression-sheet-1-source.png`  | PNG, 1536 x 1024 sRGB | Source for thinking, celebrating, nervous, shocked, and disappointed bust crops. |
| `assets/source/rooster/personality/rooster-expression-sheet-2-source.png`  | PNG, 1536 x 1024 sRGB | Source for tantrum, crying, and cooked full-body crops.                          |
| `assets/source/rooster/personality/rooster-super-cooked-source.png`        | PNG, 1536 x 1024 sRGB | Source for the Super-Cooked gag-object crop.                                     |

These are source/reference files only. Player pages must load prepared runtime
PNGs from `public/assets/rooster/personality/` instead.

### Historical And App-Icon Reference

| Path                                                                | Type / Dimensions     | Status / notes                                            |
| ------------------------------------------------------------------- | --------------------- | --------------------------------------------------------- |
| `assets/source/rooster/cartoon_rooster_running_sprite_sheet.png`    | PNG, 1672 x 941 sRGBA | Preserved CCPP-009C source sheet for run/push extraction. |
| `assets/source/rooster/rooster_animation_loops_reference_sheet.png` | PNG, 1672 x 941 sRGB  | Preserved CCPP-009C labelled reference sheet.             |
| `public/favicon.svg`                                                | SVG                   | Favicon source/reference only.                            |
| `public/icons/apple-touch-icon.png`                                 | PNG, 180 x 180 RGBA   | PWA/touch icon.                                           |
| `public/icons/rr-icon-192.png`                                      | PNG, 192 x 192 RGBA   | PWA icon only; no longer a personality mood fallback.     |
| `public/icons/rr-icon-512.png`                                      | PNG, 512 x 512 RGBA   | PWA icon.                                                 |
| `public/icons/rr-icon-source.svg`                                   | SVG                   | Monogram app-icon source.                                 |
| `public/icons/rr-maskable-512.png`                                  | PNG, 512 x 512 RGBA   | Maskable PWA icon.                                        |
| `public/icons/rr-maskable-source.svg`                               | SVG                   | Maskable icon source.                                     |

## Generated Manifest / Prep Script

Preparation script:

- `scripts/prepare-rooster-personality-assets.mjs`

Generated runtime output:

- `public/assets/rooster/personality/`
- `public/assets/rooster/personality/personality-manifest.json`

The script:

- reads only the preserved source images under
  `assets/source/rooster/personality/`;
- crops the approved source regions recorded in the script;
- removes clean corner-connected backgrounds while preserving alpha;
- trims and caps runtime output at 640px where needed;
- writes runtime PNGs and a JSON manifest;
- records source file, crop rectangle, output file, dimensions, pose
  classification, and source SHA-256.

The manifest is generated data, but it is checked into the repository so the
runtime asset set is auditable and reproducible. Regenerate it only when the
approved source files or crop rectangles intentionally change.

Super-Cooked handling:

- Source: `assets/source/rooster/personality/rooster-super-cooked-source.png`
- Runtime: `public/assets/rooster/personality/rooster-super-cooked.png`
- Recorded crop: `1000x710+45+265`
- Output: `640 x 460 sRGBA`
- The crop was tightened during the CCPP-012B1 visual inspection to remove the
  source-sheet headline/underline area before this map was completed.

## Maintenance Rules

- Preserve the canonical beer-bellied mascot direction: green rugby jersey,
  tan/golden feathers, red comb, and cobalt/deep-blue tail.
- Keep non-running page moods on approved personality PNGs.
- Keep `running` restricted to action/match-day contexts.
- Do not load source sheets directly in player routes.
- Do not use old run/push frames as generic substitutes for personality moods.
- Do not regenerate or replace approved artwork without a new explicit asset
  task and updated documentation.
