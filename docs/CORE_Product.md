# Rugby Rooster Product Rules

## Product Identity

Rugby Rooster is a standalone rugby prediction game. It is not Rugby Tracker / Rucks and Mauls, and it must not inherit that product's requirements, branding, code, collections, permissions, subscription tiers, or architecture unless a future task explicitly says so.

Rugby Rooster focuses on:

- Predictions for televised rugby fixtures.
- Live scores, deduction explanations, and leaderboards.
- Public and private leagues.
- Future venue competitions, prizes, and sponsorships.
- A playful rooster mascot and Kaplay animations.

Out of scope for this product:

- Club management.
- Player rosters.
- BokSmart documents.
- Player-performance analytics.

## Implemented In CCPP-001

- Public React routes for `/`, `/games`, and unmatched paths.
- Separate admin layout at `/admin`.
- Honest empty states and placeholders.
- Accounts, scoring, fixtures, predictions, leagues, leaderboards, prizes, sponsorships, animations, quizzes, and AI reports were not part of the CCPP-001 implementation scope.

## Implemented In CCPP-002

- Repeatable static checks, unit tests, browser smoke tests, and GitHub Actions configuration.
- No new product gameplay, scoring, account, fixture, prediction, leaderboard, league, sponsorship, quiz, animation, or AI functionality.

## Implemented In CCPP-003

- Authoritative scoring rules in `docs/CORE_Scoring_Rules.md`.
- Framework-independent TypeScript scoring engine for ruleset validation, prediction validation, observation validation, live/provisional scoring, final-score rejection rules, and itemized score breakdowns.
- Default ruleset snapshot for the agreed CCPP-003 questions and deductions.
- Unit coverage for scoring rules, validation failures, pending/provisional/final observations, ruleset snapshots, and worked examples.
- No UI, accounts, database collections, fixture administration, prediction submission, match-event reducer, live event capture, league aggregation, AI, deployment, or admin configuration permissions.

## Implemented In CCPP-004

- Passwordless email-link account access using Meteor accounts.
- Email identity normalization that preserves plus addressing.
- Safe in-app return-path validation for sign-in redirects.
- Local/test mail capture without sending real emails.
- Server-side hardening around passwordless package request and login methods.
- Link-request and token-redemption throttling.
- Token expiry, replay rejection, resend invalidation, and concurrent redemption protection.
- Verified player account route at `/account`.
- Restricted platform-admin route at `/admin` backed by a server-authorised method.
- Test-only auth helpers guarded by private local settings and disabled in production.
- Unit, Meteor full-app integration, and Playwright coverage for account and authorisation behavior.
- No fixtures, predictions, leagues, leaderboards, prizes, sponsorships, animation, quizzes, AI reports, payment features, or Rugby Tracker / Rucks and Mauls concepts.

## Implemented In CCPP-005

- Platform-admin fixture creation, editing, publication, and cancellation.
- Fixture persistence with Team 1 / Team 2 display names, competition display
  name, UTC scheduled kickoff, optional venue, visibility, cancellation state,
  server-owned admin metadata, and first-publication scoring ruleset snapshot.
- Public browsing for published upcoming and past scheduled fixtures at
  `/games`.
- Public fixture detail routes at `/games/:fixtureId`.
- Draft privacy through public list/detail publication exclusion.
- South African time admin-entry policy for this initial workflow.
- No prediction submission, match results, live/completed automation, deletion,
  unpublishing, restoration, team/competition management, custom question UI,
  service-worker caching, or offline fixture browsing.

## Implemented In CCPP-006

- Player prediction entry route at `/games/:fixtureId/predict`.
- Existing passwordless sign-in flow returns anonymous players to a selected
  fixture prediction page through validated return paths.
- One prediction entry per verified player per fixture.
- Server-authorized submission and revision before scheduled kickoff.
- Stored predictions validated against the fixture's existing ruleset snapshot.
- Kickoff equality and later writes are rejected; locked saved entries remain
  readable by their owners.
- Cancelled, draft, missing, and snapshotless fixtures reject prediction writes.
- Revision conflicts preserve unsaved browser answers and require explicit
  reload to replace local values.
- Prediction state is independent of future Kaplay animation.
- No results, leaderboards, leagues, custom-question administration, AI,
  service-worker caching, or Kaplay implementation.

## Implemented In CCPP-011B

- Player fixture leaderboard route at `/games/:fixtureId/leaderboard`.
- Derived ranking for one fixture using saved predictions, current match
  result, and the accepted CCPP-011A player fixture-score projection.
- Awaiting-result, provisional `If it ended now`, final, and cancelled
  leaderboard states.
- Standard competition ranking for fixture ties, such as `1,2,2,4`.
- Temporary privacy-safe fixture-scoped player aliases until a proper public
  display-name feature exists.
- Bounded pagination, current-player highlighting, manual refresh, and
  visible-page refresh for awaiting/provisional leaderboards.
- No leagues, cumulative totals, average scores, prizes, QR redemption, AI
  commentary, persistent ranking cache, or animation work.

## Implemented In CCPP-011C

- Signed-in player's own fixture score breakdown route at
  `/games/:fixtureId/my-score`.
- Reuse of the owner-only CCPP-011A projection through
  `predictions.getMyFixtureScore`; no second scoring path or duplicate formula.
- Awaiting-result, provisional `If it ended now`, final, cancelled, and
  no-prediction states.
- Item-level Pending display, so one team row can resolve with a deduction
  while another row in the same section remains Pending.
- Blank/Pending, explicit zero, custom Number, custom Choice stable-option
  labels, custom Void, and zero-floor explanations.
- The authoritative team-score component is shown as a `Predicted Score`
  section after Drop Goals without recalculating deductions in the UI.
- Manual Refresh and visible-page refresh for awaiting/provisional states, with
  last-good breakdown retained after refresh failure.
- No AI commentary, leagues, prizes, another user's breakdown, score
  persistence, background jobs, live event ingestion, or animation work.

## Implemented In CCPP-012A

- Owner-editable public display name for verified players.
- Dedicated server-owned `player_profiles` collection with unique `userId`,
  denied direct client writes, and owner-only get/update methods.
- Display-name validation that trims, normalizes whitespace, accepts normal
  Unicode names, rejects blank/control-character values, and blocks only narrow
  reserved impersonation names.
- Safe public identity projection containing only `displayName`.
- Batch public identity resolver for competitive views.
- Fixture leaderboard labels now prefer another player's public display name
  and fall back to the existing fixture-scoped `Rooster XXXXXXXX` alias.
- Current signed-in leaderboard player remains labelled `You`.
- Account page public-name editor with explicit public-visibility copy.
- No forced onboarding, global name uniqueness, handles, avatars, profile
  pages, moderation workflow, leagues, social features, or animation work.

## Implemented In CCPP-012B

- Player-facing visual identity foundation for Home, Games, Game Detail,
  Prediction shell, Fixture Leaderboard, My Score Breakdown, and Account.
- Semantic `--rr-*` colour tokens and Tailwind `rr.*` aliases.
- Shared player-facing page shells, surfaces, buttons, status badges, loading,
  empty, and error state patterns.
- Static Rooster personality component and typed mood catalog based only on
  assets actually present in the repository.
- Page-state personality mapping for current player journeys without adding a
  new animation system.
- Leaderboard result revision hidden from normal player-facing UI while
  remaining available internally.
- Account page presentation now separates public player name from private email
  account details.
- 012A display-name validation hardening completed: Unicode format-control
  characters (`\p{Cf}`) are rejected while normal Unicode names and diacritics
  remain supported.
- No leagues, venues, prizes, AI commentary, avatars, new prediction
  animations, backend scoring changes, or Admin visual overhaul.

## Agreed Product Direction

- Players start each fixture with 10,000 points; deductions apply, with a minimum final score of zero.
- Default scoring rules and worked examples are authoritative in `docs/CORE_Scoring_Rules.md`.
- Use Team1/Team2 internally rather than assuming Home/Away.
- Live scores are labelled "If it ended now"; unresolved predictions remain pending. Final scores become official after confirmation.
- Fixture question sets and scoring rules need versioned snapshots to protect existing competitions from later configuration changes.
- Permanent score and card questions, configurable optional questions, and fixture-specific custom questions are planned. Exact configuration constraints remain to be specified.
- Prediction access uses passwordless email links. Future prediction submission must bind submissions to authenticated verified player accounts through server methods.
- Leagues, cumulative results, matches played, average points, placements, and prizes are planned.
- Venue branding and sponsorship placements must be considered as the system grows.
- Message variations and the rooster's animations will enrich the prediction flow.
- Quizzes and AI reports are later enhancements.
- Account-access email and optional marketing preferences must be treated separately.
- Public display names are public presentation only; account email remains
  private and is not a display-name fallback.

## Unresolved Product Decisions

These require precise specifications before implementation:

- Extra-time treatment. CCPP-003 scores the supplied observation set only; whether upstream observations are regulation-time or extra-time-inclusive remains unresolved before match-event integration.
- Permanent prediction locking policy independent of the fixture's current
  scheduled kickoff.
- League, prize, and cross-fixture tie policies. Fixture leaderboard ties use
  standard competition ranking from CCPP-011B.
- Detailed optional question configuration constraints.
- Account deletion, support, and long-term email preference lifecycle beyond sign-in access.
- Platform-admin management UI and audit policy.
- Venue competition, prize, and sponsorship rules.
- Long-term public display-name moderation, avatar, handle, and profile-page
  policies.
