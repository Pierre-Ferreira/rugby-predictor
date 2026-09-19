# Rugby Rooster System Map

## Documentation Index

- `README.md` - project overview, routes, and commands.
- `AGENTS.md` - future-agent operating instructions.
- `docs/CORE_Product.md` - product identity, agreed direction, and unresolved decisions.
- `docs/CORE_Build_Plan.md` - milestone roadmap and CCPP scope boundaries.
- `docs/CORE_Scoring_Rules.md` - authoritative CCPP-003 scoring rules, validation rules, live/final scoring policy, worked examples, and unresolved scoring-adjacent policies.
- `docs/CORE_Fixtures.md` - CCPP-005 fixture user behavior, state transitions, timezone policy, public browsing, and deferred fixture features.
- `docs/CORE_Predictions.md` - CCPP-006 prediction player flow, supported fields, persisted saved-entry locking behavior, conflict/reload behavior, account switching, and future prediction presentation architecture.
- `docs/CORE_Prediction_Questions.md` - CCPP-008 prediction question groups,
  custom question product rules, freeze-before-predictions principle,
  settlement/Void semantics, and unresolved balancing policy.
- `docs/CORE_Match_Results.md` - CCPP-008B admin match-result lifecycle,
  Pending versus zero, built-in and custom settlement semantics, custom Void,
  final immutability, unresolved card/extra-time conventions, and out-of-scope
  scoring/leaderboard work.
- `docs/PLATFORM_Architecture.md` - architecture, boundaries, dependencies, and security posture.
- `docs/PLATFORM_Authentication.md` - passwordless account, email-link, settings, mail capture, and authorisation architecture.
- `docs/PLATFORM_Email.md` - email delivery configuration, Postmark adapter choice, local development settings, and manual verification steps.
- `docs/PLATFORM_PWA.md` - minimal PWA manifest, icons, safe-area shell, installation notes, limitations, and verification guidance.
- `docs/PLATFORM_Scoring_Engine.md` - pure TypeScript scoring engine module map, API summary, snapshot policy, representative output, and future integration responsibilities.
- `docs/PLATFORM_Fixtures.md` - fixture schema, methods, publications, indexes, authorization, query limits, and ruleset snapshot storage.
- `docs/PLATFORM_Predictions.md` - prediction schema, methods, publications, indexes, ownership, revision behavior, route, locked display state source, and future presentation architecture.
- `docs/PLATFORM_Prediction_Session.md` - CCPP-009A shared prediction
  session ownership, lifecycle, renderer-facing state/actions, React
  presentation host, superseded Kaplay adapter boundary,
  revision/submission/discard handling, and renderer-local state.
- `docs/PLATFORM_React_Prediction_Experience.md` - CCPP-010A/010A1 active
  React-first prediction controls, optional browser animation, Match Result
  selected-only settled behavior, Tries presentation contracts, and superseded
  Kaplay status.
- `docs/PLATFORM_Kaplay_Predictions.md` - CCPP-009B/009B4 development/test
  Kaplay prediction availability, lazy runtime, effective-mode policy,
  one-screen Match Result support, fallback, cleanup, accessibility bridge,
  limitations, and CCPP-010A superseded-route status.
- `docs/PLATFORM_Match_Results.md` - match result schema, unique fixture
  relationship, observation normalization, methods/publications, authorization,
  revision handling, final confirmation, and custom Void scoring preparation.
- `docs/PLATFORM_Prediction_Sequence.md` - CCPP-007 standard prediction
  sequence/message architecture, active-step navigation, dynamic custom
  question steps, and Review edit destinations.
- `docs/PLATFORM_Prediction_Question_Configuration.md` - CCPP-008 fixture
  question configuration storage, validation, authorization, revision,
  snapshot, and custom publication architecture.
- `docs/PLATFORM_Testing.md` - static checks, unit tests, browser tests, CI, and integration-test boundaries.
- `docs/MAP_System.md` - this map.
- `docs/MAP_Rooster_Assets.md` - CCPP-009A current repository Rooster/app icon
  asset inventory, missing runtime animation asset requirements, and the
  CCPP-009C supplied-art availability blocker.
- `docs/AUDIT_001_Project_Foundation.md` - CCPP-001 completion evidence.
- `docs/AUDIT_002_Testing_Infrastructure.md` - CCPP-002 completion evidence.
- `docs/AUDIT_003_Scoring_Engine.md` - CCPP-003 completion evidence.
- `docs/AUDIT_003A_Scoring_Validation_Corrections.md` - CCPP-003A validation correction evidence.
- `docs/AUDIT_004_Passwordless_Accounts_Authorisation.md` - CCPP-004 completion evidence.
- `docs/AUDIT_004A_Completion.md` - CCPP-004A final reconciliation and completion evidence.
- `docs/AUDIT_004B_Development_Email.md` - CCPP-004B Postmark development email configuration and verification evidence.
- `docs/AUDIT_004C_Development_Admin.md` - CCPP-004C local development admin provisioning setup and manual verification procedure.
- `docs/AUDIT_004D_Admin_Sign_In.md` - CCPP-004D admin-specific passwordless sign-in behaviour, eligibility checks, bypass protection, and verification evidence.
- `docs/AUDIT_004D_Login_Credential_Correction.md` - CCPP-004D follow-up for sanitized email-link credential retention during same-tab reload.
- `docs/AUDIT_004D_Same_Account_Link_Invalidation.md` - CCPP-004D follow-up changing same-account continuation to explicitly invalidate the presented passwordless link.
- `docs/AUDIT_004E_PWA_Foundation.md` - CCPP-004E minimal PWA foundation, verification evidence, limitations, and EOMD archive note.
- `docs/AUDIT_005_Fixture_Management.md` - CCPP-005 fixture management and public browsing implementation and verification evidence.
- `docs/AUDIT_005A_Fixture_Pagination_And_Concurrency.md` - CCPP-005A fixture pagination and revision-concurrency correction evidence.
- `docs/AUDIT_005B_Fixture_Edit_Session.md` - CCPP-005B admin fixture edit-session identity, conflict, reload, and accidental-create correction evidence.
- `docs/AUDIT_006_Prediction_Submission.md` - CCPP-006 prediction entry, submission, validation, ownership, locking, and verification evidence.
- `docs/AUDIT_006A_Locked_Prediction_Display.md` - CCPP-006A locked saved-entry display correction, prediction presentation architecture clarification, and verification evidence.
- `docs/AUDIT_006B_Prediction_UI_Refinement.md` - CCPP-006B prediction UI team-name terminology, derived predicted rugby score review, conversion-bound behavior, and verification evidence.
- `docs/AUDIT_007_Standard_Sequential_Predictions.md` - CCPP-007 standard
  sequential prediction experience, shared sequence/message architecture, tests,
  unresolved product questions, and review archive evidence.
- `docs/AUDIT_007A_Ruleset_Aware_Prediction_Cleanup.md` - CCPP-007A
  ruleset-aware prediction copy, Review cleanup, result-consistency navigation,
  tests, and review archive evidence.
- `docs/AUDIT_008_Fixture_Question_Configuration.md` - CCPP-008 fixture
  question configuration implementation, validation, authorization, revision,
  snapshot, publish-gate, and verification evidence.
- `docs/AUDIT_008A_Custom_Questions_Standard_Sequence.md` - CCPP-008A custom
  questions in the Standard prediction sequence, snapshot validation,
  publish-gate removal, and verification evidence.
- `docs/AUDIT_008B_Match_Results_Settlement.md` - CCPP-008B match-result and
  prediction-question settlement implementation, tests, unresolved questions,
  and review archive evidence.
- `docs/AUDIT_009A_Shared_Prediction_Session.md` - CCPP-009A shared
  prediction session and renderer contract implementation, tests, asset
  inventory, limitations, and review archive evidence.
- `docs/AUDIT_009A1_Session_Lifecycle_Guards.md` - CCPP-009A1 shared session
  lifecycle guards, command guards, stale-response isolation, tests, and review
  archive evidence.
- `docs/AUDIT_009B_Kaplay_Runtime_Fallback.md` - CCPP-009B Kaplay runtime,
  mode switching, safe fallback, one-screen Match Result preview, tests,
  limitations, and review archive evidence.
- `docs/AUDIT_009B1_Initialization_Recovery_Storage.md` - CCPP-009B1 safe
  storage acquisition, host-owned preview initialization/retry, late-handle
  disposal, dirty-session preservation evidence, verification, limitations, and
  review archive evidence.
- `docs/AUDIT_009B2_Runtime_Adoption_Reload_Diagnosis.md` - CCPP-009B2 runtime
  update fallback corrections, HMR/navigation test-boundary review, preserved
  browser failure evidence, verification, limitations, and review archive
  evidence.
- `docs/AUDIT_009B3_Isolated_Script_Delivery.md` - CCPP-009B3 isolated
  script-delivery evidence, saved-entry revisit readiness correction, launcher
  cleanup, verification, limitations, and review archive evidence.
- `docs/AUDIT_009B3A_Save_Baseline_Process_Cleanup.md` - CCPP-009B3A
  saved-baseline correctness, publication-lag discard behavior, verified
  process-cleanup ownership, verification, limitations, and review archive
  evidence.
- `docs/AUDIT_009C_Visual_Foundation_Rooster_Shove.md` - CCPP-009C
  supplied-art availability blocker, inspected files, and next action.
- `docs/AUDIT_009C1_Shove_Exit_Mobile_Evidence.md` - CCPP-009C1
  contact-to-push continuity, full-character exit, compact readability
  correction, verification, blocked browser evidence, and review archive
  evidence.
- `docs/AUDIT_009C2_Compact_Layout_Playback.md` - CCPP-009C2 content-driven
  compact stage layout, fresh retained playback/mobile evidence, recorded
  `7 passed / 1 failed` browser result, unrerun dirty-session test
  precondition correction, static closeout checks, and review archive evidence.
- `docs/AUDIT_009C3_Resize_Interaction_Verification.md` - CCPP-009C3
  resize-coordinate synchronization implementation, installed Kaplay API
  findings, focused unit/component checks, fresh `7 passed / 2 failed` browser
  evidence, corrected dirty-session pass, unresolved resize browser acceptance,
  and review archive evidence.
- `docs/AUDIT_009C3A_Bounded_Resize_Runtime_Closeout.md` - CCPP-009C3A
  bounded post-ready replacement implementation, runtime-generation ownership,
  focused unit/type/browser evidence, unresolved resize and reduced-motion
  browser blockers, and review archive evidence.
- `docs/AUDIT_009C3B_Evidence_Capture_Confirmed_Teardown.md` - CCPP-009C3B
  selected-value evidence helper correction, confirmed Kaplay cleanup teardown
  semantics, retained `8 passed / 1 failed` browser evidence, unresolved
  resize failure, and review archive evidence.
- `docs/AUDIT_010A_Shared_React_Presentation.md` - CCPP-010A React-first Match
  Result and Tries implementation, retained browser evidence, final
  verification, superseded Kaplay status, and review archive evidence.
- `docs/AUDIT_010A1_Match_Result_Polish.md` - CCPP-010A1 Match Result copy,
  selected-only settled behavior, complete normal-speed shove evidence,
  verification, and review archive evidence.
- `docs/AUDIT_010A2_Match_Result_Motion_Refinement.md` - CCPP-010A2 slower
  Match Result shove timing, selected-card rise treatment, `YOU SELECTED:` hero
  settled state, responsive evidence, verification, and review archive
  evidence.
- `docs/AUDIT_004A_Login_Navigation_Fix.md` - historical CCPP-004A login-navigation and test-stability checkpoint.
- `docs/AUDIT_004A_Throttle_Correction.md` - historical CCPP-004A throttle correction checkpoint.
- `docs/AUDIT_004A_Database_Isolation_Verification.md` - historical CCPP-004A database isolation checkpoint that preserved an unresolved runtime-verification blocker.
- `docs/AUDIT_004A_Database_Verification_Closure.md` - historical CCPP-004A database verification closure attempt and topology blocker.
- `docs/AUDIT_004A_Database_Topology_Correction.md` - historical CCPP-004A topology correction evidence.
- `docs/AUDIT_004A_HMR_Workaround_Resolution.md` - historical CCPP-004A evidence for removing the client `Meteor.isTest` override and verifying auth browser tests with normal client identity.
- `docs/TEMP_004A_Resume.md` - historical CCPP-004A resume checkpoint retained for provenance; superseded by `docs/AUDIT_004A_Completion.md`.
- `docs/TEMP_004D_Known_Navigation_Issue.md` - temporary CCPP-004D deferral note for the unresolved full auth browser suite navigation issue.
- `docs/TEMP_004D_Resume.md` - temporary CCPP-004D checkpoint for the remaining full auth browser suite instability.
- `docs/TEMP_004E_Resume.md` - temporary CCPP-004E checkpoint created before final PWA foundation verification.
- `docs/TEMP_005_Resume.md` - temporary CCPP-005 checkpoint before final static verification and EOMD packaging.
- `docs/TEMP_006_Resume.md` - temporary CCPP-006 checkpoint before EOMD packaging.
- `docs/TEMP_006A_Resume.md` - temporary CCPP-006A checkpoint for locked saved-entry display correction and documentation clarification.
- `docs/TEMP_006B_Resume.md` - temporary CCPP-006B checkpoint for prediction UI correctness and terminology refinement.
- `docs/TEMP_007_Resume.md` - temporary CCPP-007 checkpoint for standard
  sequential predictions and final packaging handoff.
- `docs/TEMP_007A_Resume.md` - temporary CCPP-007A checkpoint for ruleset-aware
  prediction cleanup and final packaging handoff.
- `docs/TEMP_008_Resume.md` - temporary CCPP-008 checkpoint for fixture
  prediction question configuration and packaging handoff.
- `docs/TEMP_008A_Resume.md` - temporary CCPP-008A checkpoint for custom
  questions in the Standard prediction sequence and final packaging handoff.
- `docs/TEMP_008B_Resume.md` - temporary CCPP-008B checkpoint for match-result
  settlement and final packaging handoff.
- `docs/TEMP_009A_Resume.md` - temporary CCPP-009A checkpoint for shared
  prediction session extraction, Standard wiring, tests, docs, and packaging.
- `docs/TEMP_009A1_Resume.md` - temporary CCPP-009A1 checkpoint for session
  lifecycle guard verification.
- `docs/TEMP_009B_Resume.md` - temporary CCPP-009B checkpoint for Kaplay
  runtime, fallback, verification, documentation, and packaging.
- `docs/TEMP_009B1_Resume.md` - temporary CCPP-009B1 checkpoint for
  initialization recovery, storage safety, verification, documentation, and
  packaging.
- `docs/TEMP_009B2_Resume.md` - temporary CCPP-009B2 checkpoint for runtime
  adoption fallback, reload diagnosis, evidence preservation, verification,
  documentation, and packaging.
- `docs/TEMP_009B3_Resume.md` - temporary CCPP-009B3 checkpoint for isolated
  script-delivery evidence, saved-entry revisit diagnosis, verification,
  documentation, and packaging.
- `docs/TEMP_009B3A_Resume.md` - temporary CCPP-009B3A checkpoint for
  save-baseline correctness, safe process cleanup, verification, documentation,
  and packaging.
- `docs/TEMP_009C_Resume.md` - temporary CCPP-009C checkpoint for the
  supplied-art availability blocker before visual foundation implementation.
- `docs/TEMP_009C1_Resume.md` - temporary CCPP-009C1 checkpoint for shove
  continuity, full exit, mobile readability, browser evidence attempts, and
  packaging handoff.
- `docs/TEMP_009C2_Resume.md` - temporary CCPP-009C2 closeout checkpoint for
  compact layout playback evidence, dirty-session test precondition correction,
  verification, and packaging handoff.
- `docs/TEMP_009C3_Resume.md` - temporary CCPP-009C3 checkpoint for resize
  synchronization, focused checks, browser evidence, documentation, and
  packaging handoff.
- `docs/TEMP_009C3A_Resume.md` - temporary CCPP-009C3A checkpoint for bounded
  resize runtime replacement, browser budget tracking, verification evidence,
  unresolved blockers, documentation, and packaging handoff.
- `docs/TEMP_009C3B_Resume.md` - temporary CCPP-009C3B checkpoint for
  evidence-helper correction, confirmed teardown, retained browser results,
  static closeout checks, and packaging handoff.
- `docs/TEMP_010A_Resume.md` - temporary CCPP-010A checkpoint for the
  React-first Match Result and Tries closeout, evidence review, verification,
  documentation, and packaging handoff.
- `docs/TEMP_010A1_Resume.md` - temporary CCPP-010A1 checkpoint for Match
  Result copy/settled-state polish, complete shove evidence, verification, and
  packaging handoff.
- `docs/TEMP_010A2_Resume.md` - temporary CCPP-010A2 checkpoint for Match
  Result motion timing, selected-card rise, settled hero treatment, evidence,
  verification, and packaging handoff.

## Application Entry Points

- `client/main.html` - HTML shell and document title.
- `client/main.tsx` - React startup and CSS import.
- `client/main.css` - Tailwind directives, design tokens, focus styles, and PWA safe-area shell classes.
- `server/main.ts` - Meteor server startup plus auth, fixture, match result, prediction, and PWA server-module imports.
- `imports/api/fixtures/collection.ts` - shared Meteor fixture collection.
- `imports/api/matchResults/collection.ts` - shared Meteor match result collection.
- `imports/api/predictions/collection.ts` - shared Meteor prediction collection.
- `imports/server/fixtures/` - fixture methods, publications, indexes, ruleset snapshot attachment, and isolated fixture test helpers.
- `imports/server/matchResults/` - result methods, admin publications,
  unique fixture index, revision handling, final confirmation, and isolated
  result test helper.
- `imports/server/predictions/` - prediction submit method, private publications, indexes, and isolated prediction test helper.
- `imports/server/pwa/server.ts` - manifest content-type hook for `/site.webmanifest`.
- `public/site.webmanifest` - minimal PWA manifest that launches at `/games`.
- `public/icons/` - temporary RR monogram PNG app icons and SVG source assets.

## Routes

- `/` - `imports/ui/pages/HomePage.tsx` in the public layout.
- `/games` - `imports/ui/pages/GamesPage.tsx` in the public layout for published fixture browsing.
- `/games/:fixtureId` - `imports/ui/pages/GameDetailPage.tsx` in the public layout for published fixture details.
- `/games/:fixtureId/predict` - `imports/ui/pages/PredictionEntryPage.tsx` in the public layout for player prediction entry and saved-entry revisit.
- `/sign-in` - `imports/ui/pages/SignInPage.tsx` in the public layout, including the admin-specific `mode=admin` request mode used from `/admin`.
- `/auth/email-link` - `imports/ui/pages/AuthEmailLinkPage.tsx` in the public layout.
- `/account` - `imports/ui/pages/AccountPage.tsx` in the public layout.
- `/admin` - `imports/ui/pages/AdminPage.tsx` in the admin layout with server-authorised summary data.
- `/admin/fixtures/:fixtureId/results` - `imports/ui/pages/AdminFixtureResultsPage.tsx` in the admin layout for result entry, final confirmation, and read-only result summary.
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

## Match Result Entry Points

- `imports/shared/matchResults/` - result method/publication names, persistence
  types, lifecycle labels, revision constants, observation normalization, and
  final completeness validation.
- `imports/api/matchResults/collection.ts` - shared `match_results` Mongo collection.
- `imports/server/matchResults/server.ts` - result save/confirm methods,
  fixture eligibility checks, admin-only publications, denied client writes, and
  indexes.
- `imports/server/matchResults/testSupport.ts` - isolated result test reset helper.
- `imports/ui/pages/AdminFixtureResultsPage.tsx` - admin result entry, derived
  rugby score display, custom settlement/Void UI, final confirmation, read-only
  final summary, and result conflict reload.

## Fixture Entry Points

- `imports/shared/fixtures/` - fixture method/publication names, domain types, validation, and timezone conversion helpers.
- `imports/api/fixtures/collection.ts` - shared `fixtures` Mongo collection.
- `imports/server/fixtures/server.ts` - fixture methods, cursor publications, indexes, revision backfill, and write-path protections.
- `imports/server/fixtures/ruleset.ts` - default ruleset snapshot creation for fixture publication.
- `imports/server/fixtures/testSupport.ts` - isolated fixture test helpers,
  including test-only disabled built-in question snapshots for prediction
  browser coverage.
- `imports/ui/fixtures/AdminFixtureManager.tsx` - admin fixture form, paginated list, publish, cancel, and prediction-question entry-point UI.
- `imports/ui/fixtures/AdminFixtureQuestionConfigurator.tsx` - CCPP-008 admin
  question configuration editor for core visibility, optional standard
  configuration, custom Number/Choice questions, revision conflicts, reload, and
  read-only published/cancelled display.
- `imports/ui/fixtures/fixtureUi.ts` - shared fixture UI labels and paths.

## Prediction Entry Points

- `imports/shared/predictions/` - prediction method/publication names, domain types, submission validation, and storage normalization.
- `imports/shared/predictionQuestions/` - CCPP-008 fixture prediction question
  configuration types, constants, validation, normalization, legacy defaults,
  and ruleset snapshot projection.
- `imports/shared/predictions/sequence.ts` - CCPP-007/008A prediction sequence
  definitions, dynamic custom step projection, and active navigation helpers.
- `imports/shared/predictions/messages.ts` - CCPP-007/007A shared prediction
  message catalog, variant selection, interpolation, ruleset-derived
  enabled-question deduction text, and Intro starting-points copy.
- `imports/api/predictions/collection.ts` - shared `predictions` Mongo collection.
- `imports/server/predictions/server.ts` - prediction submission method, fixture eligibility checks, private publications, denied client writes, and indexes.
- `imports/server/predictions/testSupport.ts` - isolated prediction test reset
  and signed-in current-entry observation helpers.
- `imports/ui/predictions/predictionSession.ts` - CCPP-009A/009A1 editable
  prediction session owner, renderer-facing state/actions, navigation and
  read-only command guards, message variant ownership, revision capture,
  discard/conflict handling, symmetrical mounted-owner lifecycle, and duplicate
  submission guard.
- `imports/ui/predictions/standardPredictionState.ts` - CCPP-007 standard
  prediction form state helpers, score derivation adapters, result consistency,
  and first-try constraints.
- `imports/ui/predictions/PredictionPresentationHost.tsx` - CCPP-009B/009B1
  historical Standard/Kaplay preview selection host; after CCPP-010A it owns
  only Animations preference, reduced-motion observation, and React
  presentation options.
- `imports/ui/predictions/reactPredictionPresentation.tsx` - CCPP-010A/010A1
  React-first Match Result and Tries controls with optional decorative browser
  animation, selected-only Match Result settled state, and Change restoration.
- `imports/ui/predictions/presentationMode.ts` - CCPP-009B/009B4 development
  availability, isolated test-control setting, supported-step, and
  effective-mode policy helpers.
- `imports/ui/predictions/presentationPreference.ts` - CCPP-009B/009B1/009B4
  resilient browser-storage preference helper for Animations On/Off, including
  protected `window.localStorage` acquisition and default On for unset/invalid
  development preferences.
- `imports/ui/predictions/reducedMotion.ts` - CCPP-009B reduced-motion media
  query helper.
- `imports/ui/predictions/kaplay/` - CCPP-009B/009B1 lazy Kaplay Match Result
  preview component, host attempt controller contract, runtime adapter, and
  CCPP-009C rooster shove motion/manifest helpers, including CCPP-009C3
  measured-viewport runtime replacement, pointer transform handling, and
  CCPP-009C3B installed-cleanup confirmation; superseded for active prediction
  controls by CCPP-010A.
- `imports/ui/pages/PredictionEntryPage.tsx` - guided sequential prediction
  route host, shared session host, React presentation host, Intro, numbered
  steps, Review/Edit UI, and read-only locked-entry UI that presents persisted
  entry data.

## Verification Entry Points

- `eslint.config.mjs` - ESLint flat config for TypeScript syntax, React, hooks, JSX accessibility, JavaScript, and config files.
- `prettier.config.cjs` - Prettier formatting settings.
- `.prettierignore` - generated and dependency paths excluded from formatting.
- `vitest.config.mts` - unit-test configuration, including CCPP-009B OXC JSX
  transform settings for React component tests.
- `playwright.config.ts` - browser-test configuration with local Meteor web server management.
- `rspack.config.ts` - Meteor Rspack configuration, TypeScript checker plugin, local dev-server host settings, and isolated-E2E Rspack HMR/live-reload suppression gate.
- `.github/workflows/verification.yml` - GitHub Actions verification workflow.
- `scripts/check-project-invariants.mjs` - durable Rugby Rooster project-invariant checks.
- `scripts/test-environment.mjs` - isolated local test environment builder and
  verified process-ownership helpers shared by integration and Playwright
  launchers.
- `scripts/run-integration-tests.mjs` - Meteor full-app integration-test launcher with loopback binding and inherited Mongo variable rejection.
- `scripts/run-playwright-tests.mjs` - Playwright launcher with isolated test
  run IDs, Meteor-managed local test environment variables, optional evidence
  capture, and bounded cleanup for recorded current-run child processes.
- `tests/unit/routes.test.ts` - route resolution unit tests.
- `tests/unit/auth-helpers.test.ts` - auth helper unit tests.
- `tests/unit/auth-config.test.ts` - auth runtime configuration tests.
- `tests/unit/postmark-email.test.ts` - Postmark email adapter unit tests.
- `tests/unit/test-database-identity.test.ts` - isolated test MongoDB endpoint/database identity comparison tests.
- `tests/unit/test-launchers.test.ts` - isolated test launcher environment and
  process-ownership selection/signalling tests.
- `tests/unit/playwright-target.test.ts` - regression tests for safe browser-test target resolution.
- `tests/unit/scoring-engine.test.ts` - CCPP-003 scoring-engine unit tests.
- `tests/unit/fixtures.test.ts` - fixture validation, pagination option, revision, and timezone unit tests.
- `tests/unit/predictions.test.ts` - prediction submission validation, internal
  team-side value, and bypassed invalid conversion unit tests.
- `tests/unit/prediction-sequence.test.ts` - CCPP-007/007A/008A standard
  sequence, custom step ordering, message catalog, ruleset-aware copy, and
  state-helper unit tests.
- `tests/unit/prediction-session.test.ts` - CCPP-009A/009A1 shared prediction
  session reducer/derivation contract, read-only guard, discard/reload guard,
  revision-aware saved-baseline preservation, duplicate submit state, and stale
  response isolation tests.
- `tests/unit/prediction-session-hook.test.ts` - CCPP-009A1 React DOM
  `usePredictionSession(...)` lifecycle, Strict Mode effect replay,
  presentation replacement, duplicate transport, read-only context update, and
  disposed-owner stale completion tests, including CCPP-009B3A controlled
  transport saved-baseline regressions.
- `tests/unit/prediction-presentation-mode.test.ts` - historical CCPP-009B
  preview effective-mode tests plus current animation preference and
  reduced-motion helper tests.
- `tests/unit/prediction-presentation-host.test.ts` - CCPP-010A React DOM
  presentation-host, Match Result, and Tries presentation tests, including
  shared action dispatch, animation Off/reduced-motion parity, resize
  cancellation, harmless sprite-load cancellation, numeric blank/zero handling,
  conversion clamping delegation, and rapid numeric changes.
- `tests/unit/match-result-motion.test.ts` - CCPP-009C Match Result layout and
  shove-motion unit coverage, including compact readability, projected bounds,
  hit testing, and resize-preservation checks.
- `tests/unit/match-result-runtime.test.ts` - CCPP-009C3B controlled Kaplay
  runtime adapter tests for installed cleanup notification semantics and
  cancellation cleanup paths.
- `tests/unit/prediction-questions.test.ts` - CCPP-008 prediction question
  configuration validation and optional standard snapshot projection tests.
- `imports/server/app-tests.ts` - Meteor full-app test entry importing auth,
  fixture, match result, and prediction integration suites.
- `imports/server/auth/passwordless.app-test.ts` - Meteor full-app auth integration tests.
- `imports/server/fixtures/fixtures.app-test.ts` - Meteor full-app fixture integration tests for admin methods, cursor publications, revisions, backfill, and ruleset snapshots.
- `imports/server/predictions/predictions.app-test.ts` - Meteor full-app prediction integration tests for authorization, ownership, snapshot validation, kickoff locking, concurrent creation, stale revisions, field injection, and locked readability.
- `imports/server/matchResults/matchResults.app-test.ts` - Meteor full-app
  result integration tests for authorization, fixture eligibility, provisional
  saves, Pending versus zero, duplicate first creation, stale revisions, field
  injection, final confirmation, custom Void, read-only final results, and
  admin-only publications.
- `tests/e2e/foundation.spec.ts` - browser smoke tests for current foundation routes, layouts, CCPP-004E PWA metadata, manifest/icon responses and dimensions, `/games` launch behaviour, responsive overflow, and absence of service worker registration.
- `tests/e2e/auth.spec.ts` - browser tests for passwordless account and admin access flows.
- `tests/e2e/fixtures.spec.ts` - browser tests for public fixture browsing,
  public/admin pagination controls, admin fixture create/publish/cancel
  workflow, fixture question configuration, projected player step count,
  conflict reload, and published/cancelled question read-only display.
- `tests/e2e/predictions.spec.ts` - browser tests for prediction return path,
  standard sequential Intro/progress/navigation, score-building steps,
  conversion clamping, result consistency, ruleset-aware Review filtering,
  first-try constraints, submit/revisit, Review Edit and Return to Review, edit
  before kickoff, persisted locked read-only display after dirty local edits,
  custom Number/Choice questions, and conflict value preservation.
- `tests/e2e/kaplay-prediction-preview.spec.ts` - CCPP-009B/009B4 browser tests
  for real Kaplay Match Result preview selection, automatic development access,
  mode switching, reduced motion, delayed initialization cancellation, runtime
  failure fallback, graphics-context loss, keyboard bridge, legacy enabled-flag
  behavior, 009C/009C1/009C2 Rooster shove playback evidence, compact mobile
  layout measurements, CCPP-009C3 resize journey coverage, CCPP-009C3B
  selected-value evidence reads, and dirty saved-session preservation;
  superseded for active prediction-flow browser acceptance by CCPP-010A.
- `tests/e2e/react-prediction-presentation.spec.ts` - CCPP-010A focused
  browser coverage for React-first Match Result, Tries, animation preference
  parity, mobile layouts, absence of active Kaplay canvas/import requests, and
  handoff into Conversions.
- `tests/e2e/kaplay-layout-evidence-helper.spec.ts` - lightweight CCPP-009C3B
  Playwright regression for required Match Result bridge and optional checked
  radio evidence reads without launching the Meteor app.
- `tests/e2e/results.spec.ts` - browser tests for result admin provisional
  save/revisit, blank-versus-zero restoration, derived rugby score, custom
  Number settlement beyond prediction range, custom Choice Void, final read-only
  summary, stale conflict preservation, and explicit latest-result reload.
- `tests/support/playwright-target.ts` - Playwright target guard that rejects non-local hosts.
- `tests/support/kaplay-layout-evidence.ts` - CCPP-009C3B browser evidence
  helper for reading the required Kaplay Match Result semantic bridge while
  treating checked input as optional.

## Important Directories

- `client/` - client startup and global CSS.
- `server/` - server startup.
- `imports/api/` - shared application collections.
- `imports/shared/` - shared route metadata.
- `imports/server/auth/` - passwordless account and server authorisation implementation.
- `imports/server/fixtures/` - fixture server methods, publications, indexes, and test helpers.
- `imports/server/matchResults/` - match result server methods, publications,
  indexes, and test helper.
- `imports/server/predictions/` - prediction server method, publications, indexes, and test helper.
- `imports/server/pwa/` - minimal PWA server hook for static manifest response metadata.
- `imports/shared/auth/` - shared auth constants and validation helpers.
- `imports/shared/fixtures/` - shared fixture names, types, validation, and timezone helpers.
- `imports/shared/matchResults/` - shared result names, types, normalization,
  lifecycle labels, revision constants, and final validation helpers.
- `imports/shared/predictions/` - shared prediction names, types, validation, and storage-normalization helpers.
- `imports/shared/predictionQuestions/` - shared prediction question
  configuration domain.
- `imports/shared/scoring/` - framework-independent scoring rules engine.
- `imports/ui/auth/` - client auth state and auth action helpers.
- `imports/ui/components/` - reusable UI primitives.
- `imports/ui/fixtures/` - fixture-specific UI helpers and admin manager.
- `imports/ui/layouts/` - public and admin layout shells.
- `imports/ui/pages/` - route page components.
- `scripts/` - local lint and formatting checks.
- `tests/unit/` - framework-independent unit tests.
- `tests/e2e/` - Playwright browser smoke tests.
- `tests/support/` - shared verification helpers.
- `config/examples/` - tracked placeholder settings examples.
- `config/local/` - ignored local settings files for developer machines.
- `docs/` - prefixed project documentation.
