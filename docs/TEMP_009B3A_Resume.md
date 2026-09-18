# TEMP 009B3A Resume

## Scope

CCPP-009B3A corrects two reviewed defects after the provisionally accepted
CCPP-009B3 work:

- save-baseline correctness in the shared prediction session;
- safe evidence-mode test-process cleanup.

It must not restart the Kaplay implementation, add scenes, redesign UI, change
scoring, or alter server prediction contracts.

## Initial Checkpoint

- Created: 2026-09-18.
- Repository: `/home/pierreferreira/Desktop/rugby-predictor`.
- Worktree at first checkpoint: clean (`git status --short` produced no
  entries).
- Product boundary: Rugby Rooster only; no Rugby Tracker / Rucks and Mauls
  assumptions.

## Defects To Correct

### Save Baseline

- `imports/ui/predictions/predictionSession.ts` currently handles
  `submit-success` by assigning `persistedForm: state.form`. If the player
  edits while the save request is pending, the later unsent edits can be marked
  saved.
- `derivePredictionSessionState(...)` prefers `context.currentEntry` over the
  locally acknowledged persisted form. A stale publication at revision N can
  override an acknowledged baseline at revision N+1.
- Discard/latest-load reads `context.currentEntry`; after a first save
  acknowledgement while publication is absent, discard can restore a blank form,
  Intro location, and `expectedRevision: null`.

### Test Cleanup

- `scripts/test-environment.mjs` currently grants cleanup authority when a
  process command contains `.meteor/local-playwright`, the repository path,
  `devServerPort=<port>`, the app URL/settings substring, or the local Meteor
  Mongo port/local-dir substring.
- That substring matching can select another project, another run in the same
  repository, a numeric-prefix port mismatch, or descendants of an incorrectly
  selected seed process.
- `scripts/run-playwright-tests.mjs` calls that selector in evidence mode after
  Playwright exits, so the unsafe path must be corrected before running the
  evidence-mode browser launcher.

## Inspected Source Paths

- `AGENTS.md`
- `imports/ui/predictions/predictionSession.ts`
- `tests/unit/prediction-session.test.ts`
- `tests/unit/prediction-session-hook.test.ts`
- `scripts/test-environment.mjs`
- `scripts/run-playwright-tests.mjs`
- `tests/unit/test-launchers.test.ts`
- `playwright.config.ts`
- `docs/PLATFORM_Prediction_Session.md`
- `docs/PLATFORM_Testing.md`
- `docs/AUDIT_009B3_Isolated_Script_Delivery.md`
- `docs/TEMP_009B3_Resume.md`
- `docs/CORE_Predictions.md`
- `docs/MAP_System.md`

## Chosen Minimal Correction

- Replace the saved-form-only baseline with a small revision-aware local saved
  baseline that records the latest known saved form, revision, and owner
  identity for the active account/fixture.
- Capture the submitted prediction/form snapshot before awaiting the transport
  and pass that stable snapshot through the legitimate success path.
- Allow valid newer publications for the same account/fixture to update the
  latest-known saved baseline without changing the player's editable form or
  captured edit revision.
- Use that same baseline for dirty comparison, discard/latest-load destination,
  and newer-entry feedback.
- Replace substring-based process selection with current-run process records
  rooted at the Playwright child actually spawned by the launcher and descendants
  verified while the run is active.
- Before every signal, revalidate recorded PID identity and ownership with an
  injected metadata lookup/signal boundary so unit tests can assert signal calls
  without touching unrelated live processes.

## Completed Changes

- Initial checkpoint file created before substantive source edits.
- Checkpoint A: replaced substring-based cleanup authority with current-run
  ownership records rooted at the spawned Playwright process and descendants
  verified while the run is active. Cleanup revalidates recorded process
  identity before SIGTERM and again before SIGKILL, reports sent/skipped/exited
  /failed outcomes separately, and skips duplicate cleanup calls.
- Checkpoint A: added synthetic cleanup tests for unrelated project/repository
  /port matches, false seed descendants, unverified orphans, changed start
  identity, unreadable metadata, reparented verified descendants, already-exited
  records, SIGKILL escalation, and repeated cleanup.
- Checkpoint B: added a revision-aware session-local saved baseline in
  `imports/ui/predictions/predictionSession.ts`.
- Checkpoint B: submit success now records the normalized submitted snapshot
  captured before awaiting transport instead of copying the mutable current
  form after acknowledgement.
- Checkpoint B: dirty state, discard/latest-load, and saved-entry-changed
  feedback now use the same latest-known saved baseline. Older publications do
  not replace newer acknowledgements; newer publications update the known saved
  baseline without overwriting the editable form or captured edit revision.
- Checkpoint B: added reducer and real React hook regressions for edit-during
  save, acknowledgement-before-publication, first-save discard while publication
  lags, older non-null publication, genuinely newer publication, publication
  before older acknowledgement, failure/conflict preservation, and disposed-owner
  isolation through existing coverage.
- Checkpoint C: ran focused Kaplay preview and Standard saved-entry/discard
  /conflict/lock browser selections against the corrected launcher. The
  sandboxed Kaplay attempt failed before tests ran; the escalated Kaplay and
  Standard runs passed.
- Checkpoint D: documentation updates started in core/platform/map docs and the
  CCPP-009B3A audit was created with archive status still pending.
- Checkpoint D: EOMD archive was created and inspected at
  `/home/pierreferreira/Desktop/rugby-predictor/rugby-rooster-ccpp009b3a-save-baseline-process-cleanup-eomd-20260918.zip`.
  The first ZIP build exposed empty `.git`, `.agents`, and `.codex` entries;
  those archive entries were removed and the archive was reinspected.

## Tests And Outcomes

- `meteor npm run test:unit -- tests/unit/test-launchers.test.ts` passed: 1
  file, 10 tests.
- `meteor npm run test:unit -- tests/unit/prediction-session.test.ts
tests/unit/prediction-session-hook.test.ts` first run failed 2 reducer
  expectations that still assumed later publications were ignored entirely after
  late adoption; expectations were corrected to assert no editable-form or
  captured-revision reseed while recording the newer saved baseline.
- `meteor npm run test:unit -- tests/unit/prediction-session.test.ts
tests/unit/prediction-session-hook.test.ts` rerun passed: 2 files, 30 tests.
- `meteor npm run test:unit -- tests/unit/test-launchers.test.ts
tests/unit/prediction-session.test.ts tests/unit/prediction-session-hook.test.ts
tests/unit/prediction-presentation-host.test.ts
tests/unit/prediction-presentation-mode.test.ts` passed: 5 files, 63 tests.
- First static pass:
  - `meteor npm run typecheck` first failed on nullable synthetic process-map
    typing in `tests/unit/test-launchers.test.ts`; fixed and rerun passed.
  - `meteor npm run lint` passed.
  - `meteor npm run lint:project` passed.
  - `git diff --check` passed.
- Browser evidence:
  - `/tmp/rugby-rooster-ccpp009b3a-kaplay-20260918T123139Z`: sandboxed
    focused Kaplay attempt failed before tests ran; Playwright recorded no
    failed tests.
  - `/tmp/rugby-rooster-ccpp009b3a-kaplay-20260918T123220Z`: escalated focused
    Kaplay run passed 5 tests with 1 worker and 0 retries.
  - `/tmp/rugby-rooster-ccpp009b3a-standard-20260918T123220Z`: escalated
    Standard selection passed 4 tests with 1 worker and 0 retries.
- Archive inspection:
  - `zipinfo` reported 80 entries in
    `rugby-rooster-ccpp009b3a-save-baseline-process-cleanup-eomd-20260918.zip`.
  - No `.git`, `.agents`, `.codex`, `node_modules`, `.meteor/local`, raw
    `trace.zip`, raw `video.webm`, `.env`, private settings, or unrelated
    archive entries were present after cleanup.
- Final static/documentation pass:
  - `meteor npm exec prettier -- --check ...` passed for changed source, tests,
    and docs.
  - `meteor npm run typecheck` passed.
  - `meteor npm run lint` passed.
  - `meteor npm run lint:project` passed.
  - `git diff --check` passed.

## Remaining Work

- None for CCPP-009B3A.
