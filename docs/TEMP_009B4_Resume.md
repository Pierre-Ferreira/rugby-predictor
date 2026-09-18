# TEMP 009B4 Resume

Date: 2026-09-18

## Existing policy

- `resolveKaplayPreviewSettings(...)` previously required
  `public.rugbyRooster.kaplayPredictionPreview.enabled === true` and
  `!Meteor.isProduction` before supported Kaplay scenes were available.
- `testControls` was coupled to that enabled gate.
- `readAnimationPreference(...)` previously defaulted missing, malformed, or
  unreadable browser storage to Off.
- `PredictionPresentationHost` already owned lazy loading, the attempt timeout,
  failure latch, retry, runtime disposal, reduced-motion fallback, and
  Standard/Kaplay switching below the shared prediction session.

## Intended changes

- Make supported Kaplay prediction scenes available automatically in ordinary
  local development.
- Retire the old `public.rugbyRooster.kaplayPredictionPreview.enabled` value as
  the local-development availability gate, including legacy `enabled:false`.
- Keep non-development availability unchanged.
- Default the development animation preference to On when storage is unset,
  unreadable, or invalid.
- Respect an explicit stored Off value.
- Preserve reduced-motion, unsupported-step, locking, and runtime-failure
  fallback behavior.
- Keep test controls and diagnostics explicitly isolated from ordinary
  development availability.

## Files changed

- `config/local/development.settings_EXAMPLE(json).txt`
- `docs/AUDIT_009B4_Development_Kaplay_Defaults.md`
- `docs/CORE_Build_Plan.md`
- `docs/CORE_Predictions.md`
- `docs/MAP_System.md`
- `docs/PLATFORM_Kaplay_Predictions.md`
- `docs/PLATFORM_Predictions.md`
- `docs/PLATFORM_Testing.md`
- `docs/TEMP_009B4_Resume.md`
- `imports/ui/predictions/PredictionPresentationHost.tsx`
- `imports/ui/predictions/presentationMode.ts`
- `imports/ui/predictions/presentationPreference.ts`
- `tests/e2e/kaplay-prediction-preview.spec.ts`
- `tests/settings/playwright-settings.json`
- `tests/unit/prediction-presentation-host.test.ts`
- `tests/unit/prediction-presentation-mode.test.ts`

## Checks and outcomes

- `./node_modules/.bin/vitest run --config vitest.config.mts tests/unit/prediction-presentation-mode.test.ts tests/unit/prediction-presentation-host.test.ts`
  passed: 28 tests.
- `npm run test:e2e -- tests/e2e/kaplay-prediction-preview.spec.ts --workers=1 --retries=0`
  first run failed 3 browser cases after 2 passed. Failures were preserved in
  `test-results/kaplay-prediction-preview--*`.
- One focused correction was made for reduced-motion setup and explicit recovery
  from a visible failure latch.
- `npm run test:e2e -- tests/e2e/kaplay-prediction-preview.spec.ts --workers=1 --retries=0`
  rerun passed: 5 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run lint:project` passed.
- `git diff --check` passed.
- Changed source/test/JSON/Markdown Prettier check passed.
- `config/local/development.settings_EXAMPLE(json).txt` Prettier check passed
  with explicit `--parser jsonc --trailing-comma none`.
- Initial combined Prettier write failed only because no parser could be
  inferred for the `.txt` settings example; the explicit JSONC check replaced
  that.
- Created
  `rugby-rooster-ccpp009b4-development-kaplay-defaults-eomd-20260918.zip` and
  refreshed it after recording the archive path.
- `unzip -l` showed 28 expected files and `unzip -t` reported no errors.
- Repository originals remained present after archive creation.

## Remaining work

- Manual normal-app verification was not performed; use the focused browser
  default-access evidence instead.
- Later CCPP stages still own additional animated question screens, rooster
  shove/artwork, animated Review/submission, and production rollout decisions.
