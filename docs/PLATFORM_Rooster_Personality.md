# Rugby Rooster Personality Platform

## Purpose

CCPP-012B introduces a lightweight static Rooster personality layer for
player-facing pages. The Rooster is a character accent, not business logic and
not a new animation system.

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

Pages choose moods deterministically from their existing state.

## Mood Catalog

Only assets actually present in the repository are mapped.

| Mood           | Asset                                                    | Role              |
| -------------- | -------------------------------------------------------- | ----------------- |
| `confident`    | `/assets/rooster/match-result/frames/rooster-run-1.png`  | Active static UI  |
| `thinking`     | `/assets/rooster/match-result/frames/rooster-run-2.png`  | Active static UI  |
| `nervous`      | `/assets/rooster/match-result/frames/rooster-run-3.png`  | Active static UI  |
| `waiting`      | `/assets/rooster/match-result/frames/rooster-run-4.png`  | Active static UI  |
| `shocked`      | `/assets/rooster/match-result/frames/rooster-push-1.png` | Active static UI  |
| `disappointed` | `/assets/rooster/match-result/frames/rooster-push-2.png` | Active static UI  |
| `celebrating`  | `/assets/rooster/match-result/frames/rooster-push-4.png` | Active static UI  |
| `neutral`      | `/icons/rr-icon-192.png`                                 | App icon fallback |

There are no standalone shocked, cooked, crying, tantrum, or other expression
PNGs in the repository. Those moods are not invented. The current catalog uses
prepared Match Result run/push frames as still images.

## Page Mapping

Current deterministic mappings:

- Home: `confident`, "Pick boldly. Crow later."
- Games: `confident` or `waiting` near the page heading.
- Game Detail: `thinking`, "Big game. Bigger call."
- Prediction shell: fixture header uses `confident`/`waiting`; Intro uses
  `confident`.
- Leaderboard status: `waiting` for awaiting, `nervous` for provisional,
  `celebrating` for final, `disappointed` for cancelled/error-like context.
- My Score summary: `waiting` before results, `celebrating` for strong scores,
  `disappointed` for heavy deductions, `shocked` for no prediction, `neutral`
  for cancelled.
- Account: `neutral`.
- Error states: `shocked` plus clear recoverable messaging.

## Copy Rules

Copy is short, stable, and human-written. It does not come from AI.

Examples now used:

- "Pick boldly. Crow later."
- "Match day radar on."
- "Big game. Bigger call."
- "Now we wait."
- "Final whistle."
- "You knew your rugby."
- "That one hurt."
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

The component reserves image dimensions and uses `loading="lazy"` by default.
Above-the-fold Home can opt into eager loading.

Current still PNGs are 276 x 268 and roughly 160-192 KB each. The 1.4 MB atlas
and source sheets are not loaded for personality placements.

Future prepared UI derivatives may be added if smaller static assets become
necessary, but CCPP-012B does not add a new image pipeline.

## Failure Behaviour

If the image fails to load, the component hides the failed image and keeps the
message visible. Page controls and route content remain usable.

Focused unit coverage exists in `tests/unit/player-visual.test.ts`.
