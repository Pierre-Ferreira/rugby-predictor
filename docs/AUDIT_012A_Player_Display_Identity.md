# CCPP-012A Player Display Identity Audit

## Scope

CCPP-012A adds one owner-editable public display name for verified Rugby
Rooster players after accepted CCPP-011C.

Out of scope: leagues, social features, avatars, public profile pages, handles,
onboarding gates, moderation workflows, duplicate-name UI, score-breakdown
redesign, visual-system overhaul, and animation work.

## Implementation

- Added shared player identity contracts under `imports/shared/playerProfiles/`.
- Added server-owned `player_profiles` collection with unique `userId` index.
- Added denied direct client writes for the new collection.
- Added owner-only methods:
  - `playerProfiles.getMine`
  - `playerProfiles.updateMine`
- Added server-side display-name validation and narrow reserved-name handling.
- Added reusable batch resolver
  `resolvePublicPlayerIdentities(userIds)`.
- Integrated the resolver into fixture leaderboard loading.
- Preserved current-user leaderboard label `You`.
- Preserved fixture-scoped `Rooster XXXXXXXX` fallback aliases for players with
  no display name.
- Added a compact public-name editor to `/account`.
- Added focused unit, integration, and browser coverage.

## Persistence Model

CCPP-012A uses a dedicated `player_profiles` collection instead of
`Meteor.user().profile`.

Stored fields:

- `userId`
- `displayName`
- `createdAt`
- `updatedAt`

The collection does not store account email addresses, passwordless data, role
data, or leaderboard aliases. Name changes are derived by fresh reads; no
prediction, score, result, or leaderboard data is rewritten.

## Validation

Display names are strings that are trimmed and whitespace-normalized. The
accepted length is 2-30 visible characters. Blank-only values and control
characters are rejected. Unicode names such as `José` are preserved.

Global uniqueness is not enforced. Duplicate display names are allowed.

Reserved-name handling is deliberately narrow and rejects exact normalized
matches for `Rugby Rooster`, `Admin`, `Administrator`, and `System`.

## Privacy Boundary

Client-facing profile projection is:

```ts
{
  displayName: string | null;
}
```

It does not expose email, raw user documents, user IDs, roles, auth metadata,
login service data, or passwordless details.

Leaderboard responses continue to expose only row-level presentation fields.
They do not serialize email, raw user IDs, prediction payloads, roles, services,
passwordless data, or raw result documents.

## Leaderboard Behaviour

For another player:

- if a public display name exists, show it;
- otherwise show the fixture-scoped `Rooster XXXXXXXX` alias.

For the signed-in current player, the primary visible label remains `You` with
the existing `YOU` badge. CCPP-012A did not add secondary current-user name UI
because the compact leaderboard layout is already clear.

Duplicate display names remain separate rows through existing opaque row IDs,
and ranking semantics are unchanged.

## Browser Evidence

Retained final evidence:

- `test-results/ccpp012a-player-identity-final-20260921/account-public-player-name-desktop.png`
- `test-results/ccpp012a-player-identity-final-20260921/account-public-player-name-390.png`
- `test-results/ccpp012a-player-identity-final-20260921/account-public-player-name-390-near-max.png`
- `test-results/ccpp012a-player-identity-final-20260921/leaderboard-display-names-desktop.png`
- `test-results/ccpp012a-player-identity-final-20260921/leaderboard-display-names-390.png`
- `test-results/ccpp012a-player-identity-final-20260921/leaderboard-display-names-360.png`

The focused browser journey verified:

- verified player Account editing with `Pierre`;
- success feedback and normalized saved value;
- Account public-name section at desktop and 390px;
- another competitor shown as `Alice`;
- another competitor without a profile shown as `Rooster XXXXXXXX`;
- current signed-in player retained `You` treatment;
- `Pierre` changed to `Pete`;
- `playerProfiles.getMine` returned the safe projection with `Pete`;
- leaderboard did not show the test email;
- a near-max valid name, `Thabo Mokoena Scrum Captain`, saved and fit at 390px;
- no horizontal overflow at Account 390px and leaderboard 390px/360px.

An initial sandbox Playwright launch exited before reporter output and produced
no screenshots. The same focused browser command rerun outside the sandbox
passed. Two subsequent browser attempts exposed test-selector issues only;
after selector fixes, the final retained run passed.

## Verification

Final checks on the current source:

- `meteor npm run test:unit -- tests/unit/player-identity.test.ts tests/unit/fixture-leaderboard-privacy.test.ts` -
  passed, 2 files / 24 tests.
- `meteor npm run test:integration -- imports/server/playerProfiles/playerProfiles.app-test.ts` -
  passed via the full server app launcher, 95 tests.
- `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=/home/pierreferreira/Desktop/rugby-predictor/test-results/ccpp012a-player-identity-final-20260921 meteor npm run test:e2e -- tests/e2e/player-identity.spec.ts --workers=1 --retries=0` -
  final rerun outside the sandbox passed, 1 Chromium test / 1 passed.
- `meteor npm run typecheck` - passed.
- `meteor npm run lint` - passed.
- `meteor npm run lint:project` - passed.
- `./node_modules/.bin/prettier --check <changed CCPP-012A docs/source/tests>` -
  passed.
- `git diff --check` - passed.

The first evidence-mode browser command exited inside the sandbox before
reporter output and screenshots; `.last-run.json` had no failed tests. The
focused browser command was rerun outside the sandbox. Two intermediate browser
runs then exposed test-selector issues only; the final retained run after the
Account loading-state lint refactor passed and refreshed the screenshots.

## EOMD Package

Archive:

- `rugby-rooster-ccpp012a-player-display-identity-eomd-20260921.zip`

The package was built from an explicit staging include list covering profile
persistence/domain contracts, public identity resolver, server methods/test
support, Account UI changes, leaderboard label integration, focused unit and
server integration tests, focused browser spec, retained screenshots, browser
result metadata, updated docs, `README.md`, and `AGENTS.md`.

Packaging verification:

- `unzip -t rugby-rooster-ccpp012a-player-display-identity-eomd-20260921.zip` -
  passed with no compressed-data errors.
- `zipinfo -1 rugby-rooster-ccpp012a-player-display-identity-eomd-20260921.zip` -
  confirmed source, tests, docs, and final screenshots were present.
- Screenshot files validated with `file`:
  - Account desktop section: `1038x264`.
  - Account 390px section: `308x336`.
  - Account 390px near-max name section: `308x336`.
  - Leaderboard desktop: `1280x969`.
  - Leaderboard 390px: `390x1166`.
  - Leaderboard 360px: `360x1166`.
- An initial build briefly contained empty `.git/`, `.agents/`, and `.codex/`
  directory entries from the staging context; those archive entries were
  removed before final verification.
- The final archive excludes credentials, raw captured emails, login links,
  private settings, `node_modules`, `.meteor/local`, caches/builds, unrelated
  historical evidence, failure traces/videos, and old archives.
- Original repository files remained in place; packaging copied/archived only.

## Not Implemented

- Leagues, public league standings, friends, or social graph features.
- Handles, username claiming, or unique-name availability.
- Avatars, profile pages, or public profile browsing.
- Admin profile editing.
- Moderation workflows, profanity filtering, or fuzzy impersonation detection.
- Display-name migration into predictions, score projections, results, or
  persisted leaderboard data.
- Animation or visual-system redesign.
