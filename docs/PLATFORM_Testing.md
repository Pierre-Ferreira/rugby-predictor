# Rugby Rooster Testing Platform

## Status

Testing strategy: agreed for CCPP-002.

Implementation evidence: locally verified on September 14, 2026 in `docs/AUDIT_002_Testing_Infrastructure.md`.

Remote CI status: configured but not yet observed running in GitHub Actions from this workspace.

## Static Checks

Run checks through Meteor's bundled npm runtime:

```sh
meteor npm run format:check
meteor npm run lint
meteor npm run lint:project
meteor npm run typecheck
```

Responsibilities:

- Prettier owns formatting. Use `meteor npm run format` to apply formatting and `meteor npm run format:check` in CI.
- ESLint owns JavaScript, TypeScript syntax, React, hooks, and JSX accessibility linting.
- TypeScript owns semantic type checking with `noEmit` and `--incremental false`, so checks do not update `tsconfig.tsbuildinfo`.
- `lint:project` owns durable Rugby Rooster invariants: Meteor remains pinned to `3.5.1`, `insecure` and `autopublish` stay absent, root Markdown stays limited to `README.md` and `AGENTS.md`, prefixed docs stay under `docs/`, and starter Meteor tutorial artifacts do not reappear.

The project-invariant check must not reject legitimate future domain collections, publications, or methods. Future milestones should add targeted tests and server-side permission checks for those behaviours instead.

## ESLint Notes

The repository currently keeps `typescript@7.0.2` because the Meteor Rspack checker supports TypeScript 7 native checking. ESLint parses TypeScript and TSX syntax with `@babel/eslint-parser` while `tsc` remains the authoritative semantic TypeScript check.

Evidence recorded during CCPP-002 verification:

- `meteor node --version` returned `v24.15.0`.
- `meteor npm ls @babel/core @babel/eslint-parser eslint typescript @playwright/test vitest --depth=0` reported `@babel/core@8.0.5`, `@babel/eslint-parser@8.0.5`, `eslint@9.39.5`, `typescript@7.0.2`, `@playwright/test@1.63.0`, and `vitest@5.0.0`.
- `meteor npm ls @typescript-eslint/parser typescript-eslint --depth=0` reported an empty tree.
- `eslint.config.mjs` uses `@babel/eslint-parser` with `requireConfigFile: false` and Babel parser plugins for `jsx` and `typescript` with `isTSX: true`.

ESLint 9 is pinned because the installed React and JSX accessibility plugin peer ranges in the lockfile do not yet cover ESLint 10. `meteor npm ci` warns that `eslint@9.39.5` is no longer supported. Track plugin support and move to a maintained ESLint major in a bounded dependency-maintenance task.

## Unit Tests

Runner: Vitest.

Current implementation: locally verified for CCPP-003.

Vitest runs fast TypeScript unit tests without starting Meteor, MongoDB, or a browser. Use it for framework-independent domain logic such as route resolution, browser-test target safety, and scoring/prediction validation.

Test locations and naming:

- Unit tests live under `tests/unit/`.
- Test files use `*.test.ts`.

Current unit test files:

- `tests/unit/routes.test.ts` - route resolution.
- `tests/unit/playwright-target.test.ts` - local-only Playwright target guard.
- `tests/unit/scoring-engine.test.ts` - CCPP-003 scoring rules, validation, snapshots, pending/provisional/final observations, custom questions, and worked examples.

Commands:

```sh
meteor npm run test:unit
meteor npm run test:unit:watch
```

Do not invent domain logic just to create tests. Add tests for meaningful new behaviour, important failure paths, and bug regressions where practical. Report the runner's test count as tests passed.

## Browser Tests

Runner: Playwright Test.

Current implementation: locally verified for CCPP-002.

Browser tests live under `tests/e2e/` and use accessible role/name selectors where practical. The Playwright config starts the Meteor app on local port `3200` unless `PLAYWRIGHT_BASE_URL` is provided.

`tests/support/playwright-target.ts` resolves the browser-test target. Default tests run against `http://127.0.0.1:3200`. If `PLAYWRIGHT_BASE_URL` is supplied, it must use a local loopback host: `127.0.0.1`, `localhost`, or `::1`. Non-local hosts fail during Playwright config loading before browsers or tests run.

Install browser prerequisites:

```sh
meteor npm run playwright:install
```

For CI or Linux machines missing browser system dependencies:

```sh
meteor npm exec playwright -- install --with-deps chromium
```

Run browser smoke tests:

```sh
meteor npm run test:e2e
```

The current browser suite covers:

- Homepage identity.
- Navigation from `/` to `/games`.
- Direct `/games` loading and refresh.
- Browser back and forward navigation.
- Focused keyboard navigation through the main navigation to `/games`.
- `/admin` non-functional placeholder.
- Unknown-path not-found handling.
- Desktop and mobile horizontal-overflow checks for public and admin layouts.

Failure diagnostics:

- Playwright retains traces, screenshots, and videos on failure.
- Generated artifacts under `test-results/` and `playwright-report/` are ignored by Git.

Browser checks do not prove backend security. Server code must still be inspected for privileged operations, and future domain features need server-side tests.

## Future Integration-Test Boundary

Boundary decision: agreed. Implementation is deferred until database-backed features exist.

Do not build speculative database test infrastructure before database-backed features exist.

Future Meteor/database integration tests must cover:

- Authentication and server-side permissions.
- Prediction ownership.
- Submission deadlines.
- Duplicate-request handling.
- Fixture rule snapshots.
- Match-event corrections and recalculated results.

Database-backed tests will require isolated test data, explicit test configuration, and cleanup limited to test-owned data. They must never connect to production services.

## CI

Provider: GitHub Actions, inferred from the GitHub `origin` remote.

Implementation status: configured, not remotely verified from this workspace.

Workflow: `.github/workflows/verification.yml`.

The workflow:

- Uses Node.js 24 for Meteor 3.5 compatibility.
- Installs Meteor `3.5.1` through the official install script with `release=3.5.1`.
- Adds `$HOME/.meteor` to `GITHUB_PATH` for later workflow steps.
- Verifies `meteor --version` equals `Meteor 3.5.1`.
- Runs `meteor npm ci`.
- Installs Playwright Chromium with browser system dependencies.
- Runs formatting, ESLint, project-invariant, TypeScript, Vitest, and Playwright checks.
- Uploads Playwright artifacts only on failure.

No deployment steps or production secrets are required.

## Dependency Findings

Current CCPP-002 findings are recorded in `docs/AUDIT_002_Testing_Infrastructure.md`.

- `meteor npm audit --audit-level=low` found five moderate development-tool vulnerabilities through `uuid <11.1.1` in the `sockjs` / `webpack-dev-server` / `@rspack/dev-server` / `@rspack/cli` chain.
- npm reported that the available automatic fix requires `npm audit fix --force` and would install `@rspack/cli@2.2.4`, which is a breaking change relative to the current Rspack stack. CCPP-002 did not force that upgrade.
- `meteor npm audit --omit=dev --audit-level=low` found zero production dependency vulnerabilities.
- `meteor npm ci` also warned that `uuid@8.3.2` and `eslint@9.39.5` are deprecated.

Remediate these in a bounded dependency-maintenance task that can assess Meteor Rspack compatibility, Rspack dev-server upgrades, and ESLint major-version support together.

## Troubleshooting

- npm may emit `Unknown env config "nodedir"` in this environment. It is noisy but did not fail local checks.
- Playwright must have a browser installed. If `test:e2e` reports a missing executable under `.cache/ms-playwright`, run the browser install command above.
- Local sandboxed runs may block Meteor port binding. On a normal developer machine, run the same commands directly from the repository root.
- If port `3200` is already in use, stop the conflicting local process or set `PORT` to another local port. If using `PLAYWRIGHT_BASE_URL`, keep it on a local loopback host.

## References

- ESLint flat configuration and combined config guidance: https://eslint.org/docs/latest/use/configure/configuration-files
- Prettier CLI check guidance: https://prettier.io/docs/cli
- Playwright web server and diagnostics guidance: https://playwright.dev/docs/test-webserver
- Vitest TypeScript unit-test runner guidance: https://vitest.dev/guide/
- Meteor install and Node compatibility guidance: https://docs.meteor.com/about/install
