# TEMP 011D Resume

## CCPP

CCPP-011D — Live Result Initialization & Zero-Based Provisional Scoring.

## Closeout State

- Started from accepted CCPP-011A, CCPP-011B, and CCPP-011C.
- Goal: introduce an explicit result-tracking initialization boundary where no result remains `awaiting_result`, while initialized provisional results carry real zero observations for built-in cumulative counters.
- Implementation, focused unit/integration verification, focused browser
  correction, passing browser evidence, and screenshot capture already existed
  before closeout resumed from the compaction failure.
- Closeout found Match Result / player score / leaderboard / breakdown /
  scoring docs mostly updated before compaction. `PLATFORM_Testing.md`,
  `MAP_System.md`, `CORE_Build_Plan.md`, this checkpoint, and the 011D audit
  were the missing documentation surfaces.

## Actual Result Schema

- Collection: `match_results`.
- One result document per fixture, keyed by `fixtureId`.
- Document fields include `_id`, `fixtureId`, small `ruleset` identity,
  `observations`, integer `revision`, created/updated admin metadata, optional
  final confirmation metadata, and test ownership metadata.
- `observations.matchStatus` is `provisional` or `confirmed`; absence of a
  result document is the separate `No result` / `awaiting_result` state.

## Historical Create/Save Behavior Superseded By CCPP-011D1

- At the CCPP-011D checkpoint, `matchResults.admin.saveProvisional` still
  accepted `expectedRevision: 0` as the first-create path.
- CCPP-011D1 supersedes that behavior: production
  `matchResults.admin.saveProvisional` now updates an existing provisional
  result only, and `expectedRevision: 0` without a result is rejected.
- `matchResults.admin.startResultTracking` is now the only production path that
  creates the first canonical result document at revision `1`.
- CCPP-011D adds `matchResults.admin.startResultTracking`, accepting only
  `{ fixtureId }`, requiring platform-admin authorization and published,
  non-cancelled fixture eligibility, and creating the first provisional result
  with initialized live counters.
- Repeat start does not overwrite an existing result; it safely returns the
  existing first-create conflict path.

## Exact Live-Counter Fields

- Central definition:
  `imports/shared/matchResults/liveCounters.ts`.
- `LIVE_BUILT_IN_COUNTER_FIELDS`: `tries`, `conversions`, `penaltyKicks`,
  `dropGoals`, `yellowCards`, `redCards`.
- `enabledLiveBuiltInCounterFields(ruleset)` filters those fields using the
  fixture's frozen ruleset. Scoring component fields are included when required
  by Match Result, Team Score, or their own built-in numeric question; card
  fields are included only when their card questions are enabled.

## Chosen Initialization Transition

- Explicit admin/server operation:
  `matchResults.admin.startResultTracking`.
- It creates the canonical Match Result with
  `observations.matchStatus: 'provisional'`.
- For both teams, enabled live built-in counters start at
  `{ status: 'provisional', value: 0 }`.
- Enabled First Try, Highest-Scoring Half, Half-Time Leader, custom Number, and
  custom Choice observations remain `{ status: 'pending' }`.
- No migration or backfill is planned. Existing provisional records with blank
  counters remain blank/Pending.
- Provisional saves now preserve already-resolved live counter values if a
  later update submits those fields blank/Pending, preventing initialized
  counters from accidentally reverting to Pending.

## Effect on CCPP-011A / 011B / 011C

- No scoring rewrite is planned.
- CCPP-011A sees a real provisional result after start and calls the existing
  scoring engine in `if-ended-now` mode. Built-in numeric/card items resolve
  to observed zero; derived team scores are `0-0`; Match Result derives to
  Draw; First Try, Highest-Scoring Half, Half-Time Leader, custom Number, and
  custom Choice remain Pending.
- CCPP-011B reuses 011A, so the leaderboard becomes provisional immediately and
  ranks against current zero observations without persisting scores.
- CCPP-011C reuses 011A projection components, so `/my-score` can show actual
  `0` for live counters instead of Pending.

## Tests / Results

- `meteor npm run typecheck` - passed after core/server/UI implementation.
- Focused unit slice - passed with 40 tests before closeout.
- `meteor npm run test:integration` - passed with 101 server tests before
  closeout.
- Focused browser journey - first failed because the secondary admin browser
  page had not become the active interaction context; the spec was corrected to
  foreground the admin page, product code was unchanged, and the rerun passed.
- Final screenshots exist under
  `test-results/ccpp011d-live-result-initialization/`.
- Closeout focused unit slice rerun:
  `meteor npm run test:unit -- tests/unit/match-results.test.ts tests/unit/player-fixture-score.test.ts tests/unit/fixture-leaderboard.test.ts tests/unit/player-score-breakdown.test.ts`
  - passed, 40 tests.
- Closeout static checks passed: `meteor npm run typecheck`,
  `meteor npm run lint`, `meteor npm run lint:project`,
  changed-file `meteor npm exec prettier -- --check ...`, and
  `git diff --check`.
- Closeout screenshot inspection with `file` confirmed all four retained 011D
  screenshots open as PNG image data.
- Integration and browser tests were not rerun during closeout; the prior
  successful integration/browser evidence was retained because no semantic
  server/shared implementation or material browser-flow change followed it.

## Blockers

- None known.

## EOMD Package

- Final archive:
  `rugby-rooster-ccpp011d-live-result-zero-initialization-eomd-20260921.zip`.
- Archive contents include docs, live-counter source, result start/server code,
  admin Match Result UI, relevant 011A/011B/011C context, focused unit tests,
  server integration tests, focused browser specs, and final 011D screenshots.
- `unzip -t rugby-rooster-ccpp011d-live-result-zero-initialization-eomd-20260921.zip`
  passed with no compressed-data errors.
- `unzip -l ...` confirmed representative docs, source, tests, browser spec,
  and all four final screenshots are present.
- `ls -l ...` confirmed the archive exists and original files remain.

## Closeout Remaining

- None.
