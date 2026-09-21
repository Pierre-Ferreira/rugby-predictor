# TEMP 012B1 Resume

Status: complete on 2026-09-21.

## Established State

- `AGENTS.md` was read and Rugby Rooster remains a standalone product.
- Current git status/diff was inspected after the remote-compaction failure.
- `docs/MAP_Rooster_Assets.md` had no CCPP-012B1 diff before this
  continuation; it still described the older CCPP-012B temporary run/push-frame
  static mood mapping.
- The approved mascot integration and colour alignment work was preserved.
- Mascot extraction was not restarted, approved artwork was not regenerated, and
  player pages were not redesigned again.

## Preserved Source Art

Approved CCPP-012B1 mascot source art is preserved unchanged under
`assets/source/rooster/personality/`:

- `rooster-canonical-confident-source.png`
- `rooster-expression-sheet-1-source.png`
- `rooster-expression-sheet-2-source.png`
- `rooster-super-cooked-source.png`

The canonical mascot direction remains the beer-bellied Rugby Rooster with
green rugby jersey, tan/golden feathers, red comb, and cobalt/deep-blue tail.

## Prepared Runtime Assets

Prep script:

- `scripts/prepare-rooster-personality-assets.mjs`

Runtime output:

- `public/assets/rooster/personality/`
- `public/assets/rooster/personality/personality-manifest.json`

Prepared personality PNGs:

- `rooster-confident.png`
- `rooster-thinking.png`
- `rooster-celebrating.png`
- `rooster-nervous.png`
- `rooster-shocked.png`
- `rooster-disappointed.png`
- `rooster-tantrum.png`
- `rooster-crying.png`
- `rooster-cooked.png`
- `rooster-super-cooked.png`

Runtime metadata inspection found all generated personality PNGs present with
`srgba` channels and non-zero dimensions. The Super-Cooked runtime output is
`640 x 460 sRGBA`; the manifest records the tightened source crop that removed
headline/underline contamination.

## Current Mood Map

`RugbyRoosterPersonality` maps the approved personality moods to:

- `confident` -> `/assets/rooster/personality/rooster-confident.png`
- `thinking` -> `/assets/rooster/personality/rooster-thinking.png`
- `celebrating` -> `/assets/rooster/personality/rooster-celebrating.png`
- `nervous` -> `/assets/rooster/personality/rooster-nervous.png`
- `shocked` -> `/assets/rooster/personality/rooster-shocked.png`
- `disappointed` -> `/assets/rooster/personality/rooster-disappointed.png`
- `tantrum` -> `/assets/rooster/personality/rooster-tantrum.png`
- `crying` -> `/assets/rooster/personality/rooster-crying.png`
- `cooked` -> `/assets/rooster/personality/rooster-cooked.png`
- `superCooked` -> `/assets/rooster/personality/rooster-super-cooked.png`
- `running` -> `/assets/rooster/match-result/frames/rooster-run-1.png`

No non-running mood should map back to old run/push frames. The accepted Match
Result run/push files remain animation-specific, with `running` kept only as an
explicit action/match-day mood.

The current size API is `compact`, `standard`, and `hero`.

## Page Usage To Preserve

- Home: `confident`.
- Games: `running` for upcoming fixtures and `thinking` for past fixtures.
- Game Detail: `thinking`.
- Prediction: `confident` when open and `thinking` for locked/intro/static
  states where appropriate.
- Leaderboard: state-specific expression art, not automatic celebration for
  every final leaderboard.
- My Score: score/status-derived confident, nervous, celebrating,
  disappointed, cooked, Super-Cooked, thinking, or shocked behavior.
- Account: `confident`.
- Error/empty states: currently mapped `thinking`/`tantrum` treatments.

## Colour Alignment To Preserve

Semantic tokens remain the `--rr-*` architecture. Approved palette:

- Field Green: `0 109 67`
- Gold: `242 190 70`
- Rooster Red: `202 46 38`
- Cobalt Blue: `0 87 184`
- Cream: `255 248 230`
- Tan Feather: `214 169 93`
- Charcoal: `24 31 38`

Green remains the dominant brand anchor, Cream the readable base, and
Gold/Red/Blue/Tan deliberate accents. Home keeps the stronger green hero
treatment. Typography was not redesigned in this continuation.

## Documentation Status

Created or updated in this continuation:

- `docs/AUDIT_012B1_Mascot_Colour_Alignment.md`
- `docs/TEMP_012B1_Resume.md`
- `docs/MAP_Rooster_Assets.md`
- `docs/PLATFORM_Rooster_Personality.md`
- `docs/PLATFORM_Visual_Identity.md`
- `docs/MAP_System.md`
- `docs/CORE_Product.md`
- `docs/PLATFORM_Testing.md`
- `docs/CORE_Build_Plan.md`

## Browser Evidence

Retained final browser evidence:

- `test-results/ccpp012b1-mascot-colour-alignment-final-correction/`

Run history:

- Sandboxed launcher attempt wrote
  `test-results/ccpp012b1-mascot-colour-alignment-final/` and exited before
  Playwright executed tests; no failed tests or screenshots were recorded.
- First authorized batch wrote
  `test-results/ccpp012b1-mascot-colour-alignment-final-authorized/` and
  exposed a spec defect: the saved-entry Prediction Review state correctly used
  `confident`, while the spec expected `thinking`.
- One permitted correction batch wrote the retained final evidence directory and
  passed, `1` Chromium test / `1` passed.

Final screenshots include desktop Home, Games, Game Detail, Prediction,
Leaderboard, My Score, Account, plus mobile Home 390px, Games 390px,
Leaderboard 360px, My Score 360px, and Account 390px. The batch also captured
mobile Game Detail and safe empty/error desktop states.

## Verification Status

Completed at this checkpoint:

- `meteor npm run test:unit -- --run tests/unit/player-identity.test.ts tests/unit/player-visual.test.ts`
  - passed before browser, `2` files / `39` tests.
- Focused browser correction batch:
  `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=test-results/ccpp012b1-mascot-colour-alignment-final-correction meteor npm run test:e2e -- tests/e2e/visual-foundation-personality.spec.ts --workers=1 --retries=0`
  - passed, `1` Chromium test / `1` passed.
- `meteor npm run test:unit -- --run tests/unit/player-identity.test.ts tests/unit/player-visual.test.ts`
  - passed after browser, `2` files / `39` tests.
- `meteor npm run typecheck` - passed.
- `meteor npm run lint` - passed cleanly after the prep script switched its two
  informational logs to `console.info`.
- `meteor npm run lint:project` - passed.
- Changed-file Prettier check with `meteor npm exec prettier -- --check ...` -
  passed after mechanical formatting.
- `git diff --check` - passed.

## EOMD Package

Archive:

- `rugby-rooster-ccpp012b1-mascot-colour-alignment-eomd-20260921.zip`

Verification:

- `unzip -t rugby-rooster-ccpp012b1-mascot-colour-alignment-eomd-20260921.zip`
  - passed.
- `zipinfo -t rugby-rooster-ccpp012b1-mascot-colour-alignment-eomd-20260921.zip`
  - confirmed `70` files.
- Representative packaged personality PNGs and screenshots opened with
  `identify` from the ZIP stream.
- All asset paths referenced by `RugbyRoosterPersonality` resolve to files under
  `public/`.
- The archive includes final retained evidence only:
  `test-results/ccpp012b1-mascot-colour-alignment-final-correction/`.
- The archive does not include the failed sandbox launcher or first authorized
  failed-spec evidence directories.

## Next Action

No next 012B1 action remains. Do not begin new animation, league, AI, venue,
prize, avatar, or Admin visual-overhaul work from this checkpoint.
