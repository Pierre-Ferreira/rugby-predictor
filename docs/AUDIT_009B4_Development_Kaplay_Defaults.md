# AUDIT 009B4 Development Kaplay Defaults

Date: 2026-09-18

## Scope

CCPP-009B4 changed only development access defaults for the existing Kaplay
Match Result prediction surface. It did not add additional Kaplay scenes,
rooster artwork, shove animation, Review/submission animation, scoring changes,
or production rollout behavior.

## Implementation

- `resolveKaplayPreviewSettings(...)` now treats ordinary non-production
  development as available by default.
- The legacy
  `public.rugbyRooster.kaplayPredictionPreview.enabled` value is no longer the
  development availability gate. Missing, `true`, and legacy `false` values do
  not block supported local-development screens.
- Production remains unavailable through the existing `Meteor.isProduction`
  check.
- `testControls` remains explicitly opted in through
  `public.rugbyRooster.kaplayPredictionPreview.testControls === true` and is
  not inferred from development mode, availability, or Animations On.
- The browser animation preference now defaults to On when storage is missing,
  unreadable, or malformed.
- Explicit stored Off remains Off and is not erased.
- Standard fallback caused by Intro, unsupported steps, read-only state,
  reduced motion, or runtime failure is not persisted as Off.
- The host copy now states the current feature boundary:
  "Animated Match Result is available. Other prediction steps currently use the
  standard experience."

## Evidence

The focused browser default-access scenario uses the real
`PredictionEntryPage` availability/preference path, the real Kaplay runtime,
and the isolated auth/fixture helpers. It does not set `enabled:true`, does not
prepopulate On, and does not click On before the first readiness assertion.

Verified behavior:

- Intro renders through Standard.
- A fresh Match Result step loads the real Kaplay canvas automatically.
- Canvas choice selection updates the shared prediction state.
- Switching Off through the UI shows Standard with the same answer.
- Returning to Match Result keeps explicit Off respected.
- Choosing On through the UI restores the supported Kaplay scene.
- Reduced motion blocks automatic activation.

Representative screenshots:

- `test-results/ccpp009b/desktop-default-match-result-preview.png`
- `test-results/ccpp009b/desktop-default-match-result-selected.png`

Manual normal-app verification was not performed in a user-owned running app.
The automated browser run is the development-equivalent evidence: it starts the
project's local Meteor app on loopback with isolated test data, real
availability/preference resolution, and no old `enabled:true` gate.

## Checks

Passed:

- `./node_modules/.bin/vitest run --config vitest.config.mts tests/unit/prediction-presentation-mode.test.ts tests/unit/prediction-presentation-host.test.ts`
  - 28 tests passed.
- `npm run test:e2e -- tests/e2e/kaplay-prediction-preview.spec.ts --workers=1 --retries=0`
  - First run: 2 passed, 3 failed.
  - Failures were in reduced-motion setup and two success assertions that were
    already on a failure-latched Standard view.
  - One focused correction was made.
  - Single allowed rerun: 5 passed.
- `npm run typecheck`
- `npm run lint`
- `npm run lint:project`
- `git diff --check`
- `./node_modules/.bin/prettier --check` on changed source, tests, JSON, and
  Markdown files.
- `./node_modules/.bin/prettier --parser jsonc --trailing-comma none --check 'config/local/development.settings_EXAMPLE(json).txt'`

Formatting note:

- An initial combined Prettier write failed to infer a parser for
  `config/local/development.settings_EXAMPLE(json).txt`. The file was then
  formatted and checked explicitly as JSONC with no trailing commas.

## Archive

- Created
  `rugby-rooster-ccpp009b4-development-kaplay-defaults-eomd-20260918.zip`.
- Archive includes changed source/tests/settings/docs, relevant unchanged
  Kaplay/prediction context, focused test setup, and the representative
  default-access screenshots.
- `unzip -l` listed 28 expected files and `unzip -t` reported no compressed
  data errors.
- Repository originals remained in place after archive creation.

## Documentation Updated

- `docs/CORE_Predictions.md`
- `docs/PLATFORM_Kaplay_Predictions.md`
- `docs/PLATFORM_Testing.md`
- `docs/CORE_Build_Plan.md`
- `docs/MAP_System.md`
- `docs/PLATFORM_Predictions.md`
- `config/local/development.settings_EXAMPLE(json).txt`
- `tests/settings/playwright-settings.json`

## Remaining Work

- Only Match Result currently has a Kaplay scene.
- Intro, other built-in prediction questions, custom questions, Review,
  submission, and locked read-only display still use Standard.
- Rooster artwork, shove animation, animated Review/submission, full production
  rollout, and quality-tier decisions remain later milestones.
