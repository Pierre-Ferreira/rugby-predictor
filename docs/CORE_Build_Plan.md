# Rugby Rooster Build Plan

This is the current roadmap, not permission to implement later milestones inside an earlier task.

## Milestone Sequence

1. Application foundation - this task.
2. Testing infrastructure and foundation verification - CCPP-002.
3. Detailed game rules and tested scoring engine.
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

- Scoring engine, scoring rules, and prediction validation.
- Accounts, fixtures, predictions, leaderboards, leagues, sponsorships, animations, quizzes, or AI reports.
- Database-backed integration tests for future domain features.

## Roadmap Discipline

Future work should keep product-decision status separate from implementation status. Promote product decisions from unresolved to agreed only when requirements are explicit, and promote implementation status only when code and verification evidence exist. When a decision is missing, document the gap instead of filling it with assumptions.
