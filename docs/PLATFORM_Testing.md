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

Vitest runs fast TypeScript unit tests without starting Meteor, MongoDB, or a browser. Use it for framework-independent domain logic such as route resolution, browser-test target safety, and scoring/prediction validation. CCPP-009A1 also uses a per-file `jsdom` environment for real React DOM hook/component lifecycle tests; those tests still mock the Meteor transport boundary with controlled promises and are not live Meteor integration tests. CCPP-009B configures Vitest's OXC JSX transform so those React component tests can import TSX modules while Meteor continues to preserve JSX for application bundling.

Test locations and naming:

- Unit tests live under `tests/unit/`.
- Test files use `*.test.ts`.

Current unit test files:

- `tests/unit/routes.test.ts` - route resolution.
- `tests/unit/playwright-target.test.ts` - local-only Playwright target guard.
- `tests/unit/scoring-engine.test.ts` - CCPP-003/003A/008B scoring rules,
  validation, public helper boundaries, snapshots, pending/provisional/final
  observations, custom questions, custom Void observations, first-try
  observation consistency, malformed public requests, and worked examples.
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
- `tests/unit/fixtures.test.ts` - fixture validation, Team 1 / Team 2
  normalization, public/admin pagination option validation, expected-revision
  validation, and South African time to UTC conversion.
- `tests/unit/predictions.test.ts` - prediction submission input validation,
  captured revision validation, server-owned field rejection, internal
  team-side value preservation, bypassed invalid conversion rejection, custom
  answer validation, custom answer injection rejection, and delegation to the
  shared scoring validation contract.
- `tests/unit/prediction-sequence.test.ts` - CCPP-007 standard prediction
  sequence definitions, active progress totals, navigation destinations, shared
  message catalog variant stability, ruleset-derived deduction values,
  disabled-question copy suppression, Intro starting-points interpolation,
  Half-Time Leader wording/display labels, team-name interpolation, first-try
  constraints, conversion clamping, custom step ordering/progress, custom Review
  edit destinations, and score/result consistency helpers.
- `tests/unit/prediction-session.test.ts` - CCPP-009A/009A1 shared
  prediction session reducer/derivation contract tests for answer updates,
  Back/Continue preservation, custom answer stable IDs, blank custom Number
  handling, navigation guards, read-only command guards, discard/reload guards
  during submission, internal completion after read-only context changes,
  message variant stability, reactive revision preservation, duplicate submit
  state, and stale response isolation.
- `tests/unit/prediction-session-hook.test.ts` - CCPP-009A1 real React DOM
  `usePredictionSession(...)` lifecycle tests using `jsdom`, React Strict Mode,
  replaceable keyed consumers below one session owner, controlled submit
  promises, duplicate-submit transport assertions, read-only context updates,
  and disposed-owner stale completion isolation.
- `tests/unit/prediction-presentation-mode.test.ts` - CCPP-009B pure preview
  gate/effective-mode and animation preference storage tests.
- `tests/unit/prediction-presentation-host.test.ts` - CCPP-009B/009B1 real
  React DOM presentation-host lifecycle tests using controlled preview loaders,
  mocked runtime factories, controlled initialization promises, timeout control,
  cleanup/disposal assertions, storage getter failure, unavailable persistence
  retention, one end-to-end deadline, outer import retry, late completion and
  rejection isolation, failure latch/retry, stale callback isolation, and Strict
  Mode replay.
- `tests/unit/prediction-questions.test.ts` - CCPP-008 prediction question
  configuration validation, custom Number/Choice failure paths, max-two custom
  limit, order normalization, stable ID preservation, unknown-field rejection,
  permanent core protection, positive custom deduction rules, optional standard
  ruleset projection, and custom snapshot projection.
- `tests/unit/match-results.test.ts` - CCPP-008B1 raw match-result observation
  envelope validation, malformed incoming statuses, built-in Void rejection,
  custom Void shape, unknown nested observation fields, and server-owned
  provisional/final lifecycle normalization.

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
CCPP-004E extends the foundation browser suite with minimal PWA metadata,
manifest/icon response, icon-dimension, launch-route, responsive layout, and
negative service-worker coverage.

Browser tests live under `tests/e2e/` and use accessible role/name selectors where practical. The Playwright config starts the Meteor app on local port `3200` unless `PLAYWRIGHT_BASE_URL` is provided.

`tests/support/playwright-target.ts` resolves the browser-test target. Default tests run against `http://127.0.0.1:3200`. If `PLAYWRIGHT_BASE_URL` is supplied, it must use a local loopback host: `127.0.0.1`, `localhost`, or `::1`. Non-local hosts fail during Playwright config loading before browsers or tests run.

`meteor npm run test:e2e` runs `scripts/run-playwright-tests.mjs`, which creates
an isolated local environment for the Playwright process. The launcher refuses
inherited Mongo connection variables, sets a generated
`RUGBY_ROOSTER_TEST_RUN_ID`, uses `.meteor/local-playwright`, sets `ROOT_URL` to
loopback, and derives `RSPACK_DEVSERVER_PORT` as the app port plus 2. The managed
web server starts Meteor with `--port 127.0.0.1:<port>` and does not reuse an
existing server.

When `RUGBY_ROOSTER_E2E_EVIDENCE_DIR` is set, the Playwright launcher writes
sanitized launch metadata, safe environment fields, Playwright stdout/stderr,
process/listener snapshots, and process events to that directory. Evidence mode
also performs bounded post-close cleanup for the current run's verified process
records only. Ownership starts with the Playwright process actually spawned by
the launcher. While that process is active, descendants are recorded only when
their lineage to an already owned process is visible and their `/proc` start
identity can be read. Repository paths, `.meteor/local-playwright`, familiar
settings files, and port substrings are not cleanup authority.

If the spawned Playwright root process did not have a verified `/proc` start
identity when the tracker was created, the tracker remains unverified for the
rest of the run. Later process-table scans must not create a root ownership
record from the numeric PID, discover apparent descendants from that PID, or use
matching command text, repository paths, ports, liveness, or later identity
lookups as substitute proof. Discovery and cleanup report
`root-identity-unverified`; automatic cleanup sends no SIGTERM or SIGKILL for
that root or apparent children. This fail-closed path is distinct from a root
whose original identity was verified and then exited or changed.

Before sending SIGTERM, cleanup revalidates that the PID still has the recorded
start identity. After the grace period, SIGKILL is considered only for records
that were sent SIGTERM and still revalidate. Already-exited processes, changed
or reused PIDs, permission-denied metadata, unreadable metadata, and duplicate
cleanup calls are recorded separately and skipped or reported without broadening
the target set. On platforms where process identity cannot be verified, the
launcher must leave uncertain leftovers alone and report the limitation. The
launcher preserves the Playwright exit code and logs before cleanup, and it must
not target unrelated developer listeners such as a normal app on 3000/3001/3002.

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
- Minimal PWA metadata, manifest response/content type, `/games` manifest launch
  route, app icon responses and dimensions, and absence of service worker
  registration.
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
- Public fixture browsing for upcoming, past, and detail views.
- Platform-admin fixture create, publish, and cancel workflow.
- Draft fixture prediction-question configuration workflow for optional
  standard toggles/deductions, Number and Choice custom questions, reordering,
  validation feedback, save/revisit persistence, projected player step count,
  conflict
  preservation, and explicit reload.
- Published and cancelled fixture question configuration read-only display.
- Public and admin fixture pagination controls.
- Admin fixture edit-session regressions for stale revisions after reactive
  updates, conflict value preservation, explicit reload-and-replace behavior,
  pagination clearing edit state and form values together, and edited fixtures
  leaving the visible page without falling through to draft creation.
- Prediction entry return-path support, standard Intro/progress/navigation,
  answer preservation through Back/Continue, stable step copy during navigation,
  running predicted rugby score updates, conversion maximums and clamping,
  result/score consistency warnings after drop goals, disabled Continue while a
  known result/score inconsistency remains, first-try constraints, ruleset-aware
  Review hiding for disabled card/optional questions, valid submit and
  saved-entry Review revisit, Review Edit and Return to Review, edit before
  kickoff, clean-state disabled `Discard changes`, dirty built-in and custom
  answer discard confirmation, discard without revision writes, persisted locked
  saved-entry display after dirty local edits, and stale revision conflict value
  preservation plus explicit latest-saved loading. CCPP-009A keeps those
  Standard scenarios focused on the shared session contract after extraction.
- Result administration provisional save, blank-versus-zero restoration, derived
  rugby score display, custom Number observed values beyond prediction range,
  custom Choice Void, final confirmation read-only summary, and result conflict
  preservation plus explicit latest-result reload.
- Cancelled fixture with existing provisional result remaining accessible to an
  authorised admin as a read-only provisional summary without confirmed-result
  wording or mutation controls.
- Kaplay Match Result preview coverage in
  `tests/e2e/kaplay-prediction-preview.spec.ts`: cold Standard-only visits do
  not import Kaplay, Intro stays Standard, a fresh development preference opens
  real Kaplay automatically at Match Result without `enabled:true`, real Kaplay
  canvas choice selection updates shared session state, Off/On switching
  preserves the answer, Continue hands off to the next Standard step, reduced
  motion stops automatic activation, delayed initialization can be cancelled,
  runtime callback failure and graphics-context loss fall back to Standard,
  keyboard selection works through the DOM bridge, legacy development
  `enabled:false` no longer blocks supported UI access, and a dirty
  saved-prediction scenario with custom Number and Choice answers exercises
  saved-entry revisit, same-session runtime failure, dirty answer preservation,
  and explicit revised save. Isolated fault-injection controls still require
  the explicit `testControls: true` test setting and are not inferred from
  development mode or Animations On. CCPP-009B3 records the
  isolated-script-delivery evidence and current pass/fail history for that
  focused file.
- CCPP-009C adds `tests/unit/match-result-motion.test.ts` for prepared atlas
  metadata, visual anchors, layout projection, shove phase timing, exit
  projection, and effect cancellation. It also adds a focused host regression
  proving selection/focus/rerender updates flow through runtime snapshot updates
  without recreating the ready runtime until the attempt actually ends.
  Browser paths distinguish canvas pointer input, keyboard accessibility input,
  and visible Standard radio input.
- CCPP-009C1 extends the Match Result motion tests for contact-to-push
  continuity, nondecreasing Rooster/rejected-card movement, stable hand/group
  contact, full transformed Rooster exit, rejected-group exit, compact
  360/390-style displayed text and target sizes, long-name wrapping, selected
  and rejected bounds separation, and projected hit testing. The browser spec
  was also updated to use the runtime's actual projected choice rectangles,
  finalized canvas recording blobs, 360/390 mobile measurement evidence, and an
  Off-during-motion Standard preservation scenario. The bounded 009C1 browser
  launches on 2026-09-18 both exited before Playwright executed test cases, so
  they produced no successful browser coverage, screenshots, recordings, or
  mobile measurement JSON.
- CCPP-009C2 extends the compact-layout projection so the Match Result stage
  height is content-driven and the React canvas uses the projected stage aspect
  ratio. Its retained focused browser evidence on 2026-09-18 includes normal
  and slowed Match Result playback WebMs, contact sheets, desktop screenshots,
  360/390 mobile screenshots and crops, and mobile measurement JSON. The
  recorded focused browser result remains `7 passed / 1 failed`: the failed
  dirty saved-session case reached the selected-answer presentation and tried a
  canvas choice before using the visible `Change my selection` action. The test
  precondition was corrected after the run and was not rerun.
- CCPP-009C3 adds resize-coordinate synchronization coverage for the Kaplay
  Match Result surface. Focused unit/component coverage verifies
  desktop-to-compact-to-desktop runtime replacement, compact-to-compact updates
  without replacement, ordinary snapshot updates without replacement, stale
  replacement isolation, Off/unmount-safe cancellation, late first measurement,
  and selected-answer preservation when resize interrupts motion. The fresh
  focused browser run on 2026-09-19 executed nine cases with `7 passed / 2
failed`; the corrected dirty saved-session case passed. The new resize journey
  timed out before producing its four-point measurement JSON, and the
  reduced-motion/mobile evidence path fell back to Standard before a post-run
  measurement-deferral correction could be rerun. Browser resize acceptance
  remains pending a future focused rerun. See
  `docs/AUDIT_009C3_Resize_Interaction_Verification.md`.
- CCPP-009C3A adds focused host/adapter regressions for fresh post-ready
  replacement deadlines, stalled replacement fallback, obsolete pre-allocation
  generation rejection, already-initializing supersession cleanup, and
  non-refreshing replacement timers. The affected unit/component run passed 58
  tests. Two permitted current-source focused browser batches both executed
  nine Kaplay cases with `7 passed / 2 failed`: the corrected dirty
  saved-session case passed, while resize and reduced-motion remained
  unresolved. The browser evidence is preserved under
  `/tmp/rugby-rooster-ccpp009c3a-browser-20260919` and
  `/tmp/rugby-rooster-ccpp009c3a-browser-correction-20260919`.

CCPP-009B2 adds test-only isolation for the Meteor HMR WebSocket in the Kaplay
preview spec. The WebSocket route predicate is limited to the exact path
`/__meteor__hmr__/websocket`; it must not intercept DDP/SockJS application
traffic, prediction requests, all WebSockets, or broad development-server
traffic. This HMR-isolated run is not proof that ordinary development hot reload
preserves unsaved in-memory answers.

The Kaplay preview spec may retry bounded transient navigation/setup readiness
only inside explicit initial setup or revisit helpers, before protected dirty
session preservation begins. After unsaved edits are made and the dirty segment
is armed, tests must not hide a document replacement behind automatic `goto`,
reload, relogin, or fixture rebuild steps. Unexpected full document navigation
in that segment is a failure and should be preserved as evidence. React
session-owner remounts should be distinguished from full document navigation.

Prediction browser tests use `test.predictions.currentUserEntry` only under the
existing isolated-test helper gate to observe the signed-in current user's saved
entry revision and prediction payload. It is not registered in production and
does not expose private session state through a client global.

Fixture browser setup creates a verified current-run admin with the existing
test auth helpers and signs in with the isolated-only
`test.auth.loginTokenForEmail` helper. This avoids repeatedly exercising the
deferred CCPP-004D passwordless navigation issue while leaving production
authorization unchanged.

Fixture browser tests use unique labels and sort-position-specific kickoff times
for pagination scenarios. Public pagination tests use recent-past fixtures so
older local test residue does not occupy the first past page; admin pagination
tests use far-future fixtures so older local residue does not hide current-run
admin rows.

Failure diagnostics:

- Playwright retains traces, screenshots, and videos on failure.
- Generated artifacts under `test-results/` and `playwright-report/` are ignored by Git.
- Raw traces can contain session material. Preserve originals privately and
  package only sanitized excerpts or summaries when preparing review archives.

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
- Fixture admin mutation authorization, injection rejection, create/edit/publish
  /cancel behavior, revision conflict handling, repeated state calls, public
  and admin cursor pagination, public draft exclusion, public field projection,
  ruleset snapshot independence, fixture revision backfill, invalid default
  ruleset rejection, and admin fixture publication authorization.
- Fixture question configuration authorization, admin-only read projection,
  draft-only mutation, revision conflicts, core-question injection rejection,
  standard/custom publication snapshots, invalid custom publication rejection,
  and legacy draft default derivation.
- Prediction mutation authorization, owner-only publication boundaries, draft /
  cancelled / missing / snapshotless fixture rejection, stored-snapshot
  validation, strict before/equal/after kickoff boundaries with a controlled
  clock, custom answer persistence/injection rejection, concurrent first
  submissions, stale revisions, server-owned field injection rejection, and
  locked saved-entry readability.
- Result admin authorization, published/non-cancelled fixture eligibility,
  partial provisional saves, Pending versus zero storage, duplicate first-result
  creation conflict, stale result revisions, server-owned field injection
  rejection, disabled/unknown observation rejection, custom Void final
  confirmation, final read-only enforcement, and admin-only result
  publications.

The Meteor full-app test module is `imports/server/app-tests.ts`, which imports
the existing auth, fixture, prediction, and match result integration suites.

Future Meteor/database integration tests must cover:

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
- The CCPP-004D auth browser navigation instability is not resolved by
  CCPP-004E foundation/PWA checks. The condensed deferral note is
  `docs/TEMP_004D_Known_Navigation_Issue.md`.
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
