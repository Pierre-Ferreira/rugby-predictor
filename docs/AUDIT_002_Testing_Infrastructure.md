# AUDIT 002 - Testing Infrastructure

## Status

Completed with local verification on September 14, 2026.

Remote GitHub Actions execution is configured but has not been observed from this workspace.

## Acceptance Criteria

| #   | Criterion                                                                                     | Status                        | Evidence                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Product scope and Meteor version are preserved.                                               | Met                           | `.meteor/release` remains `METEOR@3.5.1`; `meteor --version` returned `Meteor 3.5.1`; project invariants passed.                           |
| 2   | Standard linting, formatting, and TypeScript checks work.                                     | Met                           | Final `format:check`, `lint`, and `typecheck` runs passed locally.                                                                         |
| 3   | Custom invariant checks support future legitimate development.                                | Met                           | `scripts/check-project-invariants.mjs` checks durable repo rules without banning future domain collections or methods.                     |
| 4   | Meaningful unit tests pass.                                                                   | Met                           | `meteor npm run test:unit` passed 2 files and 10 tests.                                                                                    |
| 5   | Committed Playwright tests cover specified browser behaviour.                                 | Met                           | `tests/e2e/foundation.spec.ts` passed 9 Chromium tests.                                                                                    |
| 6   | Desktop, mobile, and focused keyboard checks pass.                                            | Met                           | Playwright suite includes keyboard navigation and desktop/mobile horizontal-overflow checks.                                               |
| 7   | Test commands are reproducible and non-interactive where needed.                              | Met                           | `meteor npm ci`, static checks, unit tests, and e2e tests ran non-interactively.                                                           |
| 8   | CI is configured for the identified provider, or the provider blocker is explicitly recorded. | Configured; remote unverified | `.github/workflows/verification.yml` is present; no remote GitHub Actions run was observed.                                                |
| 9   | Dependency findings are investigated and their disposition documented.                        | Met                           | Full and production npm audits were run; development-tool findings and non-forced remediation are documented below.                        |
| 10  | Documentation and ongoing testing instructions are updated.                                   | Met                           | `README.md`, `AGENTS.md`, and platform/core/map docs were updated.                                                                         |
| 11  | No future product features have been introduced.                                              | Met                           | Changes are limited to verification, docs, and test safety. No gameplay, account, fixture, prediction, or leaderboard features were added. |

## Files Changed

- `.github/workflows/verification.yml` - GitHub Actions verification workflow.
- `.gitignore` - generated test artifacts ignored.
- `.prettierignore` and `prettier.config.cjs` - Prettier configuration.
- `AGENTS.md` - future-agent testing and local-browser-target guardrails.
- `README.md` - updated verification commands and Playwright target notes.
- `docs/AUDIT_002_Testing_Infrastructure.md` - this completion audit.
- `docs/CORE_Build_Plan.md` - CCPP-002 scope and roadmap-status wording.
- `docs/CORE_Product.md` - CCPP-002 product-scope statement.
- `docs/MAP_System.md` - verification entry points.
- `docs/PLATFORM_Architecture.md` - verification architecture.
- `docs/PLATFORM_Testing.md` - testing platform, CI, dependency, and troubleshooting guidance.
- `eslint.config.mjs` - ESLint flat config using Babel parser for TS/TSX syntax.
- `package.json` and `package-lock.json` - verification scripts and dev dependencies.
- `playwright.config.ts` - browser smoke-test configuration with local target guard.
- `scripts/check-project-invariants.mjs` - durable project invariant check.
- `tests/e2e/foundation.spec.ts` - Playwright foundation smoke tests.
- `tests/support/playwright-target.ts` - loopback-only Playwright target resolver.
- `tests/unit/playwright-target.test.ts` - regression coverage for Playwright target safety.
- `tests/unit/routes.test.ts` - route-resolution unit coverage.
- `tsconfig.json` - removal of obsolete Mocha test type.
- `vitest.config.mts` - Vitest unit-test configuration.

Removed obsolete CCPP-001 verification files superseded by the new infrastructure:

- `scripts/check-format.mjs`
- `scripts/lint-foundation.mjs`
- `tests/main.ts`

## Verification Commands

| Command                                                                                                                                                                                              | Result                       | Evidence                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `meteor --version`                                                                                                                                                                                   | Passed                       | Returned `Meteor 3.5.1`.                                                                                                                    |
| `meteor node --version`                                                                                                                                                                              | Passed                       | Returned `v24.15.0`.                                                                                                                        |
| `meteor npm --version`                                                                                                                                                                               | Passed                       | Returned `11.12.1`.                                                                                                                         |
| `meteor npm ci`                                                                                                                                                                                      | Passed                       | Added 740 packages; emitted `nodedir`, deprecated `uuid@8.3.2`, and deprecated `eslint@9.39.5` warnings.                                    |
| `meteor npm ls @babel/core @babel/eslint-parser eslint typescript @playwright/test vitest --depth=0`                                                                                                 | Passed                       | Reported `@babel/core@8.0.5`, `@babel/eslint-parser@8.0.5`, `eslint@9.39.5`, `typescript@7.0.2`, `@playwright/test@1.63.0`, `vitest@5.0.0`. |
| `meteor npm ls @typescript-eslint/parser typescript-eslint --depth=0`                                                                                                                                | Expected non-zero inspection | Exited 1 with an empty tree, confirming those packages are not installed.                                                                   |
| `meteor npm audit --audit-level=low`                                                                                                                                                                 | Findings                     | Exited 1 with five moderate development-tool vulnerabilities through the Rspack dev-server chain.                                           |
| `meteor npm audit --omit=dev --audit-level=low`                                                                                                                                                      | Passed                       | Found 0 production dependency vulnerabilities.                                                                                              |
| `meteor npm run format:check`                                                                                                                                                                        | Passed after targeted format | Final run passed. Earlier runs found `tests/support/playwright-target.ts` and the audit table, which were then formatted.                   |
| `meteor npm exec prettier -- --write tests/support/playwright-target.ts tests/unit/playwright-target.test.ts playwright.config.ts .github/workflows/verification.yml`                                | Passed                       | Formatted the new/touched implementation files.                                                                                             |
| `meteor npm exec prettier -- --write AGENTS.md README.md docs/AUDIT_002_Testing_Infrastructure.md docs/CORE_Build_Plan.md docs/MAP_System.md docs/PLATFORM_Architecture.md docs/PLATFORM_Testing.md` | Passed                       | Formatted touched Markdown files; only `docs/AUDIT_002_Testing_Infrastructure.md` changed in that pass.                                     |
| `meteor npm exec prettier -- --write docs/AUDIT_002_Testing_Infrastructure.md`                                                                                                                       | Passed                       | Realigned the audit command table after adding the Markdown formatting command evidence.                                                    |
| `meteor npm run lint`                                                                                                                                                                                | Passed                       | ESLint completed with no findings.                                                                                                          |
| `meteor npm run lint:project`                                                                                                                                                                        | Passed                       | Printed `Project invariant check passed.`                                                                                                   |
| `meteor npm run typecheck`                                                                                                                                                                           | Passed                       | `tsc --noEmit --incremental false` completed.                                                                                               |
| `meteor npm run test:unit`                                                                                                                                                                           | Passed                       | 2 test files and 10 tests passed.                                                                                                           |
| `PLAYWRIGHT_BASE_URL=https://rugby-rooster.example.com meteor npm run test:e2e -- --list`                                                                                                            | Expected safety failure      | Rejected non-local host before running browser tests.                                                                                       |
| `meteor npm run test:e2e`                                                                                                                                                                            | Passed                       | 9 Chromium tests passed against local Meteor server on port `3200`.                                                                         |

## Test Counts And Coverage

- Unit tests: 2 files, 10 tests passed.
- Browser tests: 1 file, 9 Chromium tests passed.
- Total automated test assertions at command level: 19 tests passed.
- Coverage collection was not configured or run. CCPP-002 intentionally avoids arbitrary coverage targets.

## Dependency Findings

Full audit:

- Command: `meteor npm audit --audit-level=low`.
- Result: exit 1 with five moderate vulnerabilities.
- Chain: `uuid <11.1.1` missing buffer bounds check when `buf` is provided, pulled through `sockjs`, `webpack-dev-server`, `@rspack/dev-server`, and `@rspack/cli`.
- npm's proposed automatic remediation requires `npm audit fix --force` and would install `@rspack/cli@2.2.4`, which npm marks as a breaking change.

Production-only audit:

- Command: `meteor npm audit --omit=dev --audit-level=low`.
- Result: exit 0 with 0 vulnerabilities.

Disposition:

- The vulnerable chain is currently in development tooling, not production dependencies.
- CCPP-002 did not run a forced breaking Rspack CLI upgrade because Meteor Rspack compatibility should be assessed in a bounded dependency-maintenance task.
- `meteor npm ci` emitted deprecation warnings for `uuid@8.3.2` and `eslint@9.39.5`; ESLint major-version movement should be handled with plugin peer-range checks.
- The recurring `npm warn Unknown env config "nodedir"` warning did not fail any local checks.

## CI Status

- Provider: GitHub Actions.
- Workflow: `.github/workflows/verification.yml`.
- Trigger: `push` and `pull_request`.
- Runner: `ubuntu-latest`.
- Node: `actions/setup-node@v4` with Node.js `24`.
- Meteor install: official install script pinned with `https://install.meteor.com/?release=3.5.1`; `$HOME/.meteor` is added to `GITHUB_PATH`.
- Meteor verification: workflow runs `meteor --version` and asserts the exact output is `Meteor 3.5.1`.
- Verification steps: `meteor npm ci`, Playwright Chromium install with system dependencies, formatting, ESLint, project invariants, TypeScript, Vitest, and Playwright smoke tests.
- Artifacts: Playwright report and test results upload only on workflow failure.
- Remote execution: not observed from this workspace.

## Checks Not Run

- Remote GitHub Actions workflow execution was not observed.
- `meteor npm run test:unit:watch` was not run because it is interactive/watch-mode.
- `meteor npm run test:e2e:ui` was not run because it is interactive UI mode.
- `meteor npm run playwright:install` was not run during final verification because the local browser was already installed and `meteor npm run test:e2e` passed.
- `meteor npm exec playwright -- install --with-deps chromium` was not run locally; it is configured for CI/Linux setup.
- No deployment, commit, push, or production testing was performed.

## Deviations

- Initial `meteor npm run format:check` after adding the Playwright guard failed on `tests/support/playwright-target.ts`; later audit-table edits also needed Prettier realignment. Targeted formatting fixed both, and the final formatting check passed.
- The full dependency audit has unresolved moderate development-tool findings. The available automatic fix is a forced breaking Rspack CLI upgrade, so it was documented instead of applied in this testing-infrastructure task.

## Remaining Limitations And Outstanding Decisions

- Remote CI needs a real GitHub Actions run before it can be called remotely verified.
- Development-tool audit findings need a dependency-maintenance task that can evaluate `@rspack/cli`, `@rspack/dev-server`, Meteor Rspack compatibility, and ESLint major-version support together.
- Browser tests verify current UI behaviour and local target safety, but they do not prove backend security. Future domain features need server-side and database-backed integration tests where appropriate.
- Database-backed integration-test setup remains deferred until account, fixture, prediction, or scoring persistence exists.

## Documentation Paths

- `docs/AUDIT_002_Testing_Infrastructure.md`
- `docs/PLATFORM_Testing.md`
- `docs/CORE_Build_Plan.md`
- `docs/MAP_System.md`
- `AGENTS.md`
- `README.md`

## EOMD Handover

Return these files for EOMD review:

- Completed `docs/AUDIT_002_Testing_Infrastructure.md`
- Updated documentation under `docs/`
- `AGENTS.md`
- `README.md`
- `package.json`
- `eslint.config.mjs`
- `playwright.config.ts`
- `.github/workflows/verification.yml`
