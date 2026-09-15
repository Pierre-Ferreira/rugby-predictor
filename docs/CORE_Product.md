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

## Unresolved Product Decisions

These require precise specifications before implementation:

- Extra-time treatment. CCPP-003 scores the supplied observation set only; whether upstream observations are regulation-time or extra-time-inclusive remains unresolved before match-event integration.
- Prediction submission and reopening policies.
- Leaderboard tie-breaking.
- Detailed optional question configuration constraints.
- Account deletion, support, and long-term email preference lifecycle beyond sign-in access.
- Platform-admin management UI and audit policy.
- Venue competition, prize, and sponsorship rules.
