# CCPP-011C Player Score Breakdown Audit

## Scope

CCPP-011C implements the signed-in player's own fixture score breakdown after
accepted CCPP-011A player fixture-score projection and CCPP-011B fixture
leaderboard work.

Out of scope: AI explanations, leagues, prizes, another user's breakdown, score
persistence, new scoring jobs, live event ingestion, and animation work.

## Implementation

- Added a pure shared presentation mapper:
  `imports/shared/playerFixtureScores/breakdownViewModel.ts`.
- Reused the existing owner-only `predictions.getMyFixtureScore` method.
- Added `/games/:fixtureId/my-score` route wiring and safe auth return path.
- Added `imports/ui/pages/PlayerScoreBreakdownPage.tsx`.
- Added restrained links from current-user leaderboard participation and the
  saved/read-only prediction context.
- Added focused unit coverage in `tests/unit/player-score-breakdown.test.ts`.
- Added focused browser coverage in `tests/e2e/player-score-breakdown.spec.ts`.

The implementation does not add a second Meteor scoring method, does not expose
another player's detail, and does not duplicate scoring formulas. The page
consumes CCPP-011A projection totals and component items as authoritative data.

## Compaction Resume Classification

At resume, after the retained focused browser evidence, the filesystem state
showed no runtime or presentation source file newer than the browser
screenshots. The focused browser spec's `Window.Meteor` type declaration was
edited before the retained passing screenshots. The only visible post-evidence
file timestamp was `docs/TEMP_011C_Resume.md`.

Classification for the latest identifiable pre-closeout post-evidence edit: A,
documentation/test-only.

During closeout, changed-file Prettier formatting made static cleanup edits to
the new score-breakdown source/tests. Classification for those closeout edits:
B, static/lint cleanup with no visible runtime behavior change. The retained
browser evidence is therefore preserved; Playwright was not rerun during
closeout.

## Behaviour

Route:

- `/games/:fixtureId/my-score`

Lifecycle:

- `awaiting_result`: scoring has not started and starting points are not shown
  as an earned current score.
- `provisional`: the page says `If it ended now`, shows authoritative current
  score, starting points, resolved deductions, and pending count.
- `final`: the page says `Final Score`, shows final/current score and total
  deductions, and removes pending indicators.
- `cancelled`: no score is awarded.

The page fetches immediately once the signed-in verified player, fixture, and
ruleset are ready. It offers manual Refresh for awaiting/provisional states and
polls roughly every 15 seconds only while visible. Polling stops when the score
is final, cancelled, hidden, or unmounted. Refresh failure after a successful
load keeps the last-good breakdown visible.

Pending is item-level. A partially pending Tries component can show Springboks
resolved with a deduction while All Blacks remains Pending. The section badge
reports the pending item count without flattening resolved rows to Pending.

Blank official observations display as Pending. Explicit zero observations
display as resolved values and may show `No deduction`.

Custom Number rows show numeric predicted and actual values. Custom Choice rows
resolve stable option IDs through the fixture ruleset snapshot. Custom Void
shows `Void`, `No deduction`, and an excluded-from-scoring note without
claiming correctness.

The authoritative `team-score` component is exposed as `Predicted Score` after
Drop Goals. This keeps a real 011A deduction visible while avoiding UI-side
team-score recalculation.

The zero floor is displayed only from authoritative projection totals: when the
projection score is `0` and resolved deductions exceed starting points, the
summary explains that scores cannot fall below zero.

## Verification History

Prior implementation checks recorded before closeout:

- `meteor npm run test:unit -- tests/unit/player-score-breakdown.test.ts tests/unit/routes.test.ts tests/unit/auth-helpers.test.ts` -
  passed, 3 files / 27 tests.
- `meteor npm run test:unit -- tests/unit/player-score-breakdown.test.ts tests/unit/player-fixture-score.test.ts tests/unit/routes.test.ts tests/unit/auth-helpers.test.ts` -
  passed, 4 files / 35 tests.
- Initial `meteor npm run typecheck` exposed a browser-test `Window.Meteor`
  declaration mismatch.
- The declaration was corrected.
- `meteor npm run typecheck` then passed.
- Evidence-mode focused Playwright launch inside the sandbox exited before
  reporter output/screenshots; `.last-run.json` had no failed tests. This was
  not an application failure.
- The same focused browser journey rerun outside the sandbox passed: 1 Chromium
  test / 1 passed.
- Screenshots were manually inspected.

Final closeout checks on the current source:

- `meteor npm run test:unit -- tests/unit/player-score-breakdown.test.ts tests/unit/routes.test.ts tests/unit/auth-helpers.test.ts` -
  passed, 3 files / 27 tests.
- `meteor npm run typecheck` - passed.
- `meteor npm run lint` - passed.
- `meteor npm run lint:project` - passed.
- `./node_modules/.bin/prettier --check <changed closeout docs/source/tests>` -
  passed.
- `git diff --check` - passed.

Relevant CCPP-011A score-projection regression tests and server integration were
not rerun during closeout because no server/shared scoring contract changed
after the previously accepted state. The retained earlier broader unit result
above remains the 011A projection regression evidence.

## Browser Evidence

Retained focused browser evidence:

- `test-results/ccpp011c-player-score-breakdown/provisional-desktop-score-breakdown.png`
- `test-results/ccpp011c-player-score-breakdown/partially-pending-tries-section.png`
- `test-results/ccpp011c-player-score-breakdown/deduction-row.png`
- `test-results/ccpp011c-player-score-breakdown/custom-void-section.png`
- `test-results/ccpp011c-player-score-breakdown/final-desktop-score-breakdown.png`
- `test-results/ccpp011c-player-score-breakdown/mobile-390.png`
- `test-results/ccpp011c-player-score-breakdown/mobile-360.png`

The journey covered provisional `If it ended now`, current score, starting
points, resolved deduction, pending count, correct/no-deduction row, deduction
row, Pending row, a partially pending multi-item Tries section, result
correction via Refresh without page reload, final score, zero pending, custom
Void presentation, and 390px/360px no-horizontal-overflow checks.

## EOMD Package

Archive:

- `rugby-rooster-ccpp011c-player-score-breakdown-eomd-20260920.zip`

The package was built from an explicit staging include list covering the shared
score-breakdown view model, My Score page, route/auth wiring, current-user link
entry points, relevant CCPP-011A projection/method context, focused unit tests,
focused browser spec, retained final screenshots, browser result logs, updated
docs, and `COMMAND_RESULTS_011C.txt`.

Packaging verification:

- `unzip -t rugby-rooster-ccpp011c-player-score-breakdown-eomd-20260920.zip` -
  passed with no compressed-data errors.
- `zipinfo -1 rugby-rooster-ccpp011c-player-score-breakdown-eomd-20260920.zip` -
  confirmed source, tests, docs, command summary, browser logs, and retained
  screenshots were present.
- Screenshot files opened/validated with `file`: desktop captures were
  `1280x3608` and `1280x3592`; focused section captures were `976x253`,
  `934x84`, and `976x186`; mobile captures were `390x5670` and `360x5694`.
- An initial build briefly contained empty `.git/`, `.agents/`, and `.codex/`
  directory entries; those archive entries were removed before verification and
  are excluded from the final refreshed archive.
- The archive was copied/built from staging only and excluded credentials,
  private settings, `node_modules`, `.meteor/local`, build caches, unrelated
  animation evidence, historical archives, and raw emails.
- Original repository files remained in place; packaging copied/archived only.
- After these audit/checkpoint packaging notes were added, the archive was
  refreshed and `unzip -t` passed again with no compressed-data errors.

## Not Implemented

- AI explanations or commentary.
- Leagues, prizes, QR redemption, or cross-fixture standings.
- Another user's score breakdown.
- Score persistence/cache or background score jobs.
- Animation work.
