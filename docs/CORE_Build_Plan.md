# Rugby Rooster Build Plan

This is the current roadmap, not permission to implement later milestones inside an earlier task.

## Milestone Sequence

1. Application foundation - this task.
2. Testing infrastructure and foundation verification - CCPP-002.
3. Detailed game rules and tested scoring engine - CCPP-003.
4. Passwordless accounts and authorisation - CCPP-004.
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

Not part of this milestone:

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

Not part of this milestone:

- Accounts, fixtures, predictions, leaderboards, leagues, sponsorships, animations, quizzes, or AI reports.
- Database-backed integration tests for future domain features.

## CCPP-003 Scope

Milestone status: implemented for the isolated scoring rules and framework-independent engine. Verification evidence is recorded in `docs/AUDIT_003_Scoring_Engine.md`.

Implemented:

- Authoritative scoring rules and worked examples in `docs/CORE_Scoring_Rules.md`.
- Pure TypeScript scoring engine under `imports/shared/scoring/`.
- Default ruleset snapshot with CCPP-003 question deductions.
- Ruleset, prediction, and observation validation with structured errors.
- Live "If it ended now" scoring, pending observations, provisional deductions, and final-score confirmation rejection.
- Custom numeric and categorical question support without executable formulas.
- Unit tests for scoring, validation, snapshots, and documented examples.

Not part of this milestone:

- UI, accounts, database collections, fixture administration, prediction submission, match-event capture, event normalization, league aggregation, leaderboards, AI, deployment, or admin configuration permissions.
- Database immutability for fixture ruleset snapshots.
- Upstream regulation-time versus extra-time observation policy.

## CCPP-003A Scope

Milestone status: implemented as focused corrections to CCPP-003. Verification evidence is recorded in `docs/AUDIT_003A_Scoring_Validation_Corrections.md`.

Implemented:

- First-try observation consistency validation against supplied try totals.
- Runtime validation for public scoring helper entry points.
- Structured outer-request validation for `scoreFixture`.
- Direct ruleset snapshot-isolation regression tests, including nested custom categorical options.
- ESLint parser split so `.ts` generic arrows and `.tsx` JSX both parse correctly.
- Documentation corrections for public API boundaries, pending-data limits, mixed pending/zero scoring, and snapshot cloning guarantees.

Not part of this milestone:

- Accounts, persistence, fixtures, submission, event capture, UI, leaderboard functionality, deployment, or admin configuration permissions.
- Runtime object freezing or database immutability for rulesets.
- Extra-time, cancellation, or leaderboard policy decisions.

## CCPP-004 Scope

Milestone status: implemented for passwordless account access and platform-admin authorisation. Verification evidence is recorded in `docs/AUDIT_004_Passwordless_Accounts_Authorisation.md`.

Implemented:

- Passwordless email-link request and redemption routes.
- Server-owned account operations through Meteor accounts and methods.
- Safe return-path handling and email identity normalization.
- Local/test mail capture with no real email delivery in test settings.
- Link/request throttling and token redemption throttling.
- Token expiry, replay rejection, resend invalidation, concurrent redemption protection, and package method input hardening.
- Authenticated verified account page.
- Server-authorised platform-admin summary page.
- Test-only auth helpers enabled only by private local settings outside production.
- Unit, Meteor integration, and Playwright browser coverage for account and authorisation behavior.

Not implemented:

- Fixture management, prediction submission, scoring persistence, match-event capture, league aggregation, leaderboards, prizes, sponsorships, animations, quizzes, AI reports, payment features, or rich admin user management.
- Account deletion, support workflows, marketing preferences UI, or long-term consent/audit policy.

## CCPP-004A Scope

Milestone status: complete. Final reconciliation and completion evidence is
recorded in `docs/AUDIT_004A_Completion.md`.

Historical checkpoint evidence is preserved in
`docs/AUDIT_004A_Login_Navigation_Fix.md`,
`docs/AUDIT_004A_Database_Isolation_Verification.md`,
`docs/AUDIT_004A_Database_Verification_Closure.md`,
`docs/AUDIT_004A_Database_Topology_Correction.md`,
`docs/AUDIT_004A_Throttle_Correction.md`, and
`docs/AUDIT_004A_HMR_Workaround_Resolution.md`.

Completed work:

- Account-aware `/auth/email-link` navigation for same-account continuation and
  different-account switch-or-keep decisions.
- Malformed new email-link handling that clears pending tab credentials instead
  of falling back to older stored credentials.
- Isolated integration and Playwright launchers with loopback binding,
  generated test run IDs, and inherited Mongo variable rejection.
- Rspack loopback host/origin adjustments for local browser-test startup.
- Isolated-E2E Rspack HMR/live-reload suppression without overriding
  `Meteor.isTest`, `Meteor.isDevelopment`, or `Meteor.isProduction`.

Accepted verification:

- Throttle correction checkpoint: `meteor npm run test:unit` passed `6` files
  and `57` tests, and `meteor npm run typecheck` passed.
- Database topology checkpoint:
  `meteor npm run test:unit -- --run tests/unit/test-database-identity.test.ts`
  passed `1` file and `9` tests; `meteor npm run test:integration` passed with
  `16 passing`; and `meteor npm run typecheck` passed.
- HMR workaround resolution checkpoint:
  `npm run test:e2e -- tests/e2e/auth.spec.ts -g "requests a real email link, redeems it in a fresh browser, restores the session, and signs out"`
  passed `1` Chromium test; `npm run test:e2e -- tests/e2e/auth.spec.ts`
  passed `10` Chromium tests; `npm run typecheck`, `npm run lint`, and the
  final changed-file Prettier check passed.
- Completion closeout used existing evidence and changed documentation only.
  No commit, push, deployment, production verification, real email delivery, or
  next-milestone work was performed.

## CCPP-004B Scope

Milestone status: implemented for local development email configuration.
Verification evidence is recorded in
`docs/AUDIT_004B_Development_Email.md`.

Implemented:

- Postmark-capable server-side email transport adapter for manual development.
- Local/test mail capture precedence so automated tests do not call Postmark.
- Startup validation for disabled email, placeholder credentials, duplicate
  delivery configuration, and production safety.
- Tracked Postmark settings example and ignored local settings path.
- Manual verification procedure for real development email delivery.

Not completed:

- Real email delivery was not tested by Codex.
- Production email delivery, support workflows, fixture work, or next-milestone
  behaviour were not started.

## CCPP-004C Scope

Milestone status: implemented as local development admin provisioning setup and
documentation. Evidence is recorded in
`docs/AUDIT_004C_Development_Admin.md`.

Implemented:

- Prepared local-only `adminProvisioning` settings for the user-confirmed
  development admin email.
- Preserved the existing server-owned platform-admin grant and revocation
  mechanism.
- Documented manual admin access, ordinary-account denial, cleanup, and revoke
  procedures.

Not completed:

- Codex did not mutate the database, send email, or independently verify the
  manual local admin grant flow.

## CCPP-004D Scope

Milestone status: partially implemented and explicitly not closed. Primary
evidence is recorded in `docs/AUDIT_004D_Admin_Sign_In.md`,
`docs/AUDIT_004D_Login_Credential_Correction.md`, and
`docs/AUDIT_004D_Same_Account_Link_Invalidation.md`. The remaining blocker is
checkpointed in `docs/TEMP_004D_Resume.md` and
`docs/TEMP_004D_Known_Navigation_Issue.md`.

Implemented:

- Admin-specific passwordless sign-in request mode from `/admin`.
- Server-side admin eligibility checks before admin-directed token generation.
- Generic admin acknowledgement copy that does not reveal account eligibility.
- Same-account email-link continuation that invalidates the presented link on
  the server.
- Targeted server integration and browser coverage for the new auth behaviour.

Not completed:

- The full `auth.spec.ts` browser suite has not passed after the documented
  allowed retry. The remaining intermittent sanitized email-link/navigation
  issue must stay unresolved until a later CCPP-004D follow-up proves a passing
  full auth browser suite.

## CCPP-004E Scope

Milestone status: implemented for the minimal PWA foundation. Verification
evidence is recorded in `docs/AUDIT_004E_PWA_Foundation.md`, and platform
details live in `docs/PLATFORM_PWA.md`.

Implemented:

- Web app manifest served at `/site.webmanifest` with `/games` as the launch
  route.
- Temporary standard, maskable, and Apple touch PNG icons, with SVG sources.
- Document head metadata for manifest discovery, standalone mobile
  presentation, theme color, favicon, Apple touch icon, and one safe-area-aware
  viewport declaration.
- Public and admin shell safe-area styling.
- Narrow manifest content-type server hook that leaves static-file serving to
  Meteor.
- Focused foundation browser coverage for manifest/icon responses and
  dimensions, `/games`, responsive layout, and absence of service worker
  registration.

Not part of this milestone:

- Service worker registration, offline fallback, caching, push notifications,
  in-app install prompts, update/reload handling, final mascot artwork, auth
  changes, HMR changes, database changes, email changes, fixture work,
  deployment, or real-device installation testing.

## CCPP-005 Scope

Milestone status: implemented for fixture management and public browsing.
Verification evidence is recorded in
`docs/AUDIT_005_Fixture_Management.md`. Focused pagination and conflict
corrections are recorded in
`docs/AUDIT_005A_Fixture_Pagination_And_Concurrency.md`.

Implemented:

- Fixture persistence with Team 1 / Team 2 text fields, competition text,
  UTC kickoff storage, optional venue, draft/published visibility, cancellation
  state, server-owned metadata, and first-publication ruleset snapshots.
- Server-authorized platform-admin methods to create drafts, edit active
  fixture details, publish valid drafts, and cancel fixtures.
- Explicit admin and public publications with bounded queries and public field
  projections.
- Existing admin area fixture list, create/edit form, publish action, and
  cancellation confirmation.
- Public `/games` browsing for published upcoming and past scheduled fixtures.
- Public `/games/:fixtureId` detail routes.
- South African time admin-entry policy with UTC storage conversion.
- Unit, Meteor integration, and focused Playwright coverage for the fixture
  workflow.

Not implemented:

- Prediction submission, results entry, match-event capture, automatic
  live/completed transitions, deletion, unpublishing, restoration, team or
  competition management, custom question UI, service workers, offline fixture
  caching, leagues, prizes, sponsorships, animation, quizzes, AI, or deployment.

## CCPP-005A Scope

Milestone status: implemented as focused corrections to CCPP-005 fixture
management. Verification evidence is recorded in
`docs/AUDIT_005A_Fixture_Pagination_And_Concurrency.md`.

Implemented:

- Public upcoming, public past, and admin fixture browsing use bounded cursor
  pages instead of total-result caps.
- Cursor ordering uses scheduled kickoff plus fixture ID for deterministic page
  boundaries when kickoff times match.
- Public list boundary refresh resets pagination to the first page so upcoming
  and past membership use a coherent current-time boundary.
- Admin fixture mutations use a server-owned integer revision for optimistic
  conflict protection while keeping `updatedAt` as audit metadata.
- Existing fixtures missing revisions are conditionally backfilled to revision
  `1` before fixture methods and publications register.
- Focused unit, Meteor integration, and fixture browser regressions cover the
  pagination and revision fixes.

Not part of this correction:

- Authentication/navigation, email configuration, HMR, database isolation, PWA
  behavior, prediction submission, results, match-event capture, or later game
  features.

## CCPP-005B Scope

Milestone status: implemented as a focused admin edit-form correction.
Verification evidence is recorded in
`docs/AUDIT_005B_Fixture_Edit_Session.md`.

Implemented:

- Admin fixture editing now captures an explicit fixture ID and expected revision
  when Edit is clicked.
- Reactive list updates no longer replace the captured revision or overwrite
  unsaved form values.
- Saving an active edit session always calls the edit method and never falls
  through to draft creation when the row leaves the visible page.
- Fixture conflict feedback preserves unsaved values and offers explicit cancel
  or reload-and-replace actions.
- Admin pagination clears edit state and form values together.
- Focused fixture browser regressions cover stale edits, explicit reload,
  pagination while editing, and edited rows leaving the visible page.

Not part of this correction:

- Server revision logic, cursor pagination, revision backfill, authentication,
  email, HMR, database isolation, PWA behavior, prediction submission, results,
  match-event capture, or later game features.

## CCPP-006 Scope

Milestone status: implemented for prediction entry and submission locking.
Verification evidence is recorded in
`docs/AUDIT_006_Prediction_Submission.md`, and platform details live in
`docs/PLATFORM_Predictions.md`.

Implemented:

- `/games/:fixtureId/predict` prediction route.
- Existing passwordless sign-in return paths for prediction pages.
- One owned prediction entry per verified player per fixture.
- Server-side validation against the fixture's stored ruleset snapshot.
- Strict server-time kickoff locking; equality and later writes are rejected.
- Cancelled, draft, missing, invalid-snapshot, and snapshotless fixture
  rejection.
- Atomic creation, revision-checked updates, unique user/fixture index, and
  stale revision conflict handling.
- Narrow current-user entry publication and signed-in fixture-context
  publication.
- React form, review, saved-entry revisit, read-only locked display, explicit
  reload, account-switch reset, and mobile-accessible controls.
- Unit, Meteor integration, and focused Playwright coverage for the prediction
  flow.

Not implemented:

- Match results, match-event capture, live/final scoring, leaderboards, leagues,
  prizes, sponsorships, custom-question admin UI, AI, Kaplay animations,
  service-worker caching, or permanent lock-after-reschedule policy.

## CCPP-007 Scope

Milestone status: implemented for the standard sequential prediction
experience. Verification evidence is recorded in
`docs/AUDIT_007_Standard_Sequential_Predictions.md`, and sequence platform
details live in `docs/PLATFORM_Prediction_Sequence.md`.

Implemented:

- Shared built-in prediction sequence definitions with active-step filtering,
  progress positions, previous/next navigation, Review destination, and
  Review edit destinations.
- Shared prediction message catalog with three variants per built-in step,
  stable per-session variant selection, team-name interpolation, and
  ruleset-derived deduction text.
- Guided standard React flow:
  Intro -> Match result -> Tries -> Conversions -> Successful penalty kicks ->
  Drop goals -> Cards -> First try -> Highest-scoring half -> Half-time leader
  -> Review.
- Running predicted rugby match scores on score/card steps using shared scoring
  helpers and shared rugby component point values.
- Conversion maximums, conversion clamping, and first-try constraints derived
  from the same prediction state.
- Result/score consistency warnings after drop goals and Review submission
  prevention for known inconsistencies.
- Review sections with Edit and Return to Review while preserving unrelated
  answers.
- Existing saved-entry revisit, revision, reload, conflict, account isolation,
  and read-only locked display behavior preserved.
- Focused unit and prediction browser coverage for sequence, messages,
  navigation, scoring steps, consistency, first-try constraints, revisions,
  locked display, and stale conflicts.

Not implemented:

- Kaplay, animations, sprites, reduced-motion or capability switching,
  lazy loading, runtime animation fallback, custom questions, optional-question
  admin controls, custom-question storage/scoring/settlement, official-answer
  workflows, result administration, live match lifecycle, leaderboards, leagues,
  sponsorships, quizzes, AI, service-worker caching, authentication redesign,
  fixture CRUD redesign, or scoring-rule changes.

## CCPP-008 Scope

Milestone status: implemented for fixture prediction question configuration.
Verification evidence is recorded in
`docs/AUDIT_008_Fixture_Question_Configuration.md`, product rules live in
`docs/CORE_Prediction_Questions.md`, and platform details live in
`docs/PLATFORM_Prediction_Question_Configuration.md`.

Implemented:

- Permanent core question visibility in the admin configuration experience.
- Draft configuration of optional standard First Try, Highest-Scoring Half, and
  Half-Time Leader enabled states and incorrect-answer deductions.
- Draft authoring of up to two custom Number or Choice fixture questions with
  stable IDs, prompt, optional banter, counting definition, deductions, numeric
  bounds, choice options, and ordering.
- Server-authoritative validation, platform-admin authorization, draft-only
  mutation, and fixture-revision conflict protection.
- Standard-only publication snapshot projection for configured optional
  standard questions.
- Temporary server-authoritative custom-question publish gate.
- Unit, Meteor integration, and focused fixture browser coverage.

Not implemented:

- Player custom-question answering, custom prediction submission, custom Review
  rendering, Kaplay custom rendering, custom scoring, official-answer entry,
  settlement, voiding, result administration, leaderboard changes, or
  cross-fixture score balancing.

## Roadmap Discipline

Future work should keep product-decision status separate from implementation status. Promote product decisions from unresolved to agreed only when requirements are explicit, and promote implementation status only when code and verification evidence exist. When a decision is missing, document the gap instead of filling it with assumptions.
