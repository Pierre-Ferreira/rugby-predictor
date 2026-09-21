# CCPP-012B Visual Foundation And Personality Audit

## Scope

CCPP-012B establishes the Rugby Rooster player-facing visual foundation and
closes the accepted CCPP-012A display-name validation hardening item.

Feature expansion stayed paused. This milestone did not add leagues, venue
competitions, prizes, AI commentary, avatars, quiz gameplay, new prediction
animations, or more backend scoring features.

## 012A Validation Hardening Closure

Completed within CCPP-012B:

- `validatePlayerDisplayName(...)` now rejects Unicode format-control
  characters with `\p{Cf}` in addition to existing `\p{Cc}` rejection.
- Focused tests cover:
  - U+200B ZERO WIDTH SPACE;
  - U+202E RIGHT-TO-LEFT OVERRIDE;
  - U+2060 WORD JOINER.
- Existing trim, whitespace normalization, visible length, Unicode diacritics,
  and narrow reserved-name behaviour are preserved.
- No profanity, moderation, fuzzy impersonation, uniqueness, handle, or avatar
  tooling was added.

## Implementation

- Added semantic `--rr-*` colour tokens and Tailwind `rr.*` aliases:
  background, surface, raised surface, border, text, muted text, brand,
  stronger brand, accent, danger, warning, success, and info.
- Preserved player-facing prediction semantics for Yellow and Red Cards while
  using green as the stronger primary action colour.
- Added a compact typography hierarchy for page titles, fixture/team titles,
  section headings, uppercase eyebrows, meta labels, body copy, and score/state
  explanations.
- Added shared player-facing shell, surface, loading, empty, error, status, and
  button styling.
- Added reusable player components under `imports/ui/components/player/`.
- Added typed static Rooster mood catalog and `RugbyRoosterPersonality`.
- Added display-only player fixture status helpers for `Prediction open`,
  `Locked`, and `Cancelled`.
- Updated player-facing pages:
  - Home;
  - Games;
  - Game Detail;
  - Prediction shell/Intro/progress/Review framing;
  - Fixture Leaderboard;
  - My Score Breakdown;
  - Account.
- Hid player-facing `Result revision N` on the leaderboard while retaining the
  projection field internally.
- Left Admin visual redesign deferred.

## Shared Visual System

Core source:

- `client/main.css`
- `tailwind.config.cjs`
- `imports/ui/components/player/PlayerPrimitives.tsx`
- `imports/ui/components/player/RugbyRoosterPersonality.tsx`
- `imports/ui/components/player/StatusBadge.tsx`
- `imports/ui/fixtures/fixtureUi.ts`

Player-page primitives now cover:

- `PlayerPage`
- `PlayerPageHeader`
- `PlayerSurface`
- `PlayerEmptyState`
- `PlayerLoadingState`
- `PlayerErrorState`
- `StatusBadge`

Buttons use shared primary, secondary, ghost, and danger classes. Status badges
use textual labels plus tone classes rather than colour-only communication.
Loading, empty, and error states use consistent shells and retain useful
messages; error states add light Rooster personality without hiding the retry
action.

The mascot-use limit is one strong Rooster placement per page/state in ordinary
player flows. Leaderboard and My Score avoid duplicate header mascots when the
state summary already carries the personality placement.

## Rooster Asset Inventory

Active static UI assets are the prepared Match Result run/push frames and the
192px app icon fallback. There are no standalone expression assets for cooked,
crying, tantrum, shocked, or similar named expressions, so CCPP-012B maps a
small mood catalog to available still frames only.

The historical atlas and source sheets remain documented but are not loaded for
page personality.

Actual supported mood mapping:

| Mood           | Asset                                                    |
| -------------- | -------------------------------------------------------- |
| `confident`    | `/assets/rooster/match-result/frames/rooster-run-1.png`  |
| `thinking`     | `/assets/rooster/match-result/frames/rooster-run-2.png`  |
| `nervous`      | `/assets/rooster/match-result/frames/rooster-run-3.png`  |
| `waiting`      | `/assets/rooster/match-result/frames/rooster-run-4.png`  |
| `shocked`      | `/assets/rooster/match-result/frames/rooster-push-1.png` |
| `disappointed` | `/assets/rooster/match-result/frames/rooster-push-2.png` |
| `celebrating`  | `/assets/rooster/match-result/frames/rooster-push-4.png` |
| `neutral`      | `/icons/rr-icon-192.png`                                 |

`rooster-push-3.png`, the atlas, and the generated manifests remain
animation-specific or historical runtime assets, not static mood mappings.

## Player-Facing Route Changes

- Home now presents the current prediction/leaderboard journey with a stronger
  Rugby Rooster identity.
- Games now reads as match-day fixture cards rather than a plain CRUD list.
- Game Detail now has a match hero with competition/kickoff/status emphasis.
- Prediction keeps accepted mechanics while refreshing the shell, Intro,
  progress, feedback, and Review framing.
- Leaderboard now has clearer competitive hierarchy, current-player emphasis,
  provisional/final states, and hidden ordinary-player result revision text.
- My Score now presents the score summary and item detail as stacked
  explanation instead of a wide accounting table.
- Account now separates public player identity from private account/email
  identity.
- Shared signed-out, access-denied, loading, empty, and recoverable error
  treatments use the same visual system.

## Browser Evidence

Final retained evidence directory:

- `test-results/ccpp012b-visual-foundation-personality-final/`

Desktop screenshots:

- `desktop-home.png`
- `desktop-games.png`
- `desktop-game-detail.png`
- `desktop-prediction.png`
- `desktop-leaderboard-provisional.png`
- `desktop-leaderboard-final.png`
- `desktop-my-score.png`
- `desktop-account.png`

Additional desktop state screenshots:

- `desktop-empty-fixture-not-found.png`
- `desktop-error-retry.png`

Mobile screenshots:

- `mobile-390-games.png`
- `mobile-390-game-detail.png`
- `mobile-360-leaderboard.png`
- `mobile-360-my-score.png`
- `mobile-390-account.png`

The Games screenshots include older unowned local fixture-test data that the
current isolated reset helpers do not delete. The visual layout evidence still
shows the intended fixture-card treatment and mobile overflow checks.

No further screenshot-polish loop was performed after the accepted final
inspection.

## Visual Acceptance Answers

- Does this look like Rugby Rooster or generic SaaS? It reads more Rugby
  Rooster than before through the green/gold/red palette, fixture-card match
  treatment, bold rugby headings, and controlled mascot presence.
- Is the Rooster visible enough to create personality? Yes, page headers and
  key states show one visible character placement.
- Is the mascot overused? Mostly no. Header duplication was removed from
  Leaderboard and My Score so state-specific placements carry those pages.
- Are primary actions obvious? Yes. Primary actions use green buttons, with
  secondary actions in bordered surfaces.
- Do fixtures feel like matches rather than records? Yes. Cards now emphasize
  teams, `vs`, kickoff, competition, and status.
- Does Leaderboard feel competitive? Yes. Place, player, score, current-user,
  and winner emphasis are clearer, and final state feels decisive.
- Does My Score feel explanatory rather than accounting-heavy? Improved. It is
  still long because it shows authoritative detail, but rows stack as
  explanation blocks instead of a wide table.
- Are mobile layouts still clean? Yes. The focused browser test checked no
  horizontal overflow at 390px and 360px for the requested mobile pages.
- Is the colour hierarchy coherent? Yes. Primary green leads actions, red is
  used for personality/attention, gold is restrained, and status tones remain
  text-labelled.
- Is yellow/red still unambiguous for Cards? Yes. Prediction Cards styles retain
  distinct yellow/red card markers and were not redesigned.

## Verification

Completed before this audit text was finalized:

- `meteor npm run test:unit -- tests/unit/player-identity.test.ts tests/unit/player-visual.test.ts` -
  passed, 2 files / 28 tests.
- `meteor npm run typecheck` - passed after the new visual spec type
  declaration was aligned.
- Initial sandboxed browser evidence command exited before running tests and
  produced no screenshots; `.last-run.json` had no failed tests.
- First outside-sandbox browser run reached the app and exposed a visual-spec
  precondition issue: historical unowned fixtures meant `/games` was not empty.
  The spec was corrected to capture fixture-not-found as the safe empty state.
- Final focused browser run:
  `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=/home/pierreferreira/Desktop/rugby-predictor/test-results/ccpp012b-visual-foundation-personality-final meteor npm run test:e2e -- tests/e2e/visual-foundation-personality.spec.ts --workers=1 --retries=0` -
  passed, 1 Chromium test / 1 passed.

## Static Closeout

Executed during the 2026-09-21 closeout continuation against current source:

- `meteor npm run test:unit -- tests/unit/player-identity.test.ts tests/unit/player-visual.test.ts` -
  passed, 2 files / 28 tests.
- `meteor npm run typecheck` - passed.
- `meteor npm run lint` - passed after two narrow React-rule cleanup edits:
  `RugbyRoosterPersonality` now tracks failed image source without a synchronous
  effect reset, and Game Detail captures its status timestamp through state
  initialization rather than calling `Date.now()` during render.
- `meteor npm run lint:project` - passed; project invariant check passed.
- Changed-file Prettier check with `meteor npm exec prettier -- --check ...` -
  passed after formatting Markdown docs.
- `git diff --check` - passed.

No browser tests were rerun during static closeout. The retained browser
screenshots predate the two lint-only presentation source cleanups above; no
visual-polish loop was restarted.

## EOMD Package

Archive target:

- `rugby-rooster-ccpp012b-visual-foundation-personality-eomd-20260921.zip`

Package contents:

- semantic visual tokens/CSS;
- shared player UI components;
- `RugbyRoosterPersonality` source and mood map;
- actual personality assets used by the mood map;
- updated player pages;
- display-name `\p{Cf}` hardening source and focused tests;
- focused visual/identity unit tests;
- focused browser visual spec;
- retained final screenshot evidence;
- docs, including this audit and the 012B resume checkpoint;
- command/check summary through the Verification and Static Closeout sections.

Package verification performed:

- `unzip -t rugby-rooster-ccpp012b-visual-foundation-personality-eomd-20260921.zip` -
  passed with no compressed-data errors.
- `unzip -l rugby-rooster-ccpp012b-visual-foundation-personality-eomd-20260921.zip` -
  confirmed source, tests, docs, retained final evidence, and used personality
  assets are included.
- The archive was extracted to `/tmp/rr012b-eomd-verify.GBKNh2`, and `file`
  identified the required desktop/mobile/evidence-state screenshots as PNG
  image data.
- `file` identified the packaged mood-map assets as PNG image data:
  `rooster-run-1.png` through `rooster-run-4.png`,
  `rooster-push-1.png`, `rooster-push-2.png`, `rooster-push-4.png`, and
  `rr-icon-192.png`.
- Repository checks confirmed those same asset paths referenced by
  `RugbyRoosterPersonality` exist in the original workspace.
- Negative archive checks found no `assets/source/rooster/` source sheets,
  `node_modules`, or `.meteor/local` entries.
- The original repository files remained in place; packaging copied/archived
  files only.

## Not Implemented

- Leagues, venues, prizes, sponsorships, AI, avatars, profile pages, or quiz
  gameplay.
- New animation systems, page transitions, mascot animation framework, or
  regenerated art.
- Backend scoring, prediction semantics, fixture lifecycle, auth, identity
  privacy, leaderboard ranking, or score-breakdown math changes.
- Detailed Admin visual overhaul.
