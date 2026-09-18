# CCPP-009B3A Save Baseline And Process Cleanup Audit

## Scope

CCPP-009B3A corrected two reviewed defects after the provisionally accepted
CCPP-009B3 runtime and recovery work:

- the local saved-answer baseline could represent the editable form at response
  time instead of the prediction that was actually submitted;
- evidence-mode Playwright cleanup could authorize signals from command/path
  substrings instead of verified current-run ownership.

No Kaplay scenes, UI redesign, scoring changes, server prediction schema
changes, server methods, subscriptions, private settings, or dependency upgrades
were added.

## Save-Baseline Correction

`imports/ui/predictions/predictionSession.ts` now keeps a small
account/fixture-local latest-known saved baseline. The baseline records a
normalized `PredictionFormState`, the known saved revision, and owner identity.
Valid evidence sources are:

- the initial saved entry used to initialize the session;
- a same-account/fixture published entry received for the active session;
- a successful acknowledgement of the normalized prediction snapshot captured
  before awaiting the submit transport.

The submit command builds the existing `FixturePrediction` payload first, then
derives the saved snapshot from that payload with the existing form/prediction
helpers. `submit-success` no longer copies `state.form` after the await, so
edits made while the request is pending remain unsaved and dirty.

Revision ordering is monotonic. Older publications cannot replace a newer
acknowledged baseline, matching publications do not reset the form, and genuinely
newer publications can update the saved baseline without changing the editable
form or captured `expectedRevision`.

Dirty comparison, discard/latest-load, and saved-entry-changed feedback now use
that same revision-aware baseline. After an acknowledged first save, discard
during publication lag restores the acknowledged saved answers and revision and
keeps the player in the saved-entry Review workflow.

Failed saves and stale conflicts do not promote submitted snapshots to saved
baselines. Disposed-owner completions remain isolated by the existing session-key
and mounted-owner guards.

## Process-Cleanup Correction

`scripts/test-environment.mjs` and `scripts/run-playwright-tests.mjs` no longer
treat command substrings, repository paths, `.meteor/local-playwright`, settings
paths, or port fragments as cleanup authority.

Evidence-mode cleanup now records ownership from the Playwright process actually
spawned by the launcher. While that process is active, descendants are added
only when their lineage to an already owned process is visible in the process
table and their `/proc/<pid>/stat` start identity can be read. A previously
verified descendant may still be cleaned up after reparenting only while its
recorded process identity still matches.

Before SIGTERM, cleanup revalidates the recorded PID/start identity. After the
grace period, SIGKILL is considered only for records that were sent SIGTERM and
still revalidate. Already-exited records, changed/reused PIDs, unreadable
metadata, signal failures, and duplicate cleanup calls are reported separately.
Cleanup does not perform a new broad scan after Playwright exits and does not
recruit matching commands retrospectively.

The platform limitation is intentionally narrow: PID identity is revalidated
immediately before signalling, but this Linux `/proc` mechanism does not claim
to be completely race-free if a PID changes between validation and the signal
system call. If identity cannot be verified, the launcher skips the uncertain
process instead of falling back to broad command matching.

## Verification

Focused unit and static checks:

- `meteor npm run test:unit -- tests/unit/test-launchers.test.ts`
  - passed: 1 file, 10 tests.
- `meteor npm run test:unit -- tests/unit/prediction-session.test.ts
tests/unit/prediction-session-hook.test.ts`
  - first run failed 2 reducer expectations that still assumed later
    publications were ignored entirely after late adoption.
  - expectations were corrected to assert no editable-form or captured-revision
    reseed while retaining the newer saved baseline.
- `meteor npm run test:unit -- tests/unit/prediction-session.test.ts
tests/unit/prediction-session-hook.test.ts`
  - rerun passed: 2 files, 30 tests.
- `meteor npm run test:unit -- tests/unit/test-launchers.test.ts
tests/unit/prediction-session.test.ts tests/unit/prediction-session-hook.test.ts
tests/unit/prediction-presentation-host.test.ts
tests/unit/prediction-presentation-mode.test.ts`
  - passed: 5 files, 63 tests.
- First static pass:
  - `meteor npm run typecheck` first failed on nullable synthetic process-map
    typing in `tests/unit/test-launchers.test.ts`.
  - `meteor npm run lint` passed.
  - `meteor npm run lint:project` passed.
  - `git diff --check` passed.
  - After correcting the test type annotations, `meteor npm run typecheck`
    passed.
- Final static/documentation pass:
  - `meteor npm exec prettier -- --check ...` passed for changed source, tests,
    and docs.
  - `meteor npm run typecheck` passed.
  - `meteor npm run lint` passed.
  - `meteor npm run lint:project` passed.
  - `git diff --check` passed.

Browser verification:

- Sandboxed focused Kaplay attempt:
  `/tmp/rugby-rooster-ccpp009b3a-kaplay-20260918T123139Z`
  - failed before tests ran; `.last-run.json` reported no failed tests, and the
    sandbox evidence showed restricted process/network metadata. This was not
    counted as a scenario failure.
- Escalated focused Kaplay verification:
  `/tmp/rugby-rooster-ccpp009b3a-kaplay-20260918T123220Z`
  - command: focused `kaplay-prediction-preview.spec.ts` through
    `meteor npm run test:e2e` with `--workers=1 --retries=0` and
    `RUGBY_ROOSTER_E2E_EVIDENCE_DIR` set to the evidence directory above.
  - passed: 5 tests, 1 worker, 0 retries.
- Escalated Standard prediction selection:
  `/tmp/rugby-rooster-ccpp009b3a-standard-20260918T123220Z`
  - command: focused `predictions.spec.ts` saved/discard/lock/conflict grep
    selection through `meteor npm run test:e2e` with `--workers=1 --retries=0`
    and `RUGBY_ROOSTER_E2E_EVIDENCE_DIR` set to the evidence directory above.
  - passed: 4 tests, 1 worker, 0 retries.

The successful browser evidence recorded cleanup events only for the spawned
Playwright root and descendants verified during the active run. Cleanup results
reported sent and exited records separately and no failed broad fallback.

## Review Archive

Created and inspected:
`/home/pierreferreira/Desktop/rugby-predictor/rugby-rooster-ccpp009b3a-save-baseline-process-cleanup-eomd-20260918.zip`.

The archive includes corrected session source, relevant prediction/form/transport
context, reducer and real-hook regressions, corrected launcher cleanup source,
synthetic ownership/signalling tests, runner configuration, relevant browser
specs, sanitized verification evidence, a source/run manifest, and new/updated
docs.

Archive inspection reported 80 entries and no `.git`, `.agents`, `.codex`,
`node_modules`, `.meteor/local`, raw `trace.zip`, raw `video.webm`, `.env`,
private settings, or unrelated archive entries. Repository originals were
copied into a staging directory; no originals were removed.
