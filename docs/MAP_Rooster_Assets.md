# Rugby Rooster Asset Map

## Scope

CCPP-009A inspected repository asset locations for existing Rooster artwork
that could inform later Kaplay stages. This is an inventory only. No images were
generated, downloaded, cropped, converted, or assembled into sprite atlases.

CCPP-009C began with a required supplied-art check for the approved first-pass
rooster shove prototype. The required source images were not present in the
repository, searched local workspace paths, `/tmp`, or the previous CCPP-009B4
review archive, so no runtime sprite preparation was started.

Inspected locations:

- `public/`
- `imports/`
- `client/`

## Available Assets

| Path                                  | Type / Dimensions   | Status                    | Notes                                                        |
| ------------------------------------- | ------------------- | ------------------------- | ------------------------------------------------------------ |
| `public/favicon.svg`                  | SVG                 | Reference/app icon        | Favicon source only; not runtime-ready mascot animation art. |
| `public/icons/apple-touch-icon.png`   | PNG, 180 x 180 RGBA | App icon                  | Touch icon only.                                             |
| `public/icons/rr-icon-192.png`        | PNG, 192 x 192 RGBA | App icon                  | PWA icon only.                                               |
| `public/icons/rr-icon-512.png`        | PNG, 512 x 512 RGBA | App icon                  | PWA icon only.                                               |
| `public/icons/rr-icon-source.svg`     | SVG                 | Reference/app icon source | Source for monogram-style app icon.                          |
| `public/icons/rr-maskable-512.png`    | PNG, 512 x 512 RGBA | App icon                  | Maskable PWA icon only.                                      |
| `public/icons/rr-maskable-source.svg` | SVG                 | Reference/app icon source | Source for maskable icon.                                    |

## Not Found

No repository files were found for:

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

Missing runtime artwork did not block CCPP-009A. CCPP-009C is blocked until the
approved source-art PNGs are available locally. Once present, the implementation
must preserve originals unchanged and generate reproducible prepared frames,
atlas/metadata, contact sheets, transparency checks, and motion-review evidence
before integrating the Match Result shove.
