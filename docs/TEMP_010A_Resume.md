# CCPP-010A Resume Checkpoint

## Current Goal

CCPP-010A closeout supersedes the two-renderer prediction-control direction for
the active Rugby Rooster prediction route. The active path uses one React/HTML
prediction interface owned by `usePredictionSession(...)`, with optional
browser-native animation layered over the same controls.

This milestone visually migrates only:

- Match Result;
- Tries.

All later prediction steps, Review, edit, discard/reload, conflict recovery,
submission, revision, and read-only saved-entry behavior remain on the existing
React/shared-session implementation.

## Current Architecture

1. `imports/ui/predictions/predictionSession.ts` remains authoritative for form
   answers, active location, message variants, predicted scores, validation,
   conversion/try constraints, dirty state, saved baseline, expected revision,
   conflicts, submission, read-only guards, and all semantic actions.
2. `imports/ui/predictions/PredictionPresentationHost.tsx` owns only
   Animations preference, reduced-motion observation, and the derived
   `animationsEnabled` flag.
3. `imports/ui/pages/PredictionEntryPage.tsx` renders the React presentation
   host and no longer imports the Kaplay Match Result preview/runtime for the
   active prediction flow.
4. `imports/ui/predictions/reactPredictionPresentation.tsx` owns the
   React-first Match Result and Tries screens.
5. Optional animation is presentation-only. It must not navigate, save,
   validate, submit, clear answers, or introduce duplicate focusable answer
   controls.
6. Kaplay remains installed and the historical prediction-specific modules
   remain in source as superseded/deferred-cleanup material.

## Source Paths Inspected During Closeout

- `AGENTS.md`
- `docs/TEMP_010A_Resume.md`
- current git status/diff
- `imports/ui/pages/PredictionEntryPage.tsx`
- `imports/ui/predictions/PredictionPresentationHost.tsx`
- `imports/ui/predictions/reactPredictionPresentation.tsx`
- `imports/ui/predictions/presentationPreference.ts`
- `imports/ui/predictions/reducedMotion.ts`
- `imports/ui/predictions/presentationMode.ts`
- `client/main.css`
- `tests/unit/prediction-presentation-host.test.ts`
- `tests/unit/prediction-presentation-mode.test.ts`
- `tests/e2e/react-prediction-presentation.spec.ts`
- relevant docs listed in this milestone

## Evidence Preserved And Inspected

Final retained evidence folder:

```text
artifacts/ccpp010a-browser-rerun-20260919
```

Inspected:

- `playwright-stdout.log`
- `playwright-stderr.log`
- `runner-output.jsonl`
- `exit.json`
- retained Match Result screenshots
- retained Tries screenshots
- retained Playwright WebMs
- retained extracted frames
- closeout-created inspection frames/contact sheet from the retained WebM

Observed retained final evidence:

- focused browser stdout includes a final `3 passed (19.5s)` run;
- `exit.json` records exit code `0` at `2026-09-19T19:21:03.597Z`;
- Match Result uses real React/HTML card/radio controls;
- selected answers remain selected after animation/interruption cases;
- rejected presentation copies visibly move during the shove window;
- selected real answer is not materially covered in retained static captures;
- Tries controls are readable and usable on desktop and 390px mobile capture;
- mobile layouts are coherent at the retained 390px and 360px widths;
- Animations Off keeps the same essential controls.

Evidence limitation:

- The retained final video frames/contact sheet inspected during closeout do
  not visibly prove the Rooster mascot painting during the shove, even though
  the source uses real stacked Rooster `<img>` frame assets and those asset PNGs
  themselves are present and viewable. No browser rerun was started during
  closeout.

## Implementation Checkpoints

- [x] Read required operating instructions and current 010A checkpoint.
- [x] Preserve/locate retained final browser evidence before new checks.
- [x] Inspect final screenshots, WebMs, and extracted frame evidence.
- [x] Verify active route/source no longer imports or initializes Kaplay for
      prediction controls.
- [x] Verify Match Result React control contract.
- [x] Verify Tries React numeric control contract.
- [x] Verify remaining sequence stays on the existing shared React session.
- [x] Update architecture, testing, map, asset, and audit docs.
- [x] Run final closeout non-browser checks.
- [x] Package EOMD review ZIP and inspect contents/media.

## Tests And Results

Prior retained browser result:

- `tests/e2e/react-prediction-presentation.spec.ts` final retained run:
  `3 passed (19.5s)`, exit code `0`.

Closeout non-browser checks:

- Focused current-source unit rerun:
  `meteor npm run test:unit -- --run tests/unit/prediction-presentation-host.test.ts tests/unit/prediction-presentation-mode.test.ts tests/unit/prediction-sequence.test.ts tests/unit/prediction-session.test.ts`
  passed 4 files and 49 tests.
- `meteor npm run typecheck` passed.
- `meteor npm run lint` initially failed on a synchronous animation-state clear
  in an effect and a test ref pattern, then passed after a narrow source/test
  correction.
- `meteor npm run lint:project` passed.
- Scoped changed-file Prettier check initially failed on five files, then
  passed after scoped Prettier formatting.
- `git diff --check` passed after final tracked documentation/source changes.

The retained browser evidence predates the lint-driven source correction.

## Blockers And Limitations

- No source blocker is currently known.
- Final retained browser evidence does not visibly prove Rooster mascot
  painting during the shove. This is an evidence limitation; no new browser run
  is authorized in closeout.
- Historical prediction-specific Kaplay modules remain in source and should be
  removed only by a later cleanup milestone.

## EOMD Package

Created at repository root:

```text
rugby-rooster-ccpp010a-shared-react-match-result-tries-eomd-20260919.zip
```

Package inspection:

- `unzip -t` passed.
- Empty hidden staging directory entries were removed from the archive.
- A packaged Match Result PNG opened successfully.
- A packaged Playwright WebM probed successfully as VP8, 800x450, duration
  3.08 seconds.
- Original repository source/docs/assets/evidence remained in place.

## Exact Next Action

Stop CCPP-010A closeout. Do not begin CCPP-010B, Conversions migration, quiz
work, or historical Kaplay cleanup in this milestone.
