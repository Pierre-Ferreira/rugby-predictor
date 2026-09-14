# Rugby Rooster Platform Architecture

## Current Foundation

Rugby Rooster is a Meteor `3.5.1` application using React, TypeScript, MongoDB through Meteor, and TailwindCSS.

Current boundaries:

- `client/` owns browser startup and global styles.
- `server/` owns Meteor server startup.
- `imports/shared/` holds framework-light shared metadata used by client and future server code.
- `imports/ui/` owns React layouts, route pages, links, and status states.
- `docs/` owns prefixed project documentation.
- `scripts/` owns local verification helpers.
- `tests/unit/` owns framework-independent unit tests.
- `tests/e2e/` owns Playwright browser smoke tests.
- `tests/support/` owns shared verification helpers.
- `.github/workflows/` owns GitHub Actions verification configuration.

## Data And Authority

Planned platform responsibilities:

- Meteor methods and publications own authoritative operations and controlled data access.
- MongoDB stores persistent application data.
- React owns accessible application UI and navigation.
- Jotai will hold temporary UI state where useful.
- simpl-schema will validate relevant domain inputs and data.
- Kaplay will provide isolated animations and game experiences.
- Scoring and prediction validation must remain independent of React and Kaplay.
- AI services will be introduced later behind server-side integrations.

CCPP-001 does not define domain collections, publications, methods, accounts, scoring, predictions, or leaderboards. `insecure` and `autopublish` must remain absent.

CCPP-002 adds verification infrastructure only. It does not change data authority or introduce domain persistence.

## Dependency Discipline

Install Jotai, simpl-schema, and Kaplay when a milestone actually needs them. Do not create empty abstractions for future features.

Use Meteor's bundled runtime through `meteor npm` for installation and verification. Do not change the developer's global Node installation.

## Styling

TailwindCSS is wired through `postcss.config.js`, `tailwind.config.cjs`, and `client/main.css`.

The initial design tokens use a small playful rugby palette:

- Rooster red.
- Sun yellow.
- Grass green.
- Ink.
- Paper.
- Muted text.
- Line.

Final mascot assets and approved branding are not established in CCPP-001.

## Security Notes

- The admin page is a placeholder only.
- Authentication and server-side authorisation are future work.
- Do not expose privileged data or actions through client-only checks.
- Keep secrets out of source control and documentation.
- Browser tests can confirm placeholder UI behaviour, but backend security must be verified through server code review and future integration tests.

## Verification Architecture

Testing-stack decision: agreed for CCPP-002.

Implementation evidence: local verification is recorded in `docs/AUDIT_002_Testing_Infrastructure.md`. Remote GitHub Actions execution is configured but has not been observed from this workspace.

- ESLint checks code quality for TypeScript syntax, React, hooks, JSX accessibility, JavaScript, and config files.
- Prettier owns formatting.
- TypeScript checking runs with `noEmit` and without incremental build output.
- Vitest owns fast unit tests for framework-independent code.
- Playwright owns browser smoke checks against a local Meteor server on a dedicated test port. The Playwright target guard rejects non-local hosts to avoid accidental production testing.
- Project invariant checks stay separate from ESLint and protect durable repo rules without blocking legitimate future collections or publications.
