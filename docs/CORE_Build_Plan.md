# Rugby Rooster Build Plan

This is the current roadmap, not permission to implement later milestones inside an earlier task.

## Milestone Sequence

1. Application foundation - this task.
2. Testing infrastructure and foundation verification - CCPP-002.
3. Detailed game rules and tested scoring engine - CCPP-003.
4. Passwordless accounts and authorisation.
5. Fixture management and public fixture browsing.
6. Prediction sequence and submission locking.
7. Match-event capture, corrections, and live/final leaderboard scoring.
8. Subsequent league, venue, sponsorship, animation, quiz, and AI milestones.

## CCPP-001 Scope

Implemented:

- Meteor React TypeScript application at the repository root.
- TailwindCSS foundation styling.
- Lightweight route handling for public, admin, and not-found views.
- Documentation convention and initial system documents.
- Static verification commands for linting, formatting, and TypeScript.

Not implemented:

- Accounts or passwordless email links.
- Fixture administration or fixture data.
- Prediction forms, scoring, deductions, or validation.
- Match-event capture or leaderboard calculations.
- League management, prizes, sponsorships, Kaplay animations, quizzes, or AI reports.

## CCPP-002 Scope

Milestone status: implemented for the testing foundation and locally verified in `docs/AUDIT_002_Testing_Infrastructure.md`. Remote GitHub Actions execution has not been observed from this workspace.

Implemented:

- ESLint, Prettier, TypeScript, project-invariant, Vitest unit, and Playwright browser smoke commands.
- GitHub Actions workflow for reproducible dependency installation and verification.
- Unit tests for existing framework-independent route resolution.
- Browser tests for current public/admin route behaviour, navigation, refresh, not-found handling, keyboard navigation, and responsive overflow.

Not implemented:

- Accounts, fixtures, predictions, leaderboards, leagues, sponsorships, animations, quizzes, or AI reports.
- Database-backed integration tests for future domain features.

## CCPP-003 Scope

Milestone status: implemented for the isolated scoring rules and framework-independent engine. Verification evidence is recorded in `docs/AUDIT_003_Scoring_Engine.md`.

Implemented:

- Authoritative scoring rules and worked examples in `docs/CORE_Scoring_Rules.md`.
- Pure TypeScript scoring engine under `imports/shared/scoring/`.
- Default ruleset snapshot with CCPP-003 question deductions.
- Ruleset, prediction, and observation validation with structured errors.
- Live "If it ended now" scoring, pending observations, provisional deductions, and final-score confirmation rejection.
- Custom numeric and categorical question support without executable formulas.
- Unit tests for scoring, validation, snapshots, and documented examples.

Not implemented:

- UI, accounts, database collections, fixture administration, prediction submission, match-event capture, event normalization, league aggregation, leaderboards, AI, deployment, or admin configuration permissions.
- Database immutability for fixture ruleset snapshots.
- Upstream regulation-time versus extra-time observation policy.

## Roadmap Discipline

Future work should keep product-decision status separate from implementation status. Promote product decisions from unresolved to agreed only when requirements are explicit, and promote implementation status only when code and verification evidence exist. When a decision is missing, document the gap instead of filling it with assumptions.
