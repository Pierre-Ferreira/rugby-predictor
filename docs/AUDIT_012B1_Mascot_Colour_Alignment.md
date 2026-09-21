# CCPP-012B1 Mascot Colour Alignment Audit

## Scope

CCPP-012B1 closes the mascot asset, colour alignment, browser evidence, and EOMD
handoff work for the player-facing visual foundation.

This continuation preserved the already-approved mascot integration. It did not
restart mascot extraction, regenerate approved artwork, redesign the player
pages again, or begin another visual milestone.

Out of scope:

- new animation work;
- replacement of the accepted Match Result run/push animation;
- mascot redesign or new generated art;
- leagues, venues, prizes, sponsorships, AI, avatars, profile pages, quiz
  gameplay, backend scoring changes, or Admin visual overhaul.

## State Established After Compaction

Read and reconciled:

- `AGENTS.md`;
- `docs/TEMP_012B1_Resume.md`;
- current git status and diff;
- `scripts/prepare-rooster-personality-assets.mjs`;
- `public/assets/rooster/personality/personality-manifest.json`;
- runtime PNG metadata under `public/assets/rooster/personality/`;
- `imports/ui/components/player/RugbyRoosterPersonality.tsx`;
- `docs/PLATFORM_Visual_Identity.md`;
- `docs/PLATFORM_Rooster_Personality.md`;
- `docs/MAP_Rooster_Assets.md`.

The exact `docs/MAP_Rooster_Assets.md` change had not landed before the remote
compaction failure. The file still documented the older CCPP-012B temporary
run/push-frame mood mapping. This audit and the updated map record the current
CCPP-012B1 asset classification.

## Approved Source Preservation

The approved September 21 mascot/personality source files are preserved
unchanged under `assets/source/rooster/personality/`:

- `rooster-canonical-confident-source.png`;
- `rooster-expression-sheet-1-source.png`;
- `rooster-expression-sheet-2-source.png`;
- `rooster-super-cooked-source.png`.

These source sheets are not loaded by ordinary player pages. The canonical
direction is the beer-bellied Rugby Rooster mascot with green rugby jersey,
tan/golden feathers, red comb, and cobalt/deep-blue tail.

## Runtime Personality Assets

Prepared runtime directory:

- `public/assets/rooster/personality/`

Generated manifest:

- `public/assets/rooster/personality/personality-manifest.json`

Preparation script:

- `scripts/prepare-rooster-personality-assets.mjs`

The runtime set contains clean transparent PNGs for:

- `confident`;
- `thinking`;
- `celebrating`;
- `nervous`;
- `shocked`;
- `disappointed`;
- `tantrum`;
- `crying`;
- `cooked`;
- `superCooked`.

`running` remains mapped only to the accepted Match Result action art:

- `/assets/rooster/match-result/frames/rooster-run-1.png`

Runtime metadata inspection showed the generated personality PNGs are `srgba`,
have non-zero sensible dimensions, and preserve alpha. The Super-Cooked runtime
asset is `640 x 460 sRGBA`, generated from the preserved Super-Cooked source
using the tightened crop recorded in the manifest.

## Mood Mapping

`RugbyRoosterPersonality` now maps:

| Mood           | Runtime path                                            |
| -------------- | ------------------------------------------------------- |
| `confident`    | `/assets/rooster/personality/rooster-confident.png`     |
| `thinking`     | `/assets/rooster/personality/rooster-thinking.png`      |
| `celebrating`  | `/assets/rooster/personality/rooster-celebrating.png`   |
| `nervous`      | `/assets/rooster/personality/rooster-nervous.png`       |
| `shocked`      | `/assets/rooster/personality/rooster-shocked.png`       |
| `disappointed` | `/assets/rooster/personality/rooster-disappointed.png`  |
| `tantrum`      | `/assets/rooster/personality/rooster-tantrum.png`       |
| `crying`       | `/assets/rooster/personality/rooster-crying.png`        |
| `cooked`       | `/assets/rooster/personality/rooster-cooked.png`        |
| `superCooked`  | `/assets/rooster/personality/rooster-super-cooked.png`  |
| `running`      | `/assets/rooster/match-result/frames/rooster-run-1.png` |

No non-running mood maps to the old generic run/push frames.

The current size API is:

- `compact`;
- `standard`;
- `hero`.

## Page Mood Usage

Current deterministic page usage:

- Home: `confident`.
- Games: `running` for upcoming fixtures and match-day energy, `thinking` for
  past fixtures.
- Game Detail: `thinking`.
- Prediction: `confident` when open, `thinking` for locked/intro/static states.
- Leaderboard: `thinking`, `nervous`, `celebrating`, `disappointed`,
  `superCooked`, or `confident` based on existing leaderboard state and current
  user's final outcome.
- My Score: `thinking`, `confident`, `nervous`, `celebrating`,
  `disappointed`, `cooked`, `superCooked`, or `shocked` based on existing score
  status.
- Account: `confident`.
- Shared empty/error states: `thinking` or `tantrum` where currently mapped.

No new psychology/rules engine was added.

## Colour Alignment

The semantic `--rr-*` architecture remains in `client/main.css` and Tailwind
`rr.*` aliases remain in `tailwind.config.cjs`.

Approved palette:

- Field Green: `0 109 67`;
- Gold: `242 190 70`;
- Rooster Red: `202 46 38`;
- Cobalt Blue: `0 87 184`;
- Cream: `255 248 230`;
- Tan Feather: `214 169 93`;
- Charcoal: `24 31 38`.

Field Green is the dominant brand anchor. Cream is the readable page base.
Gold, Rooster Red, Cobalt Blue, and Tan Feather are used as deliberate accents.
Home keeps the stronger green hero/header treatment introduced during the prior
implementation.

Yellow and Red Card controls remain semantically clear and were not redesigned
by this closeout.

## Browser Evidence

Final retained evidence directory:

- `test-results/ccpp012b1-mascot-colour-alignment-final-correction/`

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

- `mobile-390-home.png`
- `mobile-390-games.png`
- `mobile-390-game-detail.png`
- `mobile-360-leaderboard.png`
- `mobile-360-my-score.png`
- `mobile-390-account.png`

The focused spec verifies:

- actual approved mascot images load;
- non-running moods do not use old Match Result run/push frame paths;
- the approved player journey still works;
- Home 390px evidence is included;
- mobile pages have no horizontal overflow.

Browser run history:

- First sandboxed launcher attempt:
  `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=test-results/ccpp012b1-mascot-colour-alignment-final meteor npm run test:e2e -- tests/e2e/visual-foundation-personality.spec.ts --workers=1 --retries=0`
  exited with code `1` in about 1.8 seconds before Playwright executed tests.
  `.last-run.json` listed no failed tests and no screenshots were produced.
- Authorized browser batch:
  `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=test-results/ccpp012b1-mascot-colour-alignment-final-authorized meteor npm run test:e2e -- tests/e2e/visual-foundation-personality.spec.ts --workers=1 --retries=0`
  reached the app and failed one spec assertion on the Prediction page. The
  route was in the saved-entry Review state with the implemented `confident`
  mood, while the spec expected `thinking`. This was a directly evidenced
  browser-spec defect, not an application failure.
- One permitted correction batch:
  `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=test-results/ccpp012b1-mascot-colour-alignment-final-correction meteor npm run test:e2e -- tests/e2e/visual-foundation-personality.spec.ts --workers=1 --retries=0`
  passed, `1` Chromium test / `1` passed.

## Visual Review Answers

- Is Field Green clearly the main brand anchor? Yes. Home's hero, primary
  buttons, nav selection, and key action/status accents make green dominant.
- Does Cream keep pages readable? Yes. The page base and panels remain warm and
  readable in desktop and 390px/360px captures.
- Are Gold/Red/Blue/Tan used deliberately rather than randomly? Yes. Gold is
  used for Home CTA/winner accents, Rooster Red for `vs`/attention/danger,
  Cobalt Blue for selective links/info, and Tan Feather for warm borders and
  dividers.
- Does Home feel closer to the approved green-heavy direction? Yes. The first
  viewport is materially greener while still showing the next section.
- Are different Rooster poses now visible across pages? Yes. The final evidence
  shows distinct confident, running, thinking, nervous, and celebrating poses,
  with additional error/empty state coverage.
- Is Running restricted to suitable action/match-day contexts? Yes. Running
  appears on Games/upcoming fixture energy; non-running moods load personality
  PNGs.
- Does the beer-bellied mascot stay visually consistent? Yes. The runtime
  personality contact sheet and screenshots keep the same jersey, build,
  feather, comb, and tail direction.
- Do full-body poses fit at 390/360px? Yes. Home and Account 390px evidence fit
  the full-body confident pose without horizontal overflow; long pages stack
  cleanly.
- Is the mascot overused anywhere? No obvious overuse in the retained journey.
  Leaderboard and My Score rely on state-specific placements rather than
  duplicate mascots everywhere.
- Is Yellow/Red Card semantic clarity preserved? Yes. Prediction review and
  prior card-specific styling remain text-labelled and semantically distinct;
  012B1 did not redesign card controls.

## Verification

Completed in this continuation:

- `meteor npm run test:unit -- --run tests/unit/player-identity.test.ts tests/unit/player-visual.test.ts`
  - passed before browser, `2` files / `39` tests.
- `RUGBY_ROOSTER_E2E_EVIDENCE_DIR=test-results/ccpp012b1-mascot-colour-alignment-final-correction meteor npm run test:e2e -- tests/e2e/visual-foundation-personality.spec.ts --workers=1 --retries=0`
  - passed, `1` Chromium test / `1` passed.
- `meteor npm run test:unit -- --run tests/unit/player-identity.test.ts tests/unit/player-visual.test.ts`
  - passed after browser, `2` files / `39` tests.
- `meteor npm run typecheck` - passed.
- `meteor npm run lint` - passed cleanly after changing two prep-script
  `console.log` calls to `console.info`.
- `meteor npm run lint:project` - passed; project invariant check passed.
- Changed-file Prettier check with `meteor npm exec prettier -- --check ...` -
  passed after applying Prettier to changed docs, the browser spec, and the prep
  script.
- `git diff --check` - passed.

No browser rerun was performed after the lint-only prep-script cleanup because
it changed no runtime visual output, mood mapping, asset paths, or layout
behaviour.

## EOMD Package

Archive:

- `rugby-rooster-ccpp012b1-mascot-colour-alignment-eomd-20260921.zip`

Package contents include:

- preserved approved source sheets under `assets/source/rooster/personality/`;
- prepared runtime personality PNGs and generated manifest under
  `public/assets/rooster/personality/`;
- `scripts/prepare-rooster-personality-assets.mjs`;
- `RugbyRoosterPersonality` and shared player primitives;
- approved colour/token changes in `client/main.css` and `tailwind.config.cjs`;
- affected player pages and public layout;
- focused unit tests and focused browser visual spec;
- final screenshot evidence from
  `test-results/ccpp012b1-mascot-colour-alignment-final-correction/`;
- updated docs and this verification record.

The archive intentionally excludes `node_modules`, `.meteor/local`, caches,
credentials, private settings, and the older failed browser evidence
directories.

Package verification performed:

- `unzip -t rugby-rooster-ccpp012b1-mascot-colour-alignment-eomd-20260921.zip`
  - passed; no compressed-data errors.
- `zipinfo -t rugby-rooster-ccpp012b1-mascot-colour-alignment-eomd-20260921.zip`
  - confirmed `70` files.
- `zipinfo -1 ... | rg ...` - confirmed source assets, runtime assets,
  screenshot evidence, docs, tests, script, and source files are present.
- Code-referenced `RugbyRoosterPersonality` asset paths were checked against
  `public/`; no missing paths were reported.
- Representative packaged PNGs opened via `identify` from the ZIP stream:
  `rooster-confident.png` (`593 x 640 sRGBA`),
  `rooster-super-cooked.png` (`640 x 460 sRGBA`), `mobile-390-home.png`
  (`390 x 1445 sRGB`), and `desktop-leaderboard-final.png`
  (`1280 x 1084 sRGB`).
- A ZIP listing check found no archived
  `ccpp012b1-mascot-colour-alignment-final/` or
  `ccpp012b1-mascot-colour-alignment-final-authorized/` failed-evidence
  directories.
