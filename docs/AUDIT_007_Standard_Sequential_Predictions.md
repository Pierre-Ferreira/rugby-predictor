# CCPP-007 Standard Sequential Predictions Audit

## Summary

CCPP-007 is implemented for the standard non-animated React prediction
experience. The previous all-at-once prediction form has been replaced with a
guided sequence:

Intro -> Match result -> Tries -> Conversions -> Successful penalty kicks ->
Drop goals -> Yellow and red cards -> First try -> Highest-scoring half ->
Half-time leader -> Review.

The standard experience remains complete. Existing prediction ownership,
submission, revision, kickoff locking, stale-conflict handling, explicit reload,
account/fixture isolation, and read-only persisted display behavior are
preserved.

Kaplay, custom questions, optional-question admin controls, custom-question
storage/scoring/settlement, and scoring-rule changes were not implemented.

## Product Boundary

Rugby Rooster remains separate from Rugby Tracker / Rucks and Mauls. No branding,
collections, permissions, subscription tiers, or architecture from that product
were imported.

## Implementation

### Shared Sequence

Added `imports/shared/predictions/sequence.ts`:

- Defines stable built-in step IDs.
- Defines step kind, message ID, review section ID, and ruleset enablement
  metadata.
- Builds active ordered steps from the fixture ruleset snapshot.
- Calculates Step X of Y, previous/next locations, final-step Review
  destination, score-known timing, and Review edit destinations.

Intro and Review are outside numbered progress. The default ruleset produces
Step 1 of 9 through Step 9 of 9.

### Shared Messages

Added `imports/shared/predictions/messages.ts`:

- Shared Intro message and step message catalog.
- Three reviewed variants for each built-in prediction step.
- Stable per-session variant selection without server persistence.
- Team-name interpolation where catalog copy uses team names.
- Deduction text sourced from the fixture ruleset snapshot, not duplicated React
  constants.

No runtime AI-generated copy is used.

### Standard State And UI

Added `imports/ui/predictions/standardPredictionState.ts` and refactored
`imports/ui/pages/PredictionEntryPage.tsx`:

- One shared `PredictionFormState` drives all sequence steps and Review.
- Running predicted rugby match scores use shared scoring helpers.
- Rugby score component values are exported from
  `imports/shared/scoring/derived.ts` and used by `deriveTeamScore`.
- Conversion maximums and clamping remain immediate and local while server
  validation remains authoritative.
- Result/score consistency warnings begin after drop goals and Review prevents
  final submission while a known inconsistency remains.
- First-try answers are constrained by predicted tries and impossible hidden
  answers are removed immediately.
- Existing entries open at Review, can Edit a step, Return to Review, and submit
  a revision before kickoff.
- Locked/cancelled read-only display renders persisted entry data only.

## Documentation

Updated:

- `docs/CORE_Predictions.md`
- `docs/PLATFORM_Predictions.md`
- `docs/CORE_Build_Plan.md`
- `docs/PLATFORM_Testing.md`
- `docs/MAP_System.md`
- `docs/TEMP_007_Resume.md`

Created:

- `docs/PLATFORM_Prediction_Sequence.md`
- `docs/AUDIT_007_Standard_Sequential_Predictions.md`

## Tests And Checks

Already run:

- `meteor npm run typecheck` - passed.
- `meteor npm run test:unit -- --run tests/unit/prediction-sequence.test.ts` -
  passed `1` file and `8` tests.
- `meteor npm run test:unit` - passed `11` files and `102` tests.
- `meteor npm run lint` - passed.
- `meteor npm run lint:project` - passed.
- `meteor npm run test:integration` - passed `49` server tests.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts -g "updates running rugby scores"` -
  passed `1` Chromium test.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts` - first run
  passed `8` tests and failed `1` selector assertion because text `20` also
  appeared in the kickoff date; no product defect was identified.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts` - rerun passed
  `9` Chromium tests.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts -g "shows persisted saved entry"` -
  passed `1` Chromium test after increasing the prediction spec timeout for the
  two-context locked-display regression.
- `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts` - final rerun
  passed `9` Chromium tests.
- Changed-file Prettier check for CCPP-007 code/tests/docs - passed.

Known unrelated check result:

- `meteor npm run format:check` failed on seven pre-existing unrelated files:
  `docs/AUDIT_004A_Database_Isolation_Verification.md`,
  `docs/AUDIT_004A_Login_Navigation_Fix.md`,
  `imports/server/auth/mongoConnectionIdentity.ts`,
  `imports/shared/auth/testDatabaseIdentity.ts`, `playwright.config.ts`,
  `scripts/test-environment.mjs`, and `tests/unit/test-launchers.test.ts`.
  These files were not changed for CCPP-007.

## Regression Coverage

Focused browser coverage now includes:

- Intro outside numbered progress.
- Step 1 of 9 baseline progress.
- Back/Continue navigation and answer preservation.
- Stable message variant during navigation.
- Running predicted rugby score updates for tries, conversions, penalties, and
  drop goals.
- Conversion maximums, conversion clamping, and zero-try conversion disabling.
- Result/score consistency warning timing and correction.
- First-try constraints from predicted tries.
- Submit and saved Review revisit.
- Existing-entry Review Edit and Return to Review.
- Revision submission preserving unrelated answers.
- Locked persisted saved-entry display after dirty local edits.
- Stale conflict preserving unsaved answers.

Unit coverage includes active sequence totals, navigation destinations, Review
edit destinations, message catalog variants, stable variant selection,
ruleset-derived deduction values, team-name interpolation, conversion clamping,
first-try constraints, and result consistency helpers.

## Future Extension Point

The current sequence consists of built-in step definitions. Navigation, progress,
Review, and Edit consume an ordered active-step list. Future optional standard
or custom question milestones can extend that list and provide message/review
metadata without rewriting the standard sequence navigation.

CCPP-007 does not define:

- custom-question persistence;
- custom-question prediction storage changes;
- custom-question scoring or settlement;
- custom official-answer workflows;
- admin configuration or CRUD.

## Unresolved Product Questions Preserved

- Exact treatment of second-yellow dismissals and card upgrades remains
  unresolved. `docs/CORE_Scoring_Rules.md` still lists detailed card-event
  normalization, including second-yellow-to-red handling, as unresolved.
- Future balancing when fixtures can contain different counts or weights of
  optional/custom questions.
- Future limits/bounds on configurable custom deductions.
- Future official-answer/settlement workflow for custom questions.

## Review Archive

Created and inspected:

- `rugby-rooster-ccpp007-standard-sequential-predictions-eomd-20260916.zip`

The archive contains 22 copied files covering changed prediction React source,
standard state helpers, sequence/message source, relevant shared
prediction/scoring context, unit and browser tests, and updated/new docs.
Original source files remain present in the repository.
