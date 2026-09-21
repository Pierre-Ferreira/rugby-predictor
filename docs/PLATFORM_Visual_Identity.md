# Rugby Rooster Visual Identity Platform

## Scope

CCPP-012B established the first coherent player-facing Rugby Rooster visual
foundation. CCPP-012B1 aligns that foundation to the approved mascot and colour
style board. CCPP-012B2 extends the approved Home green hero treatment across
the main player-facing page headers and adds green/gold alternating fixture
leaderboard rows. It is presentation work over the existing routes and
behaviours; it does not change routing, auth, predictions, scoring,
leaderboard ranking, identity privacy, fixture lifecycle, or admin workflows.

Detailed Admin visual redesign remains deferred. Admin may inherit base tokens
and typography only.

## Tokens

Global semantic tokens live in `client/main.css`:

- `--rr-field-green`, `--rr-gold`, `--rr-rooster-red`,
  `--rr-cobalt-blue`, `--rr-cream`, `--rr-tan-feather`, and
  `--rr-charcoal` record the approved colour family.
- `--rr-bg` and `--rr-bg-strong` for the warm page background.
- `--rr-surface` and `--rr-surface-raised` for player-facing panels.
- `--rr-border` for restrained dividers and outlines.
- `--rr-text` and `--rr-text-muted` for readable hierarchy.
- `--rr-brand` and `--rr-brand-strong` for primary rugby-green actions.
- `--rr-accent` for warm gold emphasis.
- `--rr-danger`, `--rr-warning`, `--rr-success`, and `--rr-info` for status.

Approved palette values:

| Token       | RGB           | Role                                      |
| ----------- | ------------- | ----------------------------------------- |
| Field Green | `0 109 67`    | Dominant brand anchor and primary action. |
| Gold        | `242 190 70`  | Achievement, winner, and CTA accent.      |
| Rooster Red | `202 46 38`   | Mascot, `vs`, attention, and danger.      |
| Cobalt Blue | `0 87 184`    | Selective links and information accents.  |
| Cream       | `255 248 230` | Primary readable page base.               |
| Tan Feather | `214 169 93`  | Warm neutral, borders, and dividers.      |
| Charcoal    | `24 31 38`    | Main text and dark-surface colour.        |

The existing `--color-rooster-*` tokens remain for older prediction-specific
styles and are aligned to the same approved family. Tailwind exposes both the
older `rooster.*` colours and semantic `rr.*` colours in
`tailwind.config.cjs`, including named aliases for `fieldGreen`, `gold`,
`roosterRed`, `cobaltBlue`, `cream`, `tanFeather`, and `charcoal`.

Approved usage direction:

- Field Green is the primary brand anchor for selected navigation, primary
  buttons, strong page accents, and the shared player page-header surface.
- Gold is the main highlight for primary actions on green headers,
  achievement/winner accents, progress emphasis, leaderboard alternation, and
  compact details.
- Rooster Red is used for personality emphasis, green-header accent stripes,
  light `vs`/attention moments, error/destructive states, and current-player
  emphasis.
- Cobalt Blue is selective, mostly links/information and small secondary
  competitive accents.
- Cream and warm surface tones keep player pages readable.
- Tan Feather is used as a restrained warm neutral for borders, dividers, and
  muted surfaces.
- Charcoal remains the main text/dark-surface colour.

Yellow and Red Card prediction controls still use distinct yellow/red card
styling. Brand gold/red are used selectively so card semantics remain
recognizable.

## Typography

Player-facing pages use the existing system sans stack. No new font files or
web-font dependency were introduced.

Hierarchy:

- Page title: large, compact, heavy, and allowed to wrap.
- Fixture/team title: prominent and compact, with restrained `vs` emphasis.
- Step and section titles: strong but smaller than page titles.
- Section eyebrow: small uppercase label style for route/status context.
- Body: medium-weight readable copy.
- Meta: compact uppercase labels for competition, kickoff, status, and summary
  labels.

## Surfaces

Shared surface classes in `client/main.css` provide:

- `rr-surface` for base panels.
- `rr-surface--raised` for primary route panels and summaries.
- `rr-match-card` for fixture browsing cards.
- `rr-mini-stat` for compact definition-list stats.
- `rr-page-header` for player page shells.

Cards use a restrained 8px radius, soft borders, and modest shadows. The
implementation avoids nested-card-heavy layouts where practical; dense pages
such as prediction Review and My Score still retain grouped rows where the
information structure needs it.

## Buttons

Button classes normalize height, radius, focus, hover, disabled, and tap target:

- `rr-button-primary` for main actions.
- `rr-button-secondary` for supporting actions.
- `rr-button-ghost` for low-emphasis navigation.
- `rr-button-danger` for retry/destructive/error emphasis.

Prediction-specific radio cards, steppers, Cards controls, and Match Result
controls keep their accepted specialized behaviour and styling.

## Page Shells

`imports/ui/components/player/PlayerPrimitives.tsx` provides:

- `PlayerPage`
- `PlayerPageHeader`
- `PlayerSurface`
- `PlayerEmptyState`
- `PlayerLoadingState`
- `PlayerErrorState`

The shell pattern supports an eyebrow/status area, title, subtitle, meta,
actions, optional personality placement, and normal responsive flow.

Applied player-facing pages:

- Home.
- Games / fixture browsing.
- Game Detail.
- Prediction shell, Intro, progress, feedback, and Review action framing.
- Fixture Leaderboard.
- My Score Breakdown.
- Account.

CCPP-012B2 makes `rr-page-header` itself the shared green hero/top-surface
treatment. Home keeps the same approved green look, and Games, Game Detail,
Prediction, Fixture Leaderboard, My Score Breakdown, and Account now inherit the
same Field Green surface, cream copy, Gold primary/header accents, Rooster Red
accent stripe, readable badges, and green-header button treatment.

Leaderboard rows use shared `rr-leaderboard-row` classes that alternate by
rendered row order:

- row 1: soft green tint;
- row 2: soft gold tint;
- row 3: soft green tint;
- row 4: soft gold tint.

The current-user row keeps the visible `YOU` badge and receives a slightly
stronger inset emphasis layered over the green/gold row tone. Winner emphasis is
also layered without changing ranking, tie, pagination, or score data.

The visual direction should not become rainbow-like. Field Green leads; Cream
keeps pages readable; Gold, Rooster Red, Cobalt Blue, and Tan Feather are
supporting accents with deliberate semantic use.

## Status Language

The player-facing fixture helper in `imports/ui/fixtures/fixtureUi.ts` derives
display-only status labels from existing fixture fields:

- `Prediction open` before scheduled kickoff.
- `Locked` at or after scheduled kickoff.
- `Cancelled` for cancelled fixtures.

Leaderboard and score pages continue to use their existing domain statuses:
`awaiting_result`, `provisional`, `final`, `cancelled`, Pending, Void, resolved,
and deduction tones. Result revision remains in the leaderboard projection but
is no longer shown in the player-facing leaderboard UI.

## State Patterns

Loading states use a compact spinner and stable panel.

Empty states use one Rooster image, a short heading, one line of copy, and an
optional CTA. The browser evidence captures fixture-not-found as the safe empty
state because local test helpers do not delete unowned historical fixtures.

Error states keep the actionable message primary and add light personality copy
such as "Rooster's having a moment." Retry remains a real button when recovery
is available.

## Mobile And Accessibility

The shared shell stacks actions and personality placements on narrow screens.
Buttons remain at least 44px tall. Long fixture and player names use wrapping or
`overflow-wrap` rather than causing horizontal overflow.

Rooster images are decorative by default with `alt=""`; visible copy carries
the meaning. Statuses include text and are not colour-only. Focus styles remain
visible through the existing `focus-ring` class. Runtime mascot images reserve
their own dimensions/aspect ratios so full-body and bust poses do not cause
unexpected layout shifts.

## Deferred

This milestone does not introduce a new animation system, page-transition
system, mascot animation framework, avatar/profile system, admin visual
overhaul, leagues, venues, prizes, AI commentary, quizzes, or more backend
scoring features.

CCPP-012B1 also does not replace the accepted Match Result run/push animation.
Those frames remain animation-specific assets, while static player personality
uses the approved expression runtime PNGs documented in
`docs/MAP_Rooster_Assets.md`.
