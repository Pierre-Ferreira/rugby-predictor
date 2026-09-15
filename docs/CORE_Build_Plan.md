# Rugby Rooster Build Plan

This is the current roadmap, not permission to implement later milestones inside an earlier task.

## Milestone Sequence

1. Application foundation - this task.
2. Testing infrastructure and foundation verification - CCPP-002.
3. Detailed game rules and tested scoring engine - CCPP-003.
4. Passwordless accounts and authorisation - CCPP-004.
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

Not part of this milestone:

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

Not part of this milestone:

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

Not part of this milestone:

- UI, accounts, database collections, fixture administration, prediction submission, match-event capture, event normalization, league aggregation, leaderboards, AI, deployment, or admin configuration permissions.
- Database immutability for fixture ruleset snapshots.
- Upstream regulation-time versus extra-time observation policy.

## CCPP-003A Scope

Milestone status: implemented as focused corrections to CCPP-003. Verification evidence is recorded in `docs/AUDIT_003A_Scoring_Validation_Corrections.md`.

Implemented:

- First-try observation consistency validation against supplied try totals.
- Runtime validation for public scoring helper entry points.
- Structured outer-request validation for `scoreFixture`.
- Direct ruleset snapshot-isolation regression tests, including nested custom categorical options.
- ESLint parser split so `.ts` generic arrows and `.tsx` JSX both parse correctly.
- Documentation corrections for public API boundaries, pending-data limits, mixed pending/zero scoring, and snapshot cloning guarantees.

Not part of this milestone:

- Accounts, persistence, fixtures, submission, event capture, UI, leaderboard functionality, deployment, or admin configuration permissions.
- Runtime object freezing or database immutability for rulesets.
- Extra-time, cancellation, or leaderboard policy decisions.

## CCPP-004 Scope

Milestone status: implemented for passwordless account access and platform-admin authorisation. Verification evidence is recorded in `docs/AUDIT_004_Passwordless_Accounts_Authorisation.md`.

Implemented:

- Passwordless email-link request and redemption routes.
- Server-owned account operations through Meteor accounts and methods.
- Safe return-path handling and email identity normalization.
- Local/test mail capture with no real email delivery in test settings.
- Link/request throttling and token redemption throttling.
- Token expiry, replay rejection, resend invalidation, concurrent redemption protection, and package method input hardening.
- Authenticated verified account page.
- Server-authorised platform-admin summary page.
- Test-only auth helpers enabled only by private local settings outside production.
- Unit, Meteor integration, and Playwright browser coverage for account and authorisation behavior.

Not implemented:

- Fixture management, prediction submission, scoring persistence, match-event capture, league aggregation, leaderboards, prizes, sponsorships, animations, quizzes, AI reports, payment features, or rich admin user management.
- Account deletion, support workflows, marketing preferences UI, or long-term consent/audit policy.

## CCPP-004A Scope

Milestone status: in progress and checkpointed for review in
`docs/AUDIT_004A_Login_Navigation_Fix.md`. This is not completion evidence.

Current checkpointed work:

- Account-aware `/auth/email-link` navigation for same-account continuation and
  different-account switch-or-keep decisions.
- Malformed new email-link handling that clears pending tab credentials instead
  of falling back to older stored credentials.
- Isolated integration and Playwright launchers with loopback binding,
  generated test run IDs, and inherited Mongo variable rejection.
- Rspack loopback host/origin adjustments for local browser-test startup.
- A client-development, isolated-E2E `Meteor.isTest` override and HMR/live-reload
  suppression gate that still requires review before acceptance.

Not complete:

- The `Meteor.isTest` override has not been accepted as the final solution.
- Full final verification has not been re-run after this checkpoint.
- No commit, push, deployment, or production verification has been performed.

## Roadmap Discipline

Future work should keep product-decision status separate from implementation status. Promote product decisions from unresolved to agreed only when requirements are explicit, and promote implementation status only when code and verification evidence exist. When a decision is missing, document the gap instead of filling it with assumptions.
