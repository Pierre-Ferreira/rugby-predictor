# CCPP-011B Fixture Leaderboard Audit

## Scope

CCPP-011B implements a derived leaderboard for one fixture after accepted
CCPP-011A. Animation/presentation polish remains paused.

The competitive loop is:

```text
Saved Prediction -> Current Match Result -> Player Fixture Score -> Fixture Leaderboard
```

## Implementation

- Added shared leaderboard types, input validation, and ranking projection under
  `imports/shared/fixtureLeaderboards/`.
- Reused `calculatePlayerFixtureScoreProjection(...)` from CCPP-011A for every
  scored prediction.
- Added server loader and authenticated Meteor method
  `predictions.getFixtureLeaderboard`.
- Added fixture-scoped privacy aliases and opaque row IDs derived from SHA-256
  digest data.
- Added `/games/:fixtureId/leaderboard` with existing public layout and
  sign-in-required return flow.
- Added Game Detail and Prediction page `Leaderboard` entry points.
- Added isolated test helper support for the focused browser scenario.
- Added pure unit, privacy unit, server integration, and focused browser tests.
- Final lint closeout scoped client-side leaderboard/error state by fixture ID
  instead of synchronously clearing state in an effect, and escaped the
  player-facing `You're in.` apostrophe through a JSX string expression.

## Behaviour

Leaderboard rows are derived from all persisted predictions for the fixture.
The service does not persist scores, rankings, or cache rows.

Lifecycle states:

- `awaiting_result`: no rows or ranks; `totalEntries` remains available.
- `provisional`: rows use 011A `currentScore`, include `pendingCount`, and the
  UI says `If it ended now`.
- `final`: rows use final/current 011A score, pending indicators are removed,
  and tied first-place rows are joint winners.
- `cancelled`: no leaderboard score or rank is assigned.

Ranking uses standard competition ranking: `1,2,2,4` and `1,1,3`. Score is the
primary sort descending. Fixture-scoped opaque row ID is the deterministic
secondary sort inside ties.

Pagination defaults to 50 rows and rejects limits above 100. Ranking is global
before slicing. `currentUserRow` is returned only when the signed-in user's row
is outside the loaded page.

The client keeps successful refresh failures non-destructive for the current
fixture: the last good leaderboard remains visible and a refresh status is
shown. Route changes derive active leaderboard/error state by fixture ID, so a
new fixture does not show stale rows, result revision, or previous error text
while its request is in flight.

## Privacy

No existing safe public display-name field was found in the account/profile
model. CCPP-011B therefore uses temporary server-derived labels:

```text
Rooster XXXXXXXX
```

The signed-in player is labelled `You` and receives a visible `YOU` badge. The
serialized method response is tested to exclude user IDs, emails, login/auth
metadata, prediction payloads, and raw match-result documents.

## Verification

- `meteor npm run test:unit -- tests/unit/fixture-leaderboard.test.ts tests/unit/fixture-leaderboard-privacy.test.ts` -
  passed, 2 files / 16 tests.
- `meteor npm run test:integration -- imports/server/fixtureLeaderboards/fixtureLeaderboards.app-test.ts` -
  passed; launcher ran the full server app suite, 84 tests.
- `meteor npm run typecheck` - passed.
- `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=/home/pierreferreira/Desktop/rugby-predictor/test-results/ccpp011b-fixture-leaderboard meteor npm run test:e2e -- tests/e2e/fixture-leaderboard.spec.ts` -
  failed before Playwright reporter output and produced no screenshots.
- `meteor npm run test:e2e -- tests/e2e/fixture-leaderboard.spec.ts` -
  passed, 1 Chromium test.
- `meteor npm run test:unit -- tests/unit/fixture-leaderboard.test.ts tests/unit/fixture-leaderboard-privacy.test.ts tests/unit/player-fixture-score.test.ts tests/unit/scoring-engine.test.ts tests/unit/routes.test.ts` -
  passed after the final lint correction, 5 files / 65 tests.
- `meteor npm run typecheck` - passed after the final lint correction.
- `meteor npm run lint` - passed after the final lint correction.
- `meteor npm run lint:project` - passed after the final lint correction.
- `./node_modules/.bin/prettier --check <changed milestone docs/source/tests>` -
  passed after the final lint correction; generated `tsconfig.tsbuildinfo` was
  excluded.
- `git diff --check` - passed after the final lint correction.
- `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=/home/pierreferreira/Desktop/rugby-predictor/test-results/ccpp011b-fixture-leaderboard-final-20260920 meteor npm run test:e2e -- tests/e2e/fixture-leaderboard.spec.ts --workers=1 --retries=0` -
  first failed inside the sandbox before tests; `exit.json` recorded code 1,
  Playwright `.last-run.json` had no failed tests, and no screenshots were
  produced.
- The same final browser command rerun outside the sandbox passed, 1 Chromium
  test / 1 passed, with fresh evidence in
  `test-results/ccpp011b-fixture-leaderboard-final-20260920/`.

The full Meteor server integration suite was not rerun after the final lint
correction because only the UI page, browser spec, docs, and packaging evidence
changed. Retained prior result:
`meteor npm run test:integration -- imports/server/fixtureLeaderboards/fixtureLeaderboards.app-test.ts`
passed via the full server app launcher, 84 tests.

## Browser Evidence

Initial retained screenshots:

- `test-results/ccpp011b-fixture-leaderboard/provisional-desktop-leaderboard.png`
- `test-results/ccpp011b-fixture-leaderboard/tie-shared-place-state.png`
- `test-results/ccpp011b-fixture-leaderboard/current-user-highlight.png`
- `test-results/ccpp011b-fixture-leaderboard/final-desktop-leaderboard.png`
- `test-results/ccpp011b-fixture-leaderboard/mobile-390.png`
- `test-results/ccpp011b-fixture-leaderboard/mobile-360.png`

Final correction screenshots:

- `test-results/ccpp011b-fixture-leaderboard-final-20260920/provisional-desktop-leaderboard.png`
- `test-results/ccpp011b-fixture-leaderboard-final-20260920/tie-shared-place-state.png`
- `test-results/ccpp011b-fixture-leaderboard-final-20260920/current-user-highlight.png`
- `test-results/ccpp011b-fixture-leaderboard-final-20260920/final-desktop-leaderboard.png`
- `test-results/ccpp011b-fixture-leaderboard-final-20260920/mobile-390.png`
- `test-results/ccpp011b-fixture-leaderboard-final-20260920/mobile-360.png`

The focused browser journey verified provisional rows, shared places,
current-user highlight, result correction via Refresh without a page reload,
final rows with pending indicators removed, and no horizontal overflow at
390px and 360px. The final correction journey also verified same-page
navigation to a second published fixture does not retain the previous final
leaderboard rows or result revision.

## EOMD Package

Archive:

- `rugby-rooster-ccpp011b-fixture-leaderboard-eomd-20260920.zip`

The package was built from an explicit include list covering leaderboard shared
types/ranking/privacy code, server service/method/test helper, UI page/routes,
relevant CCPP-011A player fixture-score context, unit tests, integration tests,
focused browser spec, final browser evidence, README/AGENTS, and milestone
docs.

Packaging verification:

- `unzip -t rugby-rooster-ccpp011b-fixture-leaderboard-eomd-20260920.zip` -
  passed with no compressed-data errors.
- `zipinfo -1 rugby-rooster-ccpp011b-fixture-leaderboard-eomd-20260920.zip` -
  confirmed source, tests, docs, and final screenshots were present.
- Final screenshot files opened/validated before packaging.
- The repository worktree remained intact; packaging copied/archived files only.
- After the audit/checkpoint packaging notes were added, the archive was
  refreshed and `unzip -t` passed again with no compressed-data errors.

The explicit include list avoided credentials, private settings, `node_modules`,
`.meteor/local`, build caches, unrelated animation evidence, old browser
evidence directories, and old archives.

## Not Implemented

- CCPP-011C score breakdown UI.
- Leagues, tournaments, average scores, cumulative standings, prizes, or QR
  redemption.
- AI commentary.
- Persistent ranking/score cache.
- Leaderboard animations.
