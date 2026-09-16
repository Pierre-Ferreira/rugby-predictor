# AUDIT 008 - Fixture Question Configuration

## Scope

CCPP-008 implemented fixture-level prediction question configuration and its
admin experience.

Implemented:

- permanent core question visibility;
- optional standard question enable/disable and deduction configuration;
- custom Number and Choice draft question configuration;
- max-two custom question limit;
- server-side validation and authorization;
- fixture revision conflict protection;
- standard-only publication snapshot integration;
- temporary custom-question publish gate;
- focused unit, integration, and browser coverage;
- product/platform documentation.

Not implemented:

- player custom-question answering;
- custom prediction submission or Review rendering;
- custom-question scoring or settlement;
- official answer entry;
- pending/settled/void workflows;
- Kaplay custom-question rendering;
- score normalization or balancing changes.

## Domain Changes

Added `imports/shared/predictionQuestions/`:

- `types.ts` defines question configuration types, optional standard IDs,
  permanent core IDs, custom answer types, and method result contracts.
- `configuration.ts` validates and normalizes configuration, owns
  `MAX_CUSTOM_QUESTIONS_PER_FIXTURE = 2`, derives legacy defaults, and projects
  configured optional standard questions into a scoring ruleset snapshot.
- `index.ts` exports the shared domain.

The implementation reuses existing scoring concepts (`custom-numeric`,
`custom-categorical`, and `customAnswers`) rather than creating a parallel
scoring model. Rich draft custom configuration remains fixture configuration in
CCPP-008 because custom fixtures cannot publish yet.

## Fixture And Snapshot Changes

Fixture documents now have optional `predictionQuestionConfig`.

Old draft fixtures without this field derive current canonical defaults from
`defaultRuleset`. Existing published fixtures continue to use their stored
`rulesetSnapshot`.

Publishing a standard-only draft builds a snapshot from `defaultRuleset` with
configured optional standard enabled states and incorrect-answer deductions
applied. Disabled optional standard questions remain in the snapshot as disabled
definitions.

## Admin Method And Publication Changes

Added method:

- `fixtures.admin.saveQuestionConfig`

The method requires platform-admin authorization, accepts only `fixtureId`,
`expectedRevision`, and `config`, validates the full configuration, writes only
to draft non-cancelled fixtures, and increments the fixture revision atomically.

The admin fixture list publication now includes `predictionQuestionConfig`.
Public fixture publications do not publish it, and player prediction context
continues to rely on published `rulesetSnapshot`.

## Admin UI Changes

The fixture list includes a `Prediction questions` entry point per fixture.

The editor shows:

- Core: permanent always-included questions and deduction/rate information from
  the active/default ruleset.
- Optional: First Try, Highest-Scoring Half, and Half-Time Leader toggles plus
  incorrect-answer deduction inputs.
- Custom: up to two fixture-specific Number or Choice questions with prompt,
  optional banter, counting definition, deductions, numeric limits or choice
  options, remove, and Up/Down ordering controls.

Draft fixtures are editable. Published and cancelled fixtures are read-only.
The editor preserves unsaved values on validation errors and stale-save
conflicts. `Reload` intentionally replaces local values with the latest visible
fixture configuration.

## Authorization And Validation

Server validation rejects:

- unauthenticated and non-admin writes;
- unknown fields;
- permanent core question configuration through the optional standard API;
- unsupported standard/custom answer types;
- more than two custom questions;
- missing prompt/counting definition;
- malformed numeric limits or deductions;
- maximum lower than minimum;
- invalid choice option counts;
- empty or duplicate choice labels;
- duplicate custom question or option IDs;
- published/cancelled fixture mutation;
- stale expected revisions.

## Revision Behavior

Question configuration uses the fixture `revision` as the concurrency token.

The UI captures revision and configuration when opened. Reactive admin list
updates do not silently advance the captured revision. A successful save returns
the new revision. A stale save returns `fixture-conflict`, keeps unsaved values,
and leaves the newer stored configuration untouched.

## Temporary Custom Publish Gate

Draft fixtures with custom questions can save but cannot publish. The server
rejects publish with:

`Custom questions are configured for this fixture, but custom-question player predictions are not enabled yet.`

The fixture remains draft and its custom questions remain saved.

## Tests Added Or Changed

- `tests/unit/prediction-questions.test.ts`
  - valid Number and Choice custom questions;
  - missing prompt/counting definition;
  - invalid numeric ranges and non-integer values;
  - invalid deductions;
  - too few, empty, duplicate-label, and duplicate-ID choice options;
  - unsupported answer type;
  - max-two custom questions;
  - order normalization;
  - stable ID preservation after edits;
  - unknown-field rejection;
  - core-question configuration rejection;
  - optional standard ruleset projection and active sequence filtering.

- `imports/server/fixtures/fixtures.app-test.ts`
  - admin authorization for question config writes;
  - admin read projection;
  - draft update persistence;
  - stale update conflict;
  - published/cancelled read-only rejection;
  - unknown field and core injection rejection;
  - standard-only publication snapshot;
  - custom-question publish gate;
  - legacy draft default derivation;
  - public publication does not leak `predictionQuestionConfig`.

- `tests/e2e/fixtures.spec.ts`
  - draft editor flow for optional standard toggles/deductions;
  - validation feedback;
  - Number and Choice custom questions;
  - reorder;
  - save/revisit persistence;
  - custom publish gate;
  - conflict preservation and Reload;
  - published/cancelled read-only display.

## Commands Executed

- `meteor npm run typecheck`
  - Passed.

- `meteor npm run test:unit -- tests/unit/prediction-questions.test.ts`
  - Passed: 8 tests.

- `meteor npm run test:unit`
  - Passed: 119 tests across 12 files.

- `meteor npm run lint`
  - First run failed on `react-hooks/set-state-in-effect` in
    `AdminFixtureQuestionConfigurator.tsx`.
  - Fixed by removing effect-driven state resets, keying the editor by fixture,
    and making Reload explicitly replace local state.
  - Rerun passed.

- `meteor npm run lint:project`
  - Passed.

- `meteor npm run test:integration -- --grep "CCPP-005 fixture management"`
  - Passed: 55 server tests in the integration run.

- `meteor npm run test:e2e -- fixtures.spec.ts -g "configures draft prediction questions|shows published and cancelled question configuration"`
  - First run failed because very-late admin test rows were not guaranteed to be
    on the first page with older local residue.
  - Rerun failed on strict locator ambiguity for duplicate heading/read-only
    text.
  - Rerun failed on strict checkbox ambiguity.
  - The published/cancelled read-only spec then passed.

- `meteor npm run test:e2e -- fixtures.spec.ts -g "configures draft prediction questions"`
  - Failed once because client validation reported counting definition before
    question prompt.
  - Failed once because a broad `getByLabel("Question")` matched a labelled
    custom-question section.
  - Failed once because save success feedback was cleared when the saved
    revision advanced.
  - Passed after fixes: 1 Chromium test.

- `meteor npm run test:e2e -- fixtures.spec.ts -g "configures draft prediction questions|shows published and cancelled question configuration"`
  - Passed: 2 Chromium tests.

- `meteor npm run test:e2e -- predictions.spec.ts -g "hides inactive Review sections"`
  - Passed: 1 Chromium test.

- `meteor npm run test:e2e -- fixtures.spec.ts`
  - Failed: 3 passed, 5 failed.
  - Both CCPP-008 browser specs passed inside this full-spec run.
  - The failures were older fixture specs affected by local database residue /
    existing pagination assumptions, plus the existing fixture-detail copy
    expectation:
    - `lets anonymous visitors browse upcoming, past, and detail fixture views`
      did not find `Predictions are not open yet.`;
    - `lets platform admins create, publish, and cancel a fixture through the
admin workflow` did not find the newly created draft row on the visible
      admin page;
    - `paginates public and admin fixture lists with next and previous controls`
      did not find the expected admin page-2 row;
    - `rejects stale fixture edits without replacing form values or newer
details` did not find the expected row on the visible admin page;
    - `clears edit session and form values together when admin pagination
changes` did not find the expected page-2 row.

- `meteor npm exec prettier -- --write <CCPP-008 changed files>`
  - Completed.

- `meteor npm exec prettier -- --check <CCPP-008 changed files>`
  - Passed.

- `meteor npm run format:check`
  - Failed only on seven unrelated historical files:
    - `docs/AUDIT_004A_Database_Isolation_Verification.md`
    - `docs/AUDIT_004A_Login_Navigation_Fix.md`
    - `imports/server/auth/mongoConnectionIdentity.ts`
    - `imports/shared/auth/testDatabaseIdentity.ts`
    - `playwright.config.ts`
    - `scripts/test-environment.mjs`
    - `tests/unit/test-launchers.test.ts`

- `git diff --check`
  - Passed.

## Known Unrelated Failures

- Full fixture browser suite remains sensitive to older local fixture data in
  this workspace. The two new CCPP-008 fixture browser specs passed in focused
  runs and within the full-spec attempt.
- Repository-wide `format:check` still fails on seven unrelated historical
  files listed above. CCPP-008 changed-file Prettier check passed.

## Review Archive

- Created
  `rugby-rooster-ccpp008-fixture-question-configuration-eomd-20260916.zip` in
  the repository root.
- Inspected with `unzip -l`; archive contains 39 files:
  - prediction question configuration domain;
  - fixture types/methods/server integration and fixture integration tests;
  - admin question configurator and fixture manager entry point;
  - relevant scoring and prediction sequence context;
  - unit and browser tests;
  - CCPP-008 core/platform/audit/temp docs and changed platform docs.
- Confirmed originals remain present after packaging.
