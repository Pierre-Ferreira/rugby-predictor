# Rugby Rooster System Map

## Documentation Index

- `README.md` - project overview, routes, and commands.
- `AGENTS.md` - future-agent operating instructions.
- `docs/CORE_Product.md` - product identity, agreed direction, and unresolved decisions.
- `docs/CORE_Build_Plan.md` - milestone roadmap and CCPP scope boundaries.
- `docs/CORE_Scoring_Rules.md` - authoritative CCPP-003 scoring rules, validation rules, live/final scoring policy, worked examples, and unresolved scoring-adjacent policies.
- `docs/PLATFORM_Architecture.md` - architecture, boundaries, dependencies, and security posture.
- `docs/PLATFORM_Authentication.md` - passwordless account, email-link, settings, mail capture, and authorisation architecture.
- `docs/PLATFORM_Email.md` - email delivery configuration, Postmark adapter choice, local development settings, and manual verification steps.
- `docs/PLATFORM_Scoring_Engine.md` - pure TypeScript scoring engine module map, API summary, snapshot policy, representative output, and future integration responsibilities.
- `docs/PLATFORM_Testing.md` - static checks, unit tests, browser tests, CI, and integration-test boundaries.
- `docs/MAP_System.md` - this map.
- `docs/AUDIT_001_Project_Foundation.md` - CCPP-001 completion evidence.
- `docs/AUDIT_002_Testing_Infrastructure.md` - CCPP-002 completion evidence.
- `docs/AUDIT_003_Scoring_Engine.md` - CCPP-003 completion evidence.
- `docs/AUDIT_003A_Scoring_Validation_Corrections.md` - CCPP-003A validation correction evidence.
- `docs/AUDIT_004_Passwordless_Accounts_Authorisation.md` - CCPP-004 completion evidence.
- `docs/AUDIT_004A_Completion.md` - CCPP-004A final reconciliation and completion evidence.
- `docs/AUDIT_004B_Development_Email.md` - CCPP-004B Postmark development email configuration and verification evidence.
- `docs/AUDIT_004D_Admin_Sign_In.md` - CCPP-004D admin-specific passwordless sign-in behaviour, eligibility checks, bypass protection, and verification evidence.
- `docs/AUDIT_004A_Login_Navigation_Fix.md` - historical CCPP-004A login-navigation and test-stability checkpoint.
- `docs/AUDIT_004A_Throttle_Correction.md` - historical CCPP-004A throttle correction checkpoint.
- `docs/AUDIT_004A_Database_Isolation_Verification.md` - historical CCPP-004A database isolation checkpoint that preserved an unresolved runtime-verification blocker.
- `docs/AUDIT_004A_Database_Verification_Closure.md` - historical CCPP-004A database verification closure attempt and topology blocker.
- `docs/AUDIT_004A_Database_Topology_Correction.md` - historical CCPP-004A topology correction evidence.
- `docs/AUDIT_004A_HMR_Workaround_Resolution.md` - historical CCPP-004A evidence for removing the client `Meteor.isTest` override and verifying auth browser tests with normal client identity.
- `docs/TEMP_004A_Resume.md` - historical CCPP-004A resume checkpoint retained for provenance; superseded by `docs/AUDIT_004A_Completion.md`.
- `docs/TEMP_004D_Resume.md` - temporary CCPP-004D checkpoint for the remaining local full-browser-suite startup timeout.

## Application Entry Points

- `client/main.html` - HTML shell and document title.
- `client/main.tsx` - React startup and CSS import.
- `client/main.css` - Tailwind directives and design tokens.
- `server/main.ts` - Meteor server startup and auth module import.

## Routes

- `/` - `imports/ui/pages/HomePage.tsx` in the public layout.
- `/games` - `imports/ui/pages/GamesPage.tsx` in the public layout.
- `/sign-in` - `imports/ui/pages/SignInPage.tsx` in the public layout, including the admin-specific `mode=admin` request mode used from `/admin`.
- `/auth/email-link` - `imports/ui/pages/AuthEmailLinkPage.tsx` in the public layout.
- `/account` - `imports/ui/pages/AccountPage.tsx` in the public layout.
- `/admin` - `imports/ui/pages/AdminPage.tsx` in the admin layout with server-authorised summary data.
- Unmatched paths - `imports/ui/pages/NotFoundPage.tsx` in the public layout.

Route metadata and matching live in `imports/shared/routes.ts`. Client-side navigation is handled by `imports/ui/components/AppLink.tsx`.

## Authentication Entry Points

- `imports/shared/auth/` - auth constants, method names, email normalization, and safe return-path helpers.
- `imports/shared/auth/config.ts` - framework-independent auth runtime settings validation, isolated-test environment contract, and throttle setting resolution.
- `imports/shared/auth/postmark.ts` - framework-independent Postmark payload and mocked-send adapter logic.
- `imports/shared/auth/testDatabaseIdentity.ts` - framework-independent comparison of expected and observed isolated-test MongoDB endpoint/database identity.
- `imports/server/auth/accounts.ts` - Meteor account configuration, passwordless email templates, local mail delivery wiring, package method hardening, throttling, and token redemption locks.
- `imports/server/auth/methods.ts` - public player auth, admin-specific link request, and restricted admin Meteor methods.
- `imports/server/auth/authorization.ts` - verified-player and platform-admin server checks.
- `imports/server/auth/settings.ts` - server auth settings and production safety validation.
- `imports/server/auth/mongoConnectionIdentity.ts` - Meteor MongoDB connection identity adapter for isolated test helpers.
- `imports/server/auth/postmarkTransport.ts` - server adapter that installs the selected Postmark custom transport.
- `imports/server/auth/testSupport.ts` - private-settings-gated local test helpers registered only after isolated database verification.
- `imports/server/auth/mailSink.ts` - local/test email capture.
- `imports/ui/auth/` - client auth state, sign-out, and method-call helpers.
- `imports/ui/components/AuthStates.tsx` - reusable sign-in-required and access-denied UI states.

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
- `rspack.config.ts` - Meteor Rspack configuration, TypeScript checker plugin, local dev-server host settings, and isolated-E2E Rspack HMR/live-reload suppression gate.
- `.github/workflows/verification.yml` - GitHub Actions verification workflow.
- `scripts/check-project-invariants.mjs` - durable Rugby Rooster project-invariant checks.
- `scripts/test-environment.mjs` - isolated local test environment builder shared by integration and Playwright launchers.
- `scripts/run-integration-tests.mjs` - Meteor full-app integration-test launcher with loopback binding and inherited Mongo variable rejection.
- `scripts/run-playwright-tests.mjs` - Playwright launcher with isolated test run IDs and Meteor-managed local test environment variables.
- `tests/unit/routes.test.ts` - route resolution unit tests.
- `tests/unit/auth-helpers.test.ts` - auth helper unit tests.
- `tests/unit/auth-config.test.ts` - auth runtime configuration tests.
- `tests/unit/postmark-email.test.ts` - Postmark email adapter unit tests.
- `tests/unit/test-database-identity.test.ts` - isolated test MongoDB endpoint/database identity comparison tests.
- `tests/unit/test-launchers.test.ts` - isolated test launcher environment tests.
- `tests/unit/playwright-target.test.ts` - regression tests for safe browser-test target resolution.
- `tests/unit/scoring-engine.test.ts` - CCPP-003 scoring-engine unit tests.
- `imports/server/auth/passwordless.app-test.ts` - Meteor full-app auth integration tests.
- `tests/e2e/foundation.spec.ts` - browser smoke tests for current foundation routes and layouts.
- `tests/e2e/auth.spec.ts` - browser tests for passwordless account and admin access flows.
- `tests/support/playwright-target.ts` - Playwright target guard that rejects non-local hosts.

## Important Directories

- `client/` - client startup and global CSS.
- `server/` - server startup.
- `imports/shared/` - shared route metadata.
- `imports/server/auth/` - passwordless account and server authorisation implementation.
- `imports/shared/auth/` - shared auth constants and validation helpers.
- `imports/shared/scoring/` - framework-independent scoring rules engine.
- `imports/ui/auth/` - client auth state and auth action helpers.
- `imports/ui/components/` - reusable UI primitives.
- `imports/ui/layouts/` - public and admin layout shells.
- `imports/ui/pages/` - route page components.
- `scripts/` - local lint and formatting checks.
- `tests/unit/` - framework-independent unit tests.
- `tests/e2e/` - Playwright browser smoke tests.
- `tests/support/` - shared verification helpers.
- `config/examples/` - tracked placeholder settings examples.
- `config/local/` - ignored local settings files for developer machines.
- `docs/` - prefixed project documentation.
