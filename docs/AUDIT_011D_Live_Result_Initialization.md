# CCPP-011D Live Result Initialization Audit

## Scope

CCPP-011D implements explicit live result initialization for Rugby Rooster Match
Results. It does not redesign result settlement and does not introduce live
event capture, score persistence, leaderboard persistence, automation, AI, or
animation work.

The milestone preserves the canonical distinction:

- no Match Result document means `awaiting_result`;
- a provisional result created by `Start result tracking` contains real zero
  observations for enabled built-in live counters;
- legacy or historical blank provisional fields remain Pending and are not
  globally reinterpreted as zero.

## Compaction Recovery

This closeout resumed after a remote-compaction failure. Current-state
inspection found that the implementation, focused unit/integration
verification, focused browser correction, passing browser evidence, and most
Match Result/player-score documentation already existed.

Documentation edits already landed before compaction in:

- `docs/CORE_Match_Results.md`
- `docs/CORE_Scoring_Rules.md`
- `docs/PLATFORM_Match_Results.md`
- `docs/PLATFORM_Player_Fixture_Scoring.md`
- `docs/PLATFORM_Fixture_Leaderboard.md`
- `docs/PLATFORM_Player_Score_Breakdown.md`

`docs/PLATFORM_Testing.md`, `docs/MAP_System.md`, `docs/CORE_Build_Plan.md`,
this audit, and the final `docs/TEMP_011D_Resume.md` checkpoint were completed
during closeout. Unrelated local changes were preserved.

## Implementation Summary

Implemented source:

- `imports/shared/matchResults/liveCounters.ts` centralizes the live-counter
  field list, enabled-field filtering, initialized observation builder, and
  preservation helper.
- `imports/shared/matchResults/methods.ts`, `types.ts`, `validation.ts`, and
  `index.ts` expose the start method and shared validation/types.
- `imports/server/matchResults/server.ts` adds
  `matchResults.admin.startResultTracking` and preserves resolved live counters
  during later provisional saves.
- `imports/ui/pages/AdminFixtureResultsPage.tsx` adds the admin pre-start
  state, start action, zero-initialized form projection, and save preservation
  behavior.

The new server method accepts only `{ fixtureId }`, requires the existing
platform-admin authorization path, requires a published non-cancelled fixture,
loads the fixture's frozen ruleset snapshot, and creates the first result with
`observations.matchStatus: 'provisional'`. Repeat starts use the existing first
creation conflict path and do not overwrite an existing result.

## Initialized Fields

The shared live-counter definition in
`imports/shared/matchResults/liveCounters.ts` contains exactly these built-in
counter fields:

- tries;
- conversions;
- successful penalty kicks;
- drop goals;
- yellow cards;
- red cards.

For both teams, enabled fields from that list become
`{ status: 'provisional', value: 0 }` when result tracking starts. These are
resolved zero observations, not placeholders.

The following enabled observations remain Pending at start:

- First Try;
- Highest-Scoring Half;
- Half-Time Leader;
- Custom Number;
- Custom Choice.

No additional fields are inferred.

## Admin Lifecycle

Before start:

- no editable provisional result exists;
- the result page shows a clear `Start result tracking` action;
- blank fields are not displayed as false zeros.

After start:

- the canonical provisional result exists;
- all enabled built-in live counters are numeric `0`;
- the derived rugby score is `0-0`;
- the current derived Match Result is Draw;
- First Try, Highest-Scoring Half, Half-Time Leader, Custom Number, and Custom
  Choice settlements remain Pending.

Later save:

- initialized counter values remain numeric;
- blank UI edits do not silently downgrade initialized counters back to Pending;
- the existing result revision/concurrency protection remains authoritative.

## 011A / 011B / 011C Effect

CCPP-011A:

- no result still returns `awaiting_result`;
- initialized zero result returns `provisional`;
- zero built-in numeric/card items are resolved;
- deductions apply immediately;
- `finalScore` remains `null`.

CCPP-011B:

- the `If it ended now` leaderboard is meaningful immediately after start;
- current zero observations participate in score and rank;
- only genuinely unresolved First Try, Highest-Scoring Half, Half-Time Leader,
  Custom Number, and Custom Choice items contribute to pending counts;
- no score or leaderboard persistence is introduced.

CCPP-011C:

- built-in numeric/card Actual values display `0` instead of Pending;
- authoritative deductions appear immediately;
- First Try, Highest-Scoring Half, Half-Time Leader, Custom Number, and Custom
  Choice remain Pending.

## Historical Blank Handling

CCPP-011D does not migrate, backfill, or broadly reinterpret historical blank
provisional fields as zero. The new zero semantics begin only at the explicit
`Start result tracking` boundary.

Seeded legacy partial provisional records remain supported by tests. Their
blank fields continue to mean Pending.

## Verification History

Prior successful implementation checks recorded before closeout:

- `meteor npm run typecheck` passed after the core/server/UI implementation.
- The focused unit slice passed with 40 tests.
- The Meteor integration full-app launcher passed 101 server tests.
- The focused browser journey initially failed at the `Start result tracking`
  button.
- Inspection showed the secondary admin browser page had not become the active
  interaction context.
- The browser spec was corrected to foreground the admin page before
  interaction.
- Product code was unchanged for that browser correction.
- The focused browser journey then passed.
- Requested 011D screenshots were produced.

The earlier browser failure is treated as a Playwright interaction-context issue,
not a product defect.

Retained final screenshots:

- `test-results/ccpp011d-live-result-initialization/admin-pre-start.png`
- `test-results/ccpp011d-live-result-initialization/admin-zero-initialized.png`
- `test-results/ccpp011d-live-result-initialization/player-my-score-zero-actuals.png`
- `test-results/ccpp011d-live-result-initialization/player-leaderboard-zero-provisional.png`

Closeout screenshot inspection:

- `file` on the four retained screenshot paths confirmed all screenshots open
  as PNG image data.

Closeout checks run against current final source:

- `meteor npm run test:unit -- tests/unit/match-results.test.ts tests/unit/player-fixture-score.test.ts tests/unit/fixture-leaderboard.test.ts tests/unit/player-score-breakdown.test.ts`
  - passed, 40 tests.
- `meteor npm run typecheck` - passed.
- `meteor npm run lint` - passed after escaping the JSX apostrophe in the
  already-implemented `Result tracking hasn't started.` heading; rendered copy
  remains unchanged.
- `meteor npm run lint:project` - passed.
- `meteor npm exec prettier -- --check <changed files>` - passed after running
  Prettier on the touched source/test files.
- `git diff --check` - passed.

Integration was not rerun during closeout because no semantic server/shared
implementation change was made after the prior 101-test passing integration
run. Browser tests were not rerun during closeout because the focused browser
journey had already passed, screenshots were retained, and the closeout changes
did not materially change the browser flow.

## EOMD Package

Final archive:

- `rugby-rooster-ccpp011d-live-result-zero-initialization-eomd-20260921.zip`

Status: built and verified.

Included material:

- live-counter shared helper/domain source;
- result start method/server code;
- admin Match Result UI changes;
- relevant CCPP-011A / CCPP-011B / CCPP-011C source context;
- focused unit tests;
- Meteor server integration tests;
- focused browser specs;
- final 011D screenshots;
- docs, including this audit and the resume checkpoint.

Excluded material:

- credentials and private settings;
- `node_modules`;
- `.meteor/local`;
- build/cache directories;
- unrelated browser evidence directories;
- historical root ZIP archives.

Package verification:

- `unzip -t rugby-rooster-ccpp011d-live-result-zero-initialization-eomd-20260921.zip`
  passed with no compressed-data errors.
- `unzip -l rugby-rooster-ccpp011d-live-result-zero-initialization-eomd-20260921.zip ...`
  confirmed representative docs, source, tests, browser spec, and all four
  final screenshots are present.
- `ls -l rugby-rooster-ccpp011d-live-result-zero-initialization-eomd-20260921.zip ...`
  confirmed the archive exists and original source/evidence files remain in
  place.

## Deferred

CCPP-011D does not begin:

- live event capture;
- admin increment/decrement live counters;
- kickoff automation;
- half-time automation;
- persisted player scores;
- persisted leaderboards;
- AI;
- animations;
- any new feature milestone.
