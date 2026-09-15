# Rugby Rooster System Map

## Documentation Index

- `README.md` - project overview, routes, and commands.
- `AGENTS.md` - future-agent operating instructions.
- `docs/CORE_Product.md` - product identity, agreed direction, and unresolved decisions.
- `docs/CORE_Build_Plan.md` - milestone roadmap and CCPP scope boundaries.
- `docs/CORE_Scoring_Rules.md` - authoritative CCPP-003 scoring rules, validation rules, live/final scoring policy, worked examples, and unresolved scoring-adjacent policies.
- `docs/PLATFORM_Architecture.md` - architecture, boundaries, dependencies, and security posture.
- `docs/PLATFORM_Scoring_Engine.md` - pure TypeScript scoring engine module map, API summary, snapshot policy, representative output, and future integration responsibilities.
- `docs/PLATFORM_Testing.md` - static checks, unit tests, browser tests, CI, and integration-test boundaries.
- `docs/MAP_System.md` - this map.
- `docs/AUDIT_001_Project_Foundation.md` - CCPP-001 completion evidence.
- `docs/AUDIT_002_Testing_Infrastructure.md` - CCPP-002 completion evidence.
- `docs/AUDIT_003_Scoring_Engine.md` - CCPP-003 completion evidence.
- `docs/AUDIT_003A_Scoring_Validation_Corrections.md` - CCPP-003A validation correction evidence.

## Application Entry Points

- `client/main.html` - HTML shell and document title.
- `client/main.tsx` - React startup and CSS import.
- `client/main.css` - Tailwind directives and design tokens.
- `server/main.ts` - Meteor server startup with no CCPP-001 domain publications or methods.

## Routes

- `/` - `imports/ui/pages/HomePage.tsx` in the public layout.
- `/games` - `imports/ui/pages/GamesPage.tsx` in the public layout.
- `/admin` - `imports/ui/pages/AdminPage.tsx` in the admin layout.
- Unmatched paths - `imports/ui/pages/NotFoundPage.tsx` in the public layout.

Route metadata and matching live in `imports/shared/routes.ts`. Client-side navigation is handled by `imports/ui/components/AppLink.tsx`.

## Scoring Engine Entry Points

- `imports/shared/scoring/index.ts` - public scoring exports.
- `imports/shared/scoring/types.ts` - scoring domain types and structured result contracts.
- `imports/shared/scoring/rulesets.ts` - default CCPP-003 ruleset snapshot.
- `imports/shared/scoring/primitives.ts` - numeric and categorical scoring primitives.
- `imports/shared/scoring/derived.ts` - derived team-score, result, and observation-status helpers.
- `imports/shared/scoring/errors.ts` - structured scoring validation error.
- `imports/shared/scoring/validation.ts` - ruleset, prediction, and observation validation.
- `imports/shared/scoring/engine.ts` - fixture scoring function.

## Verification Entry Points

- `eslint.config.mjs` - ESLint flat config for TypeScript syntax, React, hooks, JSX accessibility, JavaScript, and config files.
- `prettier.config.cjs` - Prettier formatting settings.
- `.prettierignore` - generated and dependency paths excluded from formatting.
- `vitest.config.mts` - unit-test configuration.
- `playwright.config.ts` - browser-test configuration with local Meteor web server management.
- `.github/workflows/verification.yml` - GitHub Actions verification workflow.
- `scripts/check-project-invariants.mjs` - durable Rugby Rooster project-invariant checks.
- `tests/unit/routes.test.ts` - route resolution unit tests.
- `tests/unit/playwright-target.test.ts` - regression tests for safe browser-test target resolution.
- `tests/unit/scoring-engine.test.ts` - CCPP-003 scoring-engine unit tests.
- `tests/e2e/foundation.spec.ts` - browser smoke tests for current foundation routes and layouts.
- `tests/support/playwright-target.ts` - Playwright target guard that rejects non-local hosts.

## Important Directories

- `client/` - client startup and global CSS.
- `server/` - server startup.
- `imports/shared/` - shared route metadata.
- `imports/shared/scoring/` - framework-independent scoring rules engine.
- `imports/ui/components/` - reusable UI primitives.
- `imports/ui/layouts/` - public and admin layout shells.
- `imports/ui/pages/` - route page components.
- `scripts/` - local lint and formatting checks.
- `tests/unit/` - framework-independent unit tests.
- `tests/e2e/` - Playwright browser smoke tests.
- `tests/support/` - shared verification helpers.
- `docs/` - prefixed project documentation.
