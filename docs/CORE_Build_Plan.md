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

## CCPP-008A Scope

Milestone status: implemented for custom questions in the Standard prediction
sequence. Verification evidence is recorded in
`docs/AUDIT_008A_Custom_Questions_Standard_Sequence.md`.

Implemented:

- Published custom Number and Choice questions render after active built-in
  Standard steps and before Review.
- Custom answers persist through the existing prediction entry as
  `customAnswers` keyed by stable custom question ID.
- Review, Edit, revisit, revision conflict, and locked read-only display support
  custom answers from the frozen fixture snapshot.
- Server validation derives custom answer requirements, ranges, option IDs, and
  deductions from the published snapshot.
- Valid custom-question fixtures can publish; the temporary CCPP-008 publish
  gate is removed.
- Custom deductions are positive safe integers greater than zero, and the admin
  projected player-step count derives from the active sequence.

Not implemented:

- Custom official answers, custom result settlement, custom scoring against
  actual answers, cross-fixture score balancing, Kaplay custom screens,
  leaderboards, or match-result administration.

## CCPP-008B Scope

Milestone status: implemented for admin match-result and prediction-question
settlement. Product details live in `docs/CORE_Match_Results.md`, platform
details live in `docs/PLATFORM_Match_Results.md`, and verification evidence is
recorded in `docs/AUDIT_008B_Match_Results_Settlement.md`.

Implemented:

- One authoritative result document per published, non-cancelled fixture.
- Provisional result saves with Pending versus zero preservation.
- Built-in observation capture for rugby scoring components, cards, and enabled
  standard categorical questions.
- Derived official rugby score and derived match result from component
  observations.
- Custom Number/Choice official settlement from frozen published ruleset
  snapshots.
- Explicit custom Void settlement with zero future deduction semantics.
- Final confirmation validation, server-owned metadata, revision conflict
  handling, and read-only final results.
- Admin-only result publications and a dedicated
  `/admin/fixtures/:fixtureId/results` route.
- Focused scoring unit, Meteor integration, and Playwright result-admin
  coverage.

Not implemented:

- Persisted Rugby Rooster player scores, leaderboards, rankings, winners,
  score jobs, public live deductions, live rugby event capture, live match
  lifecycle states, Kaplay, custom animations, or result correction/reopen
  workflows.

## CCPP-009A Scope

Milestone status: implemented for the shared prediction session and renderer
contract. Platform details live in `docs/PLATFORM_Prediction_Session.md`, and
verification evidence is recorded in
`docs/AUDIT_009A_Shared_Prediction_Session.md`.

Implemented:

- Editable prediction session owner above the replaceable presentation subtree.
- Renderer-facing state and semantic actions for Standard React and future
  renderers.
- Standard React prediction presentation connected to the shared session
  without visible redesign.
- Session-owned answer state, current location, Review edit context, stable
  message variants, captured expected revision, dirty/discard state,
  conflict/submission feedback, and submission guard.
- Focused unit/controller coverage and focused Standard browser regression
  coverage.
- Lightweight current repository Rooster asset inventory.

Not implemented:

- Kaplay runtime, canvas or game scene, renderer switching, animation assets,
  sprite atlases, runtime fallback, reduced-motion/animation preferences,
  visual redesign, browser draft persistence, scoring changes, result changes,
  leaderboards, or service-worker caching.

## CCPP-009A1 Scope

Milestone status: implemented for shared prediction session lifecycle guards.
Verification evidence is recorded in
`docs/AUDIT_009A1_Session_Lifecycle_Guards.md`.

Implemented:

- Symmetrical session-owner effect setup and cleanup.
- Read-only command guards for direct renderer actions.
- In-flight duplicate-submit and discard/reload protections.
- Old-owner async response isolation.
- Legitimate same-session submit completion after reactive read-only changes.
- Real React DOM hook coverage for owner and replaceable consumer behavior.

Not implemented:

- Kaplay runtime, canvas rendering, renderer switching, animation preferences,
  reduced-motion handling, or runtime fallback.

## CCPP-009B Scope

Milestone status: implemented for the Kaplay Match Result runtime preview,
safe fallback, and automatic ordinary-development access. Platform details live in
`docs/PLATFORM_Kaplay_Predictions.md`, and verification evidence is recorded in
`docs/AUDIT_009B_Kaplay_Runtime_Fallback.md`.

Implemented:

- `kaplay@3001.0.19` dependency and lazy client-only dynamic import.
- Automatic non-production development access for supported scenes, with
  production still unavailable.
- Fresh/invalid browser preference defaulting to Animations On, while explicit
  Off remains respected.
- Animations On/Off preference control.
- Reduced-motion Standard fallback.
- Effective-mode projection for gate, preference, reduced motion, step support,
  and runtime state.
- Owned canvas, non-global KAPLAY context, initialization timeout, runtime
  cleanup, context-loss handling, visibility pause, failure latch, and retry.
- One real interactive Kaplay Match Result screen using the shared prediction
  session, actual fixture team names, Draw, current messages, current selected
  state, and shared Back/Continue actions.
- DOM semantic choice bridge for keyboard/accessibility.
- Focused unit, mocked lifecycle, real-browser preview, and Standard
  regression coverage.

Not implemented:

- Rooster artwork, shove animation, complete built-in/custom Kaplay question
  flow, Kaplay Review/submission, production rollout, FPS quality tiers,
  new persistence schemas, prediction/server redesign, scores/leaderboards,
  result settlement, authentication/Postmark, admin refresh, or offline
  caching.

## CCPP-009 Future Boundaries

These boundaries preserve the staged Kaplay plan. They are not implemented by
CCPP-009B.

- 009C - visual foundation and Rooster shove.
- 009D - complete built-in/custom question screens.
- 009E - Review/submission/edit parity.
- 009F - integrated verification and default activation.

CCPP-010A supersedes this staged Kaplay prediction-control plan for the active
prediction route. The 009 artifacts remain useful history and may inform later
gameplay, but future prediction-control work should start from the React-first
architecture unless a later product decision explicitly changes direction.

## CCPP-010A Scope

Milestone status: implemented for shared React Match Result and Tries
presentation closeout. Platform details live in
`docs/PLATFORM_React_Prediction_Experience.md`, and verification evidence is
recorded in `docs/AUDIT_010A_Shared_React_Presentation.md`.

Implemented:

- Active prediction route renders React-first Match Result and Tries controls.
- Match Result uses real HTML Team 1, Team 2, and Draw controls and shared
  `selectBuiltInChoice('matchResult', value)` updates.
- Tries uses real per-team numeric controls and shared
  `changeTeamNumericField(side, 'tries', value)` updates.
- Animations On adds optional browser-native decoration over the same controls.
- Animations Off and reduced motion use the same essential controls and session
  state.
- Prediction-specific Kaplay route/runtime imports are disconnected from the
  active prediction flow while the package and historical modules remain for
  later cleanup.
- Final retained focused browser evidence, closeout static/unit checks,
  documentation, and review packaging are recorded in the audit.

Not implemented:

- Conversions or later visual migration.
- Full animated prediction flow.
- Half-time quiz or other Kaplay gameplay.
- Deleting historical Kaplay prediction modules.
- Server prediction method or scoring behavior changes.
- CCPP-010B work.

## CCPP-010B Scope

Milestone status: implemented for React-first numeric scoring steps. Platform
details live in `docs/PLATFORM_React_Prediction_Experience.md`, and
verification evidence is recorded in
`docs/AUDIT_010B_Numeric_Scoring_Steps.md`.

Implemented:

- Conversions, Successful Penalty Kicks, and Drop Goals use the same
  React-first numeric presentation family established from Tries.
- Each migrated numeric step uses real per-team number inputs and plus/minus
  buttons that dispatch through `changeTeamNumericField(...)`.
- Derived predicted-score-so-far context comes from existing score helpers.
- Conversion maximum and adjustment behavior remain owned by existing form
  helpers.
- Penalty Kick and Drop Goal deduction copy remains ruleset/message-derived.
- Drop Goals preserves the existing result/score consistency warning and
  blocked Continue behavior.
- Focused component tests, focused browser evidence, documentation, and review
  packaging are recorded in the audit.

Not implemented:

- Cards, First Try, Highest-Scoring Half, Half-Time Leader, custom-question, or
  Review visual migration.
- Full animated prediction flow beyond the existing Match Result and numeric
  pulse decoration.
- Half-time quiz or other Kaplay gameplay.
- Server prediction method, scoring engine, ruleset, or persistence changes.

## CCPP-010B1 Scope

Milestone status: implemented for numeric animation/personality and the Match
Result timing restoration. Platform details live in
`docs/PLATFORM_React_Prediction_Experience.md`, and verification evidence is
recorded in `docs/AUDIT_010B1_Numeric_Animation_Personality.md`.

Implemented:

- Tries, Conversions, Successful Penalty Kicks, and Drop Goals now share a
  presentation-only numeric reaction layer that observes accepted form values
  and derived scores after the session update.
- Tries has the strongest card/value/score reaction and cheeky high-total copy;
  Conversions has accepted-change feedback plus a visible nonblocking cap
  reaction; Penalty Kicks and Drop Goals have distinct short score-building
  reactions.
- Predicted-score-so-far values react independently when the existing derived
  score helper reports a changed team score.
- Rapid input cancels/replaces obsolete cosmetic reactions so latest state wins
  without queued answer updates.
- Animations Off and reduced motion keep values, validation, helper copy, caps,
  score calculation, and navigation identical while suppressing decorative
  movement/reaction state.
- Rugby Rooster number steppers hide native browser spinner arrows while
  keeping numeric input semantics and keyboard/mobile entry.
- Match Result cadence is restored to the accepted 1400ms timing after the
  accidental 1800ms regression; geometry and keyframe percentages are unchanged.
- Focused component tests, focused Animations-On browser evidence, normal-speed
  WebM, screenshots, documentation, and review packaging are recorded in the
  audit.

Not implemented:

- Cards, First Try, Highest-Scoring Half, Half-Time Leader, custom-question, or
  Review redesign.
- New mascot artwork, canvas, Kaplay gameplay, animation-owned answer state,
  server methods, scoring rules, or persistence changes.

## CCPP-010C Scope

Milestone status: implemented for React-first Cards and First Try presentation.
Platform details live in `docs/PLATFORM_React_Prediction_Experience.md`, and
verification evidence is recorded in
`docs/AUDIT_010C_Cards_First_Try.md`.

Implemented:

- Cards use React-first team panels with separate Yellow Cards and Red Cards
  numeric fields for Team 1 and Team 2.
- Cards reuse the accepted shared numeric stepper mechanics for direct typing,
  blank drafts, decrement/increment buttons, zero floor, hidden native spinners,
  rapid changes, and no arbitrary maximum.
- Yellow and Red Cards have distinct decorative markers, capped marker stacks,
  and presentation-only reactions.
- One active Cards reaction key means the latest Yellow/Red response wins and
  stale field copy clears during rapid changes.
- Card counts do not alter the predicted rugby match score.
- First Try uses real React radio controls for Team 1, Team 2, and
  `No Tries Today!`.
- `No Tries Today!` is a full-size legitimate option while remaining governed
  by the existing first-try consistency helper.
- Animations On adds cosmetic Cards/First Try reactions; Animations Off and
  reduced motion keep the same controls and domain behavior.
- Focused component tests, retained focused browser evidence, normal-speed
  WebM, contact sheet, documentation, and review packaging are recorded in the
  audit.

Not implemented:

- Highest-Scoring Half, Half-Time Leader, custom-question, or Review redesign.
- CCPP-010D.
- New mascot artwork, canvas, Kaplay prediction runtime work, quiz/gameplay,
  animation-owned answer state, server methods, scoring rules, or persistence
  changes.

## CCPP-011A Scope

Milestone status: implemented for derived player fixture-score projection.
Platform details live in `docs/PLATFORM_Player_Fixture_Scoring.md`, and
verification evidence is recorded in
`docs/AUDIT_011A_Player_Fixture_Score.md`.

Current roadmap direction pauses animation/UI refinement and prioritizes the
competitive loop:

Prediction -> Match Result -> Player Fixture Score -> Fixture Leaderboard.

Implemented:

- Shared serializable `PlayerFixtureScoreProjection` types and adapter.
- Deterministic projection from persisted prediction, frozen fixture ruleset
  snapshot, and current match result through the existing scoring engine.
- Explicit `awaiting_result`, `provisional`, `final`, and `cancelled`
  lifecycle states.
- Provisional scoring that deducts only resolved components while exposing
  pending counts.
- Final scoring through existing engine final mode and zero floor.
- Custom Number/Choice support, including custom Void as non-pending
  zero-deduction.
- Prediction and result revision metadata in the projection.
- Owner-only `predictions.getMyFixtureScore` Meteor method with `null` for no
  saved prediction.
- Focused unit and isolated server integration coverage.

Not implemented:

- Fixture leaderboard, rankings, ties/shared placings, league standings, score
  persistence/cache, recalculation workers, player score card UI, score
  breakdown UI, AI commentary, live event ingestion, or animation work.

## CCPP-011B Scope

Milestone status: implemented for a derived fixture leaderboard. Platform
details live in `docs/PLATFORM_Fixture_Leaderboard.md`, and verification
evidence is recorded in `docs/AUDIT_011B_Fixture_Leaderboard.md`.

Current roadmap direction keeps animation/presentation polish paused and
prioritizes the competitive loop:

Prediction -> Match Result -> Player Fixture Score -> Fixture Leaderboard.

Implemented:

- Shared `FixtureLeaderboardProjection` types and pure ranking builder.
- Reuse of the accepted CCPP-011A player fixture-score projection for every
  eligible saved prediction.
- Derived-only leaderboard with no collection, score cache, background job, or
  prediction mutation.
- Explicit `awaiting_result`, `provisional`, `final`, and `cancelled`
  lifecycle states.
- Standard competition ranking with shared places such as `1,2,2,4`.
- Deterministic fixture-scoped opaque row ordering inside ties.
- Temporary privacy-safe fixture-scoped aliases because no explicit public
  display-name field exists yet.
- Authenticated `predictions.getFixtureLeaderboard` Meteor method with bounded
  `offset` / `limit` pagination.
- Current-user row highlighting and separate `currentUserRow` when outside the
  loaded page.
- Player-facing `/games/:fixtureId/leaderboard` route with manual refresh,
  visible-page 15-second refresh for awaiting/provisional states, Load more,
  and responsive 390px/360px presentation.
- Focused unit, isolated server integration, and focused browser coverage.

Not implemented:

- Leagues, tournaments, cumulative totals, average scores, prizes, QR
  redemption, AI commentary, persistent ranking cache, background jobs, live
  event ingestion, or animation work.

## CCPP-011C Scope

Milestone status: implemented for the signed-in player's own fixture score
breakdown. Platform details live in
`docs/PLATFORM_Player_Score_Breakdown.md`, and verification evidence is recorded
in `docs/AUDIT_011C_Player_Score_Breakdown.md`.

Implemented:

- Player-facing `/games/:fixtureId/my-score` route.
- Reuse of the existing owner-only `predictions.getMyFixtureScore` method.
- Reuse of the accepted CCPP-011A `PlayerFixtureScoreProjection` as score,
  deduction, status, pending-count, Void, and zero-floor authority.
- Pure shared presentation view model for section order, team labels, custom
  question labels, custom Choice stable-option label resolution, lifecycle
  summary rows, item-level Pending/Void/resolved display, and zero-floor copy.
- Item-level partially pending display, so a resolved team row can show its
  actual value and deduction while another team row remains Pending in the same
  section.
- Authoritative `team-score` component shown as a `Predicted Score` section
  after Drop Goals without recalculating the deduction in UI.
- Immediate load, manual Refresh, and roughly 15-second visible-page polling
  while awaiting/provisional, with polling stopped on final/cancelled/hidden/
  unmounted.
- Last-good breakdown retention on refresh failure.
- Links from current-user leaderboard participation and saved/read-only
  prediction context.
- Focused pure unit coverage and retained focused browser evidence for
  provisional, correction, final, custom Void, partially pending Tries, and
  390px/360px responsive states.

Not implemented:

- AI explanations or commentary.
- Leagues, tournaments, cumulative totals, prizes, or QR redemption.
- Another user's score breakdown.
- Score persistence/cache, background score jobs, or live event ingestion.
- Animation work.

## Roadmap Discipline

Future work should keep product-decision status separate from implementation status. Promote product decisions from unresolved to agreed only when requirements are explicit, and promote implementation status only when code and verification evidence exist. When a decision is missing, document the gap instead of filling it with assumptions.
