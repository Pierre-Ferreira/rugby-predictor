# CCPP-010C Resume Checkpoint

## Current State

CCPP-010C implementation and final browser evidence already exist. This
checkpoint was refreshed during the documentation/static closeout after remote
compaction.

Implemented:

- Cards React presentation.
- Separate Team 1 / Team 2 Yellow Cards and Red Cards numeric fields.
- Accepted shared numeric stepper mechanics for direct typing, blank drafts,
  decrement/increment buttons, zero floor, hidden native number spinners, and
  no arbitrary maximum.
- Distinct Yellow and Red presentation reactions.
- One shared active Cards reaction key, so the latest Yellow/Red cosmetic
  response wins.
- Stale Yellow reaction copy cleared when Red changes.
- Red-card marker spacing corrected.
- First Try React categorical presentation.
- Real radio controls for Team 1, Team 2, and `No Tries Today!`.
- Existing first-try consistency helper retained as the authority.
- Animations On reactions for Cards and First Try.
- Animations Off and reduced motion parity through the same controls.
- Mobile Cards and First Try layouts inspected in retained evidence.
- `No Tries Today!` exercised in the real app.
- Final First Try Team-selected screenshot taken after checked/data-selected
  state matched the shared answer and after a short visual settle.
- Final normal-speed WebM and contact sheet regenerated from the final state.

Not implemented:

- Highest-Scoring Half.
- Half-Time Leader.
- Custom question redesign.
- Review redesign.
- CCPP-010D.
- Quiz or Kaplay gameplay.
- Server methods, scoring rules, prediction persistence, or ruleset changes.

## Evidence

Final retained evidence is under:

```text
test-results/ccpp010c
```

The evidence directory was also copy-preserved during closeout at:

```text
/tmp/rugby-rooster-ccpp010c-evidence-preserve-20260920-closeout
```

Final retained files include:

- Cards desktop, 390px, and 360px screenshots.
- Yellow-card and Red-card reaction screenshots.
- First Try initial, Team-selected, Team2-selected, `No Tries Today!`, 390px,
  and 360px screenshots.
- Width/overflow measurement JSON.
- Final normal-speed Cards + First Try WebM.
- Final regenerated contact sheet.
- `exit.json` with final exit code `0` at `2026-09-20T11:51:54.904Z`.

Known stale intermediate images are not packaged as final acceptance evidence.

## Browser Run History

- Initial sandboxed launch exited before tests because of local networking
  restrictions.
- Escalated browser execution exposed a First Try flow issue caused by existing
  consistency auto-selection.
- Setup order was corrected.
- Later real browser runs passed.
- Evidence review found and corrected stale Yellow reaction during Red
  interaction, Red marker/label spacing, First Try selected-state screenshot
  timing, and short evidence holds for normal-speed reaction visibility.
- Final retained browser journey passed.
- Normal-speed WebM/contact sheet were regenerated from the final state.

No browser test or screenshot/video rerun is authorized for this closeout.

## Closeout Checks

Prior-run reports before compaction:

- Focused React presentation tests passed with 45 tests.
- Typecheck passed before browser execution.

Closeout checks still to record against current source:

- `meteor npm exec vitest run --config vitest.config.mts tests/unit/prediction-presentation-host.test.ts`
  passed: 1 file, 46 tests.
- `meteor npm run typecheck` passed.
- `meteor npm run lint` passed after a direct cleanup correction for decorative
  reaction effects.
- `meteor npm run lint:project` passed.
- Changed-file Prettier check passed after mechanical formatting of flagged
  files.
- `git diff --check` passed.

Prediction session/sequence tests are not required unless the final source
changes those files during closeout.

Retained browser evidence predates the closeout-only reaction cleanup
correction. No browser rerun was authorized or performed after that correction.

## EOMD Package

Created package:

```text
rugby-rooster-ccpp010c-cards-first-try-eomd-20260920.zip
```

Package inspection passed:

- `unzip -t` reported no compressed-data errors.
- Curated `zipinfo -1` contents contain docs, source, focused tests, final
  screenshots, measurement JSON, final WebM, final contact sheet, and
  `exit.json`.
- Representative extracted PNGs opened at expected dimensions.
- Extracted WebM metadata/opening check passed.
- Docs/source/tests presence checks passed.
