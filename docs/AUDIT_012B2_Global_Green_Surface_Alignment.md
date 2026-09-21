# CCPP-012B2 Global Green Surface Alignment Audit

## Scope

CCPP-012B2 aligns the main player-facing Rugby Rooster surfaces around the
approved Field Green Home hero treatment and adds alternating green/gold fixture
leaderboard rows.

This was a visual alignment pass only. It did not change prediction logic,
scoring logic, leaderboard calculation logic, routing, publications, Meteor
methods, auth behavior, fixture workflows, mascot artwork, animation behavior,
or Admin workflows.

## Implementation

- Promoted the shared `rr-page-header` player primitive to use the approved
  Home-style Field Green surface, Cream copy, Gold bottom stroke, Rooster Red
  side accent, and green-header button treatment.
- Kept data-heavy content, fixture cards, score details, and normal panels on
  light Cream/white surfaces for readability.
- Adjusted shared header-specific badge, `vs`, ghost-button, secondary-button,
  and mascot-message styling so the green top sections remain legible.
- Changed shared section eyebrows from Rooster Red to Field Green to reduce
  red overuse and keep red reserved for attention/current-user/error moments.
- Added `rr-leaderboard-row` classes with soft green/gold alternating row
  tones based on rendered row index.
- Preserved the current-player `YOU` badge and layered the current-user row
  emphasis over the alternating row tone.
- Preserved winner emphasis without changing ranking, shared-place behavior, or
  leaderboard data.
- Extended `tests/e2e/visual-foundation-personality.spec.ts` to assert:
  - shared green page-header background and cream text;
  - desktop leaderboard green/gold row alternation;
  - mobile leaderboard green/gold row alternation;
  - visible `YOU` current-player indication;
  - desktop Games Upcoming and Past screenshots;
  - existing horizontal-overflow checks on every screenshot capture.

## Updated Documentation

- `docs/PLATFORM_Visual_Identity.md`
- `docs/PLATFORM_Fixture_Leaderboard.md`
- `docs/CORE_Product.md`
- `docs/CORE_Build_Plan.md`
- `docs/MAP_System.md`

## Browser Evidence

Final retained evidence directory:

- `test-results/ccpp012b2-global-green-surface-alignment-authorized/`

Desktop screenshots:

- `desktop-home.png`
- `desktop-games-upcoming.png`
- `desktop-games-past.png`
- `desktop-game-detail.png`
- `desktop-prediction.png`
- `desktop-leaderboard-provisional.png`
- `desktop-leaderboard-final.png`
- `desktop-my-score.png`
- `desktop-account.png`
- `desktop-empty-fixture-not-found.png`
- `desktop-error-retry.png`

Mobile screenshots:

- `mobile-390-home.png`
- `mobile-390-games.png`
- `mobile-390-game-detail.png`
- `mobile-360-leaderboard.png`
- `mobile-360-my-score.png`
- `mobile-390-account.png`

The Games captures include older unowned local fixture-test records that are not
removed by the current isolated reset helpers. The requested visual acceptance
points are still visible: green top surface, readable fixture cards, normal and
cancelled/locked status badges, responsive wrapping, and no horizontal overflow.

## Visual Review Notes

- Home still preserves the approved green hero treatment.
- Games Upcoming and Past now share the same green-led header treatment and keep
  fixture cards readable on light surfaces.
- Fixture Detail, Prediction, Fixture Leaderboard, My Score Breakdown, and
  Account inherit the green page-header surface from the shared primitive.
- Leaderboard rows visibly alternate green, gold, green, gold by rendered row
  order on desktop and mobile.
- The current-player row remains easy to find through the `YOU` badge and the
  stronger inset emphasis.
- My Score keeps the score summary, metric boxes, and breakdown rows readable on
  light surfaces.
- Mobile Games, Leaderboard, and My Score stack cleanly without horizontal
  overflow in the focused browser run.

## Verification

Completed:

- `meteor npm exec prettier -- --write client/main.css imports/ui/pages/FixtureLeaderboardPage.tsx tests/e2e/visual-foundation-personality.spec.ts docs/PLATFORM_Visual_Identity.md docs/PLATFORM_Fixture_Leaderboard.md docs/CORE_Product.md docs/CORE_Build_Plan.md docs/MAP_System.md`
  - completed; files were already formatted.
- `meteor npm run typecheck`
  - passed.
- `meteor npm run test:unit -- --run tests/unit/player-visual.test.ts tests/unit/fixture-leaderboard.test.ts`
  - passed, 2 files / 30 tests.
- `meteor npm run lint`
  - passed.
- `meteor npm run lint:project`
  - passed; project invariant check passed.
- `meteor npm exec prettier -- --check client/main.css imports/ui/pages/FixtureLeaderboardPage.tsx tests/e2e/visual-foundation-personality.spec.ts docs/PLATFORM_Visual_Identity.md docs/PLATFORM_Fixture_Leaderboard.md docs/CORE_Product.md docs/CORE_Build_Plan.md docs/MAP_System.md docs/AUDIT_012B2_Global_Green_Surface_Alignment.md`
  - passed.
- `git diff --check`
  - passed.
- First sandboxed browser evidence command:
  `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=test-results/ccpp012b2-global-green-surface-alignment meteor npm run test:e2e -- tests/e2e/visual-foundation-personality.spec.ts --workers=1 --retries=0`
  - exited with code `1` after about 1.75 seconds before Playwright produced
    reporter output or screenshots; nested `.last-run.json` recorded
    `"failedTests": []`.
- Authorized browser evidence command:
  `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=test-results/ccpp012b2-global-green-surface-alignment-authorized meteor npm run test:e2e -- tests/e2e/visual-foundation-personality.spec.ts --workers=1 --retries=0`
  - passed, 1 Chromium test / 1 passed.

No unresolved CCPP-012B2 product decisions were introduced.
