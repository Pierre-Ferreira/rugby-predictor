# CCPP-009B3A1 Fail-Closed Process Ownership Audit

## Scope

CCPP-009B3A1 fixed one remaining Playwright evidence-mode process ownership
defect after the provisionally accepted CCPP-009B3A work. The accepted
save-baseline correction and recorded Kaplay/Standard browser verification were
not reopened.

No prediction session, persistence, Kaplay runtime, browser assertion,
authentication, dependency, styling, asset, or rollout-control changes were
made.

## Correction

`scripts/test-environment.mjs` no longer performs deferred PID-only root
adoption. A tracker records whether the original root identity was verified at
creation. If the launcher had a numeric root PID but no valid matching original
identity, later process-table scans keep the tracker unverified.

For an unverified root:

- `recordOwnedTestProcessTree()` reports `root-identity-unverified`;
- no root ownership record is created from a later PID lookup;
- apparent descendants are not discovered from that PID;
- command text, repository paths, settings paths, ports, process names,
  liveness, and later identity lookups remain non-authoritative;
- `cleanupOwnedTestProcesses()` reports a skipped SIGTERM boundary and sends no
  SIGTERM or SIGKILL.

For a root whose original identity was verified, the existing cleanup model is
unchanged. Current-run records are retained, descendants are discovered only
through verified lineage and identity lookup, SIGTERM revalidates recorded
PID/start identity, SIGKILL is considered only for records that received
SIGTERM and still revalidate, and previously verified descendants may still be
cleaned up after root exit or reparenting.

`scripts/run-playwright-tests.mjs` did not require a launch/startup change. Its
existing evidence log captures the updated discovery and cleanup skipped
results.

## Synthetic Coverage

`tests/unit/test-launchers.test.ts` now covers:

- missing original root identity with a later PID occupant and child, asserting
  zero owned records and zero mocked signal calls;
- repeated scans where the root later has valid-looking identity data, asserting
  the tracker cannot bootstrap itself into ownership;
- absent, malformed, and PID-mismatched initial identity inputs, asserting later
  PID-only lookup is still not trusted;
- a verified-root positive control proving descendant discovery and mocked
  SIGTERM/SIGKILL cleanup still work;
- the pre-existing safety regressions for changed/reused process identity,
  unreadable identity, exited processes, verified descendants after reparenting,
  unrelated projects/runs, and repeated cleanup.

The new missing-identity regressions were run before the helper correction and
failed against the old delayed-adoption branch: the old helper recorded later
PID occupants such as `[501, 500]` and `[521, 520]`. After the correction, the
same focused launcher suite passed with zero-signal negative assertions.

## Verification

Checks completed during this task:

- `meteor npm run test:unit -- tests/unit/test-launchers.test.ts`
  - pre-fix demonstration: failed 5 new missing/unverified-root cases while 11
    existing/positive tests passed.
- `meteor npm run test:unit -- tests/unit/test-launchers.test.ts`
  - post-fix focused launcher suite passed: 1 file, 16 tests.
- `meteor npm exec prettier -- --write scripts/test-environment.mjs
tests/unit/test-launchers.test.ts docs/PLATFORM_Testing.md
docs/AUDIT_009B3A1_Fail_Closed_Process_Ownership.md
docs/TEMP_009B3A1_Resume.md`
  - completed; all files were unchanged.
- `meteor npm run test:unit -- tests/unit/test-launchers.test.ts`
  - final focused launcher suite passed: 1 file, 16 tests.
- `meteor npm run typecheck`
  - passed.
- `meteor npm run lint`
  - passed.
- `meteor npm run lint:project`
  - passed; project invariant check passed.
- `meteor npm exec prettier -- --check scripts/test-environment.mjs
tests/unit/test-launchers.test.ts docs/PLATFORM_Testing.md
docs/AUDIT_009B3A1_Fail_Closed_Process_Ownership.md
docs/TEMP_009B3A1_Resume.md`
  - passed; all matched files use Prettier style.
- `git diff --check`
  - passed.

No full Kaplay browser rerun, Standard prediction rerun, Meteor app launch,
authentication suite, fixture/history suite, result-admin suite, or historical
503 investigation was run for this isolated helper guard.

## Review Archive

Created and inspected:
`/home/pierreferreira/Desktop/rugby-predictor/rugby-rooster-ccpp009b3a1-fail-closed-process-ownership-eomd-20260918.zip`.

The archive includes the corrected ownership/cleanup helper, Playwright
launcher source needed to review its use, focused launcher cleanup tests,
package/test/static-check configuration, the updated platform testing document,
the new audit and resume checkpoint, and the prior CCPP-009B3A audit for
historical context.

Final archive inspection listed 15 entries and no `.git`, `.agents`, `.codex`,
`node_modules`, `.meteor/local`, application build/cache directories,
credentials, private settings, `.env` files, sensitive process/environment
dumps, or unrelated archive entries. `unzip -t` reported no compressed-data
errors. Repository originals remained in place after packaging.
