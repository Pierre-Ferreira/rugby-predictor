# Rugby Rooster Visual Identity Platform

## Scope

CCPP-012B establishes the first coherent player-facing Rugby Rooster visual
foundation. It is presentation work over the existing routes and behaviours; it
does not change routing, auth, predictions, scoring, leaderboard ranking,
identity privacy, fixture lifecycle, or admin workflows.

Detailed Admin visual redesign remains deferred. Admin may inherit base tokens
and typography only.

## Tokens

Global semantic tokens live in `client/main.css`:

- `--rr-bg` and `--rr-bg-strong` for the warm page background.
- `--rr-surface` and `--rr-surface-raised` for player-facing panels.
- `--rr-border` for restrained dividers and outlines.
- `--rr-text` and `--rr-text-muted` for readable hierarchy.
- `--rr-brand` and `--rr-brand-strong` for primary rugby-green actions.
- `--rr-accent` for warm gold emphasis.
- `--rr-danger`, `--rr-warning`, `--rr-success`, and `--rr-info` for status.

The existing `--color-rooster-*` tokens remain for older prediction-specific
styles. Tailwind exposes both the older `rooster.*` colours and semantic
`rr.*` colours in `tailwind.config.cjs`.

Yellow and Red Card prediction controls still use distinct yellow/red card
styling. Brand gold/red are used selectively so card semantics remain
recognizable.

## Typography

Player-facing pages use the existing system sans stack. No new font files or
web-font dependency were introduced.

Hierarchy:

- Page title: large, compact, heavy, and allowed to wrap.
- Fixture/team title: prominent and compact, with red `vs` emphasis.
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
visible through the existing `focus-ring` class.

## Deferred

This milestone does not introduce a new animation system, page-transition
system, mascot animation framework, avatar/profile system, admin visual
overhaul, leagues, venues, prizes, AI commentary, quizzes, or more backend
scoring features.
