# Rugby Rooster Personality Platform

## Purpose

CCPP-012B introduced a lightweight static Rooster personality layer for
player-facing pages. CCPP-012B1 replaces the temporary run/push-frame mood
mapping with the approved mascot expression pack. The Rooster remains a
character accent, not business logic and not a new animation system.

Source:

- `imports/ui/components/player/RugbyRoosterPersonality.tsx`

## Component Contract

`RugbyRoosterPersonality` accepts:

- `mood`
- optional short `message`
- `size`
- optional image alt override
- optional lazy/eager loading choice

Responsibilities:

- Choose an asset from the central mood map.
- Render the image and optional copy responsively.
- Fail softly if the image cannot load.

It does not:

- fetch data;
- calculate business state;
- mutate predictions, scoring, identity, or leaderboard data;
- animate;
- own page logic.

Pages choose moods deterministically from their existing state. Supported sizes
are `compact`, `standard`, and `hero`.

The CCPP-012B `sm`/`md`/`lg` size names are superseded. New page code should use
the named semantic sizes above.

## Mood Catalog

Only approved supplied assets actually present in the repository are mapped.

Canonical mascot characteristics:

- beer-bellied build with modest chest emphasis;
- cheeky and expressive rugby-fan personality;
- green rugby jersey;
- tan/golden feathers;
- strong red comb;
- deep/cobalt blue tail.

| Mood           | Asset                                                   | Pose       |
| -------------- | ------------------------------------------------------- | ---------- |
| `confident`    | `/assets/rooster/personality/rooster-confident.png`     | Full body  |
| `thinking`     | `/assets/rooster/personality/rooster-thinking.png`      | Bust       |
| `celebrating`  | `/assets/rooster/personality/rooster-celebrating.png`   | Bust       |
| `nervous`      | `/assets/rooster/personality/rooster-nervous.png`       | Bust       |
| `shocked`      | `/assets/rooster/personality/rooster-shocked.png`       | Bust       |
| `disappointed` | `/assets/rooster/personality/rooster-disappointed.png`  | Bust       |
| `tantrum`      | `/assets/rooster/personality/rooster-tantrum.png`       | Full body  |
| `crying`       | `/assets/rooster/personality/rooster-crying.png`        | Full body  |
| `cooked`       | `/assets/rooster/personality/rooster-cooked.png`        | Full body  |
| `superCooked`  | `/assets/rooster/personality/rooster-super-cooked.png`  | Gag object |
| `running`      | `/assets/rooster/match-result/frames/rooster-run-1.png` | Action     |

The non-running moods no longer map to generic Match Result run/push frames.
`running` remains available only for action or match-day energy contexts.

Approved source sheets are preserved unchanged under
`assets/source/rooster/personality/`. Runtime derivatives and their generated
manifest live under `public/assets/rooster/personality/`.

`scripts/prepare-rooster-personality-assets.mjs` records source file, crop
bounds, output file, output dimensions, pose classification, and source
SHA-256. It uses ImageMagick only at preparation time and adds no runtime image
processing dependency.

Preserved source inventory:

| Source file                              | Runtime moods                                                   |
| ---------------------------------------- | --------------------------------------------------------------- |
| `rooster-canonical-confident-source.png` | `confident`                                                     |
| `rooster-expression-sheet-1-source.png`  | `thinking`, `celebrating`, `nervous`, `shocked`, `disappointed` |
| `rooster-expression-sheet-2-source.png`  | `tantrum`, `crying`, `cooked`                                   |
| `rooster-super-cooked-source.png`        | `superCooked`                                                   |

The source sheets remain unchanged and are not loaded by ordinary player
routes. Super-Cooked uses the preserved standalone source with the corrected
runtime crop recorded in the script and manifest, so the page asset excludes
the source-sheet headline/underline area.

## Page Mapping

Current deterministic mappings:

- Home: `confident`, "Pick boldly. Crow later."
- Games: `running` for upcoming fixtures, `thinking` for past fixtures.
- Game Detail: `thinking`, "Big game. Bigger call."
- Prediction shell: fixture header uses `confident` or `thinking`; Intro uses
  `thinking`.
- Leaderboard status: `thinking` for awaiting, `nervous` for provisional,
  `celebrating` for a current-user final win, `disappointed`/`superCooked` for
  rough personal final outcomes, `confident` for general final, and
  `disappointed` for cancelled.
- My Score summary: `thinking` before results, `confident` for clean
  provisional scores, `nervous` while pending predictions can move,
  `celebrating` for strong final scores, `disappointed`/`cooked` for rough
  scores, `superCooked` only for zero, and `shocked` for no prediction.
- Account: `confident`.
- Error states: `tantrum` plus clear recoverable messaging.

This is intentionally a simple page-state mapping, not a psychology/rules
engine. Unit tests cover the complete mood catalog and ensure non-running moods
stay on the approved personality asset path.

## Copy Rules

Copy is short, stable, and human-written. It does not come from AI.

Examples now used:

- "Pick boldly. Crow later."
- "Match day radar on."
- "Big game. Bigger call."
- "Hmm..."
- "This could move."
- "Final whistle."
- "You knew your rugby."
- "That one hurt."
- "Cooked."
- "We don't talk about this one."
- "You sat this one out."

Tone should stay cheeky without humiliation. Losing should feel playful, not
mean.

## Usage Limits

Use one strong personality placement per page/state in normal player flows.
Avoid placing the Rooster inside every card, row, button, or score detail.

If a page already has a state-specific Rooster summary, avoid another large
header mascot. Leaderboard and My Score use state-specific placements rather
than duplicated header placements.

## Performance

The component reserves image dimensions/aspect ratio and uses `loading="lazy"`
by default. Above-the-fold Home opts into eager loading.

The source sheets are not loaded by pages. Prepared runtime PNGs are sized for
UI placement, with rendered sizes controlled by `compact`, `standard`, and
`hero`.

## Failure Behaviour

If the image fails to load, the component hides the failed image and keeps the
message visible. Page controls and route content remain usable.

Focused unit coverage exists in `tests/unit/player-visual.test.ts`.
