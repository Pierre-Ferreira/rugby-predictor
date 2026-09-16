# TEMP 008 Resume - Fixture Question Configuration

## Scope

CCPP-008 adds fixture-level prediction question configuration and the admin
experience for Rugby Rooster.

In scope:

- Admin visibility of permanent core questions.
- Draft configuration of optional standard questions.
- Draft authoring/configuration of up to two custom fixture questions.
- Server-side validation, authorization, and revision-safe persistence.
- Publication snapshot integration for standard-only question configuration.
- Temporary server-authoritative publish gate for fixtures containing custom
  questions.
- Documentation and focused tests.

Out of scope:

- Player custom-question answering.
- Custom-answer submission.
- Custom-question scoring/settlement.
- Official answer/result entry.
- Kaplay rendering or custom-question animation.
- Cross-fixture score balancing.

## Repository And Docs Inspected

- `AGENTS.md`
- `docs/CORE_Predictions.md`
- `docs/PLATFORM_Predictions.md`
- `docs/PLATFORM_Prediction_Sequence.md`
- `docs/PLATFORM_Fixtures.md`
- `docs/PLATFORM_Scoring_Engine.md`
- `docs/AUDIT_007A_Ruleset_Aware_Prediction_Cleanup.md`
- `docs/AUDIT_005B_Fixture_Edit_Session.md`
- `imports/shared/scoring/types.ts`
- `imports/shared/scoring/rulesets.ts`
- `imports/shared/scoring/validation.ts`
- `imports/shared/scoring/engine.ts`
- `imports/shared/predictions/sequence.ts`
- `imports/shared/predictions/messages.ts`
- `imports/shared/predictions/validation.ts`
- `imports/server/fixtures/server.ts`
- `imports/server/fixtures/ruleset.ts`
- `imports/shared/fixtures/types.ts`
- `imports/shared/fixtures/validation.ts`
- `imports/ui/fixtures/AdminFixtureManager.tsx`

## Existing Domain Findings

The shared scoring model already contains:

- `custom-numeric`
- `custom-categorical`
- `FixturePrediction.customAnswers`
- `FixtureObservations.customAnswers`
- custom answer validation and scoring paths

CCPP-008 should reuse those ruleset question types instead of creating a
parallel custom-question scoring universe. The additional configuration fields
needed for admin drafting/future settlement are stored in fixture question
configuration and projected into the existing ruleset snapshot when appropriate.

## Chosen Storage / Domain Approach

- Add explicit fixture draft question configuration on the fixture document.
- Derive compatibility defaults from `defaultRuleset` when an old draft fixture
  has no explicit question configuration.
- Keep permanent core questions visible but not mutable by admin APIs.
- Allow optional standard built-in categorical questions to toggle enabled state
  and configure `incorrectDeduction`.
- Allow custom question drafts with stable IDs, prompt, optional banter,
  counting definition, answer type, ordering, numeric bounds/rate, or choice
  options/deduction.
- Normalize and validate all writes server-side.
- Save question configuration with the existing fixture revision token and
  atomic revision increment.
- Build publication ruleset snapshots from fixture question configuration for
  standard-only fixtures.
- Reject publish while any custom questions are configured because players
  cannot answer custom questions yet.

## Files Changed

- `docs/TEMP_008_Resume.md`
- `docs/CORE_Prediction_Questions.md`
- `docs/PLATFORM_Prediction_Question_Configuration.md`
- `docs/CORE_Predictions.md`
- `docs/CORE_Build_Plan.md`
- `docs/PLATFORM_Predictions.md`
- `docs/PLATFORM_Prediction_Sequence.md`
- `docs/PLATFORM_Fixtures.md`
- `docs/PLATFORM_Testing.md`
- `docs/MAP_System.md`
- `imports/shared/predictionQuestions/types.ts`
- `imports/shared/predictionQuestions/configuration.ts`
- `imports/shared/predictionQuestions/index.ts`
- `imports/shared/fixtures/types.ts`
- `imports/shared/fixtures/methods.ts`
- `imports/server/fixtures/server.ts`
- `imports/server/fixtures/fixtures.app-test.ts`
- `imports/ui/fixtures/AdminFixtureManager.tsx`
- `imports/ui/fixtures/AdminFixtureQuestionConfigurator.tsx`
- `tests/unit/prediction-questions.test.ts`
- `tests/e2e/fixtures.spec.ts`

## Completed Admin Functionality

- Fixture list row entry point: `Prediction questions`.
- Core permanent questions shown as always included with deduction/rate
  information from the ruleset.
- Optional standard questions can be enabled/disabled and configured while draft.
- Custom Number and Choice questions can be added, edited, removed, and reordered
  while draft.
- Maximum two custom questions enforced in UI and server.
- Client-side save validation preserves unsaved values.
- Stale save conflict preserves unsaved values; explicit Reload replaces them.
- Published and cancelled fixtures show read-only question configuration.
- Drafts with custom questions show the temporary publish-gate explanation.

## Methods / Publications Added

- Added `fixtures.admin.saveQuestionConfig`.
- `fixtures.admin.list` now publishes `predictionQuestionConfig` to authorized
  admins only.
- Public fixture publications do not publish `predictionQuestionConfig`.

## Tests Run / Results

- `meteor npm run typecheck` - passed.
- `meteor npm run test:unit -- tests/unit/prediction-questions.test.ts` -
  passed: 8 tests.
- `meteor npm run test:unit` - passed: 119 tests across 12 files.
- `meteor npm run lint` - passed after replacing editor state-reset effects
  with explicit handler/remount behavior.
- `meteor npm run lint:project` - passed.
- `meteor npm run test:integration -- --grep "CCPP-005 fixture management"` -
  passed: 55 server tests in the integration process, including 21 fixture
  management tests.
- `meteor npm run test:e2e -- fixtures.spec.ts -g "shows published and cancelled question configuration"` -
  passed after locator fixes during the focused two-spec run.
- `meteor npm run test:e2e -- fixtures.spec.ts -g "configures draft prediction questions"` -
  passed: 1 Chromium test.
- `meteor npm run test:e2e -- fixtures.spec.ts -g "configures draft prediction questions|shows published and cancelled question configuration"` -
  passed: 2 Chromium tests.
- `meteor npm run test:e2e -- predictions.spec.ts -g "hides inactive Review sections"` -
  passed: 1 Chromium test.
- `meteor npm run test:e2e -- fixtures.spec.ts` - ran after the focused specs;
  new CCPP-008 specs passed, but five older fixture specs failed in the local
  database due older test residue/pagination assumptions and one existing copy
  expectation.
- `meteor npm exec prettier -- --check <CCPP-008 changed files>` - passed.
- `meteor npm run format:check` - failed on seven unrelated historical files
  documented in prior audits.
- `git diff --check` - passed.

Observed/fixed during browser test development:

- Initial new browser specs used dates that could fall behind older local admin
  fixture data; changed to far-future 2099 dates.
- Tightened strict locators for duplicate headings/read-only text/checkboxes.
- Scoped custom-question textbox locators to the custom question card.
- Preserved save success feedback after revision advancement.

## Remaining Work

- None for CCPP-008 implementation. Final response still needs to summarize
  checks and archive path.

## Publication Gate Status

Implemented. Draft fixtures with custom questions save successfully but
`fixtures.admin.publish` rejects them with an admin-facing explanation until
custom-question player predictions are enabled in a future milestone.

## Explicit Out-of-Scope Items

- Player custom-question answering.
- Custom-answer submission and Review rendering.
- Custom-question scoring/settlement.
- Official answer entry, pending/settled/void workflows, and result admin.
- Kaplay rendering.
- Cross-fixture deduction balancing.

## Unresolved Product Decisions

- Balancing across fixtures with different optional/custom question counts and
  deduction weights remains unresolved.
- Final player-facing visibility for custom counting definitions remains
  unresolved.

## Review Archive

- Created
  `rugby-rooster-ccpp008-fixture-question-configuration-eomd-20260916.zip`.
- Inspected with `unzip -l`; archive contains 39 files.
- Confirmed representative originals still exist in the repository after
  packaging.
