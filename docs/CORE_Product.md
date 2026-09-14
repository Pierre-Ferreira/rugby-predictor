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
- No implemented fixtures, predictions, scoring, accounts, leagues, leaderboards, prizes, sponsorships, animations, quizzes, or AI reports.

## Implemented In CCPP-002

- Repeatable static checks, unit tests, browser smoke tests, and GitHub Actions configuration.
- No new product gameplay, scoring, account, fixture, prediction, leaderboard, league, sponsorship, quiz, animation, or AI functionality.

## Implemented In CCPP-003

- Authoritative scoring rules in `docs/CORE_Scoring_Rules.md`.
- Framework-independent TypeScript scoring engine for ruleset validation, prediction validation, observation validation, live/provisional scoring, final-score rejection rules, and itemized score breakdowns.
- Default ruleset snapshot for the agreed CCPP-003 questions and deductions.
- Unit coverage for scoring rules, validation failures, pending/provisional/final observations, ruleset snapshots, and worked examples.
- No UI, accounts, database collections, fixture administration, prediction submission, match-event reducer, live event capture, league aggregation, AI, deployment, or admin configuration permissions.

## Agreed Product Direction

- Players start each fixture with 10,000 points; deductions apply, with a minimum final score of zero.
- Default scoring rules and worked examples are authoritative in `docs/CORE_Scoring_Rules.md`.
- Use Team1/Team2 internally rather than assuming Home/Away.
- Live scores are labelled "If it ended now"; unresolved predictions remain pending. Final scores become official after confirmation.
- Fixture question sets and scoring rules need versioned snapshots to protect existing competitions from later configuration changes.
- Permanent score and card questions, configurable optional questions, and fixture-specific custom questions are planned. Exact configuration constraints remain to be specified.
- Prediction access will use passwordless email links. The detailed account and session flow requires its own implementation milestone.
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
- Account and session lifecycle for passwordless email access.
- Venue competition, prize, and sponsorship rules.
