# CCPP-012A Resume Checkpoint

## Current State

- Inspected docs so far: `AGENTS.md`, `PLATFORM_Authentication.md`,
  `PLATFORM_Fixture_Leaderboard.md`,
  `AUDIT_011B_Fixture_Leaderboard.md`,
  `PLATFORM_Player_Score_Breakdown.md`, `CORE_Product.md`,
  `CORE_Predictions.md`, `PLATFORM_Testing.md`, `MAP_System.md`, and
  `CORE_Build_Plan.md`.
- Existing account model is Meteor users with passwordless email identity,
  verified-email authorization, and server-owned `roles.platformAdmin`.
- No safe public display-name model is documented in the inspected platform
  docs. CCPP-011B explicitly records fixture-scoped `Rooster XXXXXXXX` aliases
  as temporary because no explicit public identity field existed.

## Chosen Persistence Model

- Implemented model: a small server-owned `player_profiles` collection with one
  document per user.
- Implemented fields: `userId`, `displayName`, `createdAt`, `updatedAt`.
- Implemented index: unique `userId`.
- Implemented write policy: deny direct client insert/update/remove; mutate only
  through authenticated verified-player methods.
- Email and fallback aliases will not be duplicated into this collection.

## Display-Name Validation

- Implemented contract: trim, collapse repeated whitespace, 2-30 visible
  characters, reject blank-only values, reject control characters, preserve
  normal Unicode names/nicknames.
- Implemented narrow reserved normalized names: `Rugby Rooster`, `Admin`,
  `Administrator`, `System`.
- No global uniqueness, handles, profanity filtering, or moderation workflow in
  this milestone.

## Public Projection Shape

- Implemented safe projection: `PublicPlayerIdentity` with
  `displayName: string | null`.
- It must not expose email, raw Meteor user documents, user IDs to client
  consumers, roles, auth metadata, login service data, or passwordless details.

## Leaderboard Integration Point

- Existing leaderboard projection already accepted server-provided player labels
  and emitted only `displayLabel`.
- Implemented integration: `resolvePublicPlayerIdentities(userIds)` performs
  one batch `player_profiles` query, then the leaderboard service prefers a
  public display name for non-current players while preserving `You` for the
  current player and `Rooster XXXXXXXX` aliases as fallback.

## Tests / Results

- `meteor npm run test:unit -- tests/unit/player-identity.test.ts tests/unit/fixture-leaderboard-privacy.test.ts` -
  passed, 2 files / 24 tests.
- `meteor npm run test:integration -- imports/server/playerProfiles/playerProfiles.app-test.ts` -
  passed via the full server app launcher, 95 tests.
- Initial evidence-mode Playwright launch inside the sandbox exited before
  reporter output and screenshots; `.last-run.json` had no failed tests.
- Final focused browser command outside the sandbox passed:
  `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=/home/pierreferreira/Desktop/rugby-predictor/test-results/ccpp012a-player-identity-final-20260921 meteor npm run test:e2e -- tests/e2e/player-identity.spec.ts --workers=1 --retries=0`,
  1 Chromium test / 1 passed.
- `meteor npm run typecheck` - passed.
- `meteor npm run lint` - passed.
- `meteor npm run lint:project` - passed.
- `./node_modules/.bin/prettier --check <changed CCPP-012A docs/source/tests>` -
  passed.
- `git diff --check` - passed.

## Browser Budget

- Used: one focused CCPP-012A browser journey retained after selector fixes.
- Evidence directory:
  `test-results/ccpp012a-player-identity-final-20260921/`.
- Screenshots:
  `account-public-player-name-desktop.png`,
  `account-public-player-name-390.png`,
  `account-public-player-name-390-near-max.png`,
  `leaderboard-display-names-desktop.png`,
  `leaderboard-display-names-390.png`, and
  `leaderboard-display-names-360.png`.

## Exact Next Action

- CCPP-012A implementation and verification are complete.
- EOMD archive:
  `rugby-rooster-ccpp012a-player-display-identity-eomd-20260921.zip`.
- `unzip -t` passed with no compressed-data errors, and `zipinfo -1`
  confirmed the expected source, tests, docs, and final screenshots. Empty
  `.git/`, `.agents/`, and `.codex/` archive entries from the first build were
  removed before final verification.
- Stop after CCPP-012A. Do not begin leagues, social features, avatars,
  handles, public profile pages, visual-system overhaul, or animation work.
