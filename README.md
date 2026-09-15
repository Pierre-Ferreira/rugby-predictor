# Rugby Rooster

Rugby Rooster is a standalone rugby prediction game for televised rugby fixtures. CCPP-001 established the Meteor React TypeScript foundation, public/admin layouts, Tailwind styling, and documentation convention. CCPP-002 adds repeatable static, unit, browser, and CI verification. CCPP-003 adds the framework-independent scoring rules and tested scoring engine. CCPP-004 adds passwordless accounts and server-side authorisation. CCPP-005 adds fixture management and public fixture browsing.

This repository is not Rugby Tracker / Rucks and Mauls. Club management, player rosters, BokSmart documents, subscription tiers, and player-performance analytics are outside this project unless a future task explicitly changes scope.

## Stack

- Meteor `3.5.1`
- React `18`
- TypeScript
- MongoDB through Meteor
- TailwindCSS `3.4`

## Routes

- `/` - Rugby Rooster introduction and link to browse games.
- `/games` - Published fixture browsing.
- `/games/:fixtureId` - Published fixture detail.
- `/sign-in` - Passwordless email-link request form.
- `/auth/email-link` - Passwordless link confirmation route.
- `/account` - Authenticated verified player account summary.
- `/admin` - Restricted platform-admin summary and fixture management.
- Any unmatched route - not-found page.

The admin route exposes only server-authorised summary and fixture management data. Prediction, leaderboard, league, prize, sponsorship, animation, quiz, and AI features remain future milestones.

## Commands

Use Meteor's bundled runtime:

```sh
meteor npm install
meteor npm run start
meteor npm run format
meteor npm run format:check
meteor npm run lint
meteor npm run lint:project
meteor npm run typecheck
meteor npm run test:unit
meteor npm run test:unit:watch
meteor npm run test:integration
meteor npm run playwright:install
meteor npm run test:e2e
```

`meteor npm run lint` runs ESLint over TypeScript, React, JavaScript, and config files.

`meteor npm run lint:project` checks durable Rugby Rooster invariants such as Meteor pinning, absent `insecure` / `autopublish`, product identity, and the Markdown documentation convention.

`meteor npm run format:check` runs Prettier in check mode.

`meteor npm run typecheck` runs TypeScript with no emit.

`meteor npm run test:unit` runs Vitest unit tests once. `meteor npm run test:unit:watch` runs the same suite in watch mode.

`meteor npm run test:integration` runs Meteor full-app server tests for passwordless account and authorisation behavior with local-only settings.

`meteor npm run playwright:install` installs the local Chromium browser used by Playwright. In CI or Linux setup where system packages are missing, run `meteor npm exec playwright -- install --with-deps chromium`.

`meteor npm run test:e2e` runs Playwright browser smoke tests. The Playwright config starts the Meteor app on a dedicated local test port unless `PLAYWRIGHT_BASE_URL` is supplied. Supplied Playwright base URLs must be local loopback URLs such as `http://127.0.0.1:3200`; non-local hosts are rejected to prevent accidental production testing.

GitHub Actions is configured in `.github/workflows/verification.yml`. Local verification is documented in `docs/PLATFORM_Testing.md` and each milestone audit.

## Documentation

Root documentation:

- `AGENTS.md` - future-agent instructions.
- `README.md` - setup and project overview.

Project documentation lives under `docs/`:

- `docs/CORE_Product.md`
- `docs/CORE_Build_Plan.md`
- `docs/CORE_Scoring_Rules.md`
- `docs/CORE_Fixtures.md`
- `docs/PLATFORM_Architecture.md`
- `docs/PLATFORM_Authentication.md`
- `docs/PLATFORM_Scoring_Engine.md`
- `docs/PLATFORM_Fixtures.md`
- `docs/PLATFORM_Testing.md`
- `docs/MAP_System.md`
- `docs/AUDIT_001_Project_Foundation.md`
- `docs/AUDIT_002_Testing_Infrastructure.md`
- `docs/AUDIT_003_Scoring_Engine.md`
- `docs/AUDIT_003A_Scoring_Validation_Corrections.md`
- `docs/AUDIT_004_Passwordless_Accounts_Authorisation.md`
