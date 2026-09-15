# Rugby Rooster Testing Platform

## Status

Testing strategy: agreed for CCPP-002.

Implementation evidence: locally verified on September 14, 2026 in
`docs/AUDIT_002_Testing_Infrastructure.md`, extended for scoring in
CCPP-003/003A, extended for passwordless account integration/browser coverage in
CCPP-004, and reconciled for CCPP-004A in
`docs/AUDIT_004A_Completion.md`.

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
- `eslint.config.mjs` uses `@babel/eslint-parser` with `requireConfigFile: false`.
- CCPP-003A splits parser options by extension: `.ts` uses the TypeScript plugin without TSX ambiguity, `.tsx` uses TypeScript plus JSX, and JavaScript/config files keep JavaScript parsing with JSX support where needed.
- The scoring unit test file contains a valid generic arrow helper in `.ts`, and the full lint run still parses existing TSX application files.

ESLint 9 is pinned because the installed React and JSX accessibility plugin peer ranges in the lockfile do not yet cover ESLint 10. `meteor npm ci` warns that `eslint@9.39.5` is no longer supported. Track plugin support and move to a maintained ESLint major in a bounded dependency-maintenance task.

## Unit Tests

Runner: Vitest.

Current implementation: locally verified for CCPP-003A.

Vitest runs fast TypeScript unit tests without starting Meteor, MongoDB, or a browser. Use it for framework-independent domain logic such as route resolution, browser-test target safety, and scoring/prediction validation.

Test locations and naming:

- Unit tests live under `tests/unit/`.
- Test files use `*.test.ts`.

Current unit test files:

- `tests/unit/routes.test.ts` - route resolution.
- `tests/unit/playwright-target.test.ts` - local-only Playwright target guard.
- `tests/unit/scoring-engine.test.ts` - CCPP-003/003A scoring rules, validation, public helper boundaries, snapshots, pending/provisional/final observations, custom questions, first-try observation consistency, malformed public requests, and worked examples.
- `tests/unit/auth-helpers.test.ts` - email identity normalization and safe auth return paths.
- `tests/unit/auth-config.test.ts` - auth runtime settings validation,
  isolated-test helper contract checks, email delivery provider selection, and
  throttle setting validation.
- `tests/unit/postmark-email.test.ts` - Postmark payload mapping, mocked send,
  invalid-send prevention, and sanitized provider-failure handling.
- `tests/unit/test-database-identity.test.ts` - isolated MongoDB endpoint,
  database, and supported topology verification.
- `tests/unit/test-launchers.test.ts` - isolated test launcher environment,
  inherited Mongo variable rejection, and derived Rspack dev-server port checks.

Commands:

```sh
meteor npm run test:unit
meteor npm run test:unit:watch
```

Do not invent domain logic just to create tests. Add tests for meaningful new behaviour, important failure paths, and bug regressions where practical. Report the runner's test count as tests passed.

## Browser Tests

Runner: Playwright Test.

Current implementation: locally verified for CCPP-002 and extended by CCPP-004.
CCPP-004A browser-test stabilization changes are checkpointed for review; the
previous client-side `Meteor.isTest` override was removed on 2026-09-15 after
targeted login and auth browser-suite verification passed with normal client
identity.

Browser tests live under `tests/e2e/` and use accessible role/name selectors where practical. The Playwright config starts the Meteor app on local port `3200` unless `PLAYWRIGHT_BASE_URL` is provided.

`tests/support/playwright-target.ts` resolves the browser-test target. Default tests run against `http://127.0.0.1:3200`. If `PLAYWRIGHT_BASE_URL` is supplied, it must use a local loopback host: `127.0.0.1`, `localhost`, or `::1`. Non-local hosts fail during Playwright config loading before browsers or tests run.

`meteor npm run test:e2e` runs `scripts/run-playwright-tests.mjs`, which creates
an isolated local environment for the Playwright process. The launcher refuses
inherited Mongo connection variables, sets a generated
`RUGBY_ROOSTER_TEST_RUN_ID`, uses `.meteor/local-playwright`, sets `ROOT_URL` to
loopback, and derives `RSPACK_DEVSERVER_PORT` as the app port plus 2. The managed
web server starts Meteor with `--port 127.0.0.1:<port>` and does not reuse an
existing server.

During isolated E2E client-development builds whose run id begins with
`rr-e2e-`, `rspack.config.ts` disables only Rspack HMR/live reload. It does not
override `Meteor.isTest`, `Meteor.isDevelopment`, or `Meteor.isProduction`.

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
- `/admin` sign-in requirement before protected content.
- Unknown-path not-found handling.
- Desktop and mobile horizontal-overflow checks for public and admin layouts.
- Passwordless email-link request using captured local mail.
- Link redemption in a fresh browser, session restoration, and sign-out.
- Restricted admin denial, grant, and revocation behavior.
- Admin-specific sign-in mode from `/admin`, generic admin acknowledgement, and
  successful admin-directed link redemption for eligible verified platform
  admins.
- Invalid-link recovery without retaining token/email query parameters in the final URL.
- Same-account email-link continuation that explicitly invalidates the presented
  link and rejects reopening that same link after sign-out.
- Different-account email-link confirmation with explicit switch-or-keep choices.
- Malformed new email-link URLs clearing pending tab credentials instead of
  falling back to older stored credentials.
- Blocked client attempts to update protected user fields.
- Mobile and keyboard access for sign-in.

Failure diagnostics:

- Playwright retains traces, screenshots, and videos on failure.
- Generated artifacts under `test-results/` and `playwright-report/` are ignored by Git.

Browser checks do not prove backend security. Server code must still be inspected for privileged operations, and future domain features need server-side tests.

## Integration Tests

Runner: Meteor full-app tests with `meteortesting:mocha`.

Command:

```sh
meteor npm run test:integration
```

Current integration settings live in `tests/settings/integration-settings.json`
and enable local mail capture plus test-only auth helpers. Integration tests must
never connect to production services. Postmark credentials, when present in
other settings files, must not alter isolated integration or browser tests
because local capture takes precedence.

`meteor npm run test:integration` runs `scripts/run-integration-tests.mjs`. The
launcher refuses inherited Mongo connection variables, sets
`.meteor/local-integration`, binds Meteor to `127.0.0.1:<port>`, uses
Meteor-managed Mongo, derives the expected Mongo endpoint as `127.0.0.1` on
`<port + 1>`, defaults to server-only execution with `TEST_CLIENT=0`, and
passes an isolated `rr-integration-*` test run id to server-side auth helpers.
The server auth integration file is also listed as `meteor.testModule.server`
so the full-app test runner has an explicit supported server test entry.

Set `RUGBY_ROOSTER_TEST_MONGO_DIAGNOSTICS=1` only for isolated integration
diagnosis. When combined with `RUGBY_ROOSTER_TEST_MODE=isolated`, the auth
database verifier can emit sanitized MongoDB topology metadata: raw driver
topology type, reported server types, parsed host/port entries, active database
name, and parse counts. The flag defaults off and must not dump driver objects,
connection strings, credentials, emails, or tokens.

The integration suite includes coverage for:

- Passwordless account creation and verification.
- Returning-player account reuse and resend invalidation.
- Same-account continuation link invalidation, session preservation,
  unauthorized invalidation rejection, stale-token protection, and fresh
  signed-out redemption after invalidation.
- Case/whitespace normalization while preserving plus addressing.
- Invalid, expired, replayed, and concurrent token redemption.
- Direct package method hardening against arbitrary selectors and user data.
- Link-request and redemption throttling.
- Isolated helper gating against the active Meteor MongoDB endpoint and
  database name.
- Mail delivery failure reporting.
- Admin-directed sign-in eligibility for verified platform admins, ordinary
  verified accounts, unverified accounts, and unknown addresses.
- Admin-directed ineligible requests preserving existing passwordless token
  state and creating no accounts, tokens, or mail.
- General and package request paths with `/admin` return destinations not
  bypassing the admin eligibility rule.
- Admin-directed request throttling for ineligible attempts.
- Revocation after sending an admin-directed link preventing admin server access.
- Player/admin permission boundaries and admin revocation.
- Narrow current-user publication fields.
- Central safe return-path validation.

Future Meteor/database integration tests must cover:

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
- Runs the Meteor full-app integration suite before Playwright.
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
- Browser checks that start a local Meteor/Rspack web server may need normal loopback access. In restricted automation sandboxes, rerun `meteor npm run test:e2e` with permission for local loopback if the web server listens but Playwright cannot reach it.
- CCPP-004D observed intermittent local Playwright/Meteor startup timeouts in
  the full `auth.spec.ts` browser suite after admin-specific assertions had
  passed. The targeted admin sign-in browser check passed on a fresh launch; the
  broader full-suite startup timeout is checkpointed in
  `docs/TEMP_004D_Resume.md`.
- Generated Meteor/Rspack browser-test directories (`.meteor/local-playwright/`, `_build-local-playwright/`, local build chunks/assets, `test-results/`, and `playwright-report/`) are ignored by source checks and must not be included in handover archives.
- If port `3200` is already in use, stop the conflicting local process or set `PORT` to another local port. If using `PLAYWRIGHT_BASE_URL`, keep it on a local loopback host.
- Do not reintroduce client identity overrides such as `Meteor.isTest` to
  suppress browser-test reload behaviour. Keep any reload controls scoped to the
  isolated E2E launcher/configuration and verify auth with normal client
  identity.

## References

- ESLint flat configuration and combined config guidance: https://eslint.org/docs/latest/use/configure/configuration-files
- Prettier CLI check guidance: https://prettier.io/docs/cli
- Playwright web server and diagnostics guidance: https://playwright.dev/docs/test-webserver
- Vitest TypeScript unit-test runner guidance: https://vitest.dev/guide/
- Meteor install and Node compatibility guidance: https://docs.meteor.com/about/install
