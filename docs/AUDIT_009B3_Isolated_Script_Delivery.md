# CCPP-009B3 Isolated Script Delivery Audit

## Scope

CCPP-009B3 resumed the interrupted isolated-script-delivery diagnosis for the
focused Kaplay browser acceptance file. It did not restart CCPP-009B runtime
work, begin CCPP-009C, alter private preview settings, or change the ordinary
development preview-access policy.

## Evidence Preserved

- Non-escalated failed launch:
  `/tmp/rugby-rooster-ccpp009b3-run1-20260918T110321Z`
- RUN 1 escalated baseline:
  `/tmp/rugby-rooster-ccpp009b3-run1-20260918T110321Z-escalated`
- RUN 2 corrected focused Kaplay run:
  `/tmp/rugby-rooster-ccpp009b3-run2-20260918T112800Z`
- RUN 3 clean-start focused Kaplay confirmation:
  `/tmp/rugby-rooster-ccpp009b3-run3-20260918T113100Z`
- Standard launcher regression failure:
  `/tmp/rugby-rooster-ccpp009b3-standard-20260918T113300Z`
- Standard launcher regression rerun:
  `/tmp/rugby-rooster-ccpp009b3-standard-rerun-20260918T113600Z`

Raw traces remain private evidence. Packaged review evidence must use sanitized
manifests, logs, screenshots, browser timelines, and process snapshots without
login links, tokens, cookies, or private settings.

## Findings

The original sandbox launch exited before browser scenarios ran. It is evidence
of a failed launch only, not a scenario pass and not proof of a network-listener
root cause.

RUN 1 completed the focused Kaplay file with workers=1 and retries=0: 4 passed
and 1 failed. The browser evidence for the failing dirty saved custom prediction
contained no HTTP 4xx/5xx responses and no failed browser requests. Therefore
the historical preview/vendor/SockJS 503 failures did not reproduce in RUN 1.
Their cause remains unconfirmed.

The RUN 1 failure occurred before the intended dirty-state/Kaplay recovery
segment. The initial prediction was submitted, the server-side test helper
observed the saved entry at revision 1, and the explicit revisit reached the
same prediction route while signed in. The page rendered Intro and never showed
`Save revised prediction`.

The supported explanation is a client subscription/session initialization
boundary. A server helper finding the row proves the write was acknowledged and
persisted for that account/fixture, but it does not prove the browser
current-entry subscription had delivered usable data before the session owner
initialized.

RUN 2 and RUN 3 also showed the run-owned Rspack dev-server process could
outlive Playwright close and leave `[::1]:3202` listening. This cleanup defect
is not evidence that the historical 503s were caused by an orphaned process.

The required small Standard saved-entry regression through the shared launcher
first failed after create because `Discard changes` remained enabled. That
exposed a related post-submit readiness boundary: the method acknowledgement
can arrive before the current-entry publication catches up, so the local form
needs a saved baseline until subscription data arrives.

## Corrections

- `usePredictionSession(...)` now adopts a saved entry that arrives after blank
  initialization only while the session is still an untouched Intro with no
  captured revision, no save in flight, no discard state, and no feedback.
- The session now carries a persisted form baseline. It initializes from the
  original source form, refreshes on explicit latest-load and late initial
  saved-entry adoption, and is set to the submitted local form on successful
  save until the current-entry publication catches up.
- Evidence-mode Playwright launching now records process scans and cleans up
  only isolated run-owned process trees matching `.meteor/local-playwright`,
  the exact Playwright test settings/app port, or the run-owned Rspack
  dev-server port and descendants. Playwright exit code and logs are written
  before cleanup.
- Unit coverage was added for late saved-entry adoption, no adoption after
  edits, post-submit persisted baseline, and process-ownership cleanup
  selection.

## Verification

- Focused unit/target tests:
  `meteor npm run test:unit -- tests/unit/test-launchers.test.ts tests/unit/playwright-target.test.ts tests/unit/prediction-session.test.ts tests/unit/prediction-session-hook.test.ts`
  - latest result: 32 passed.
- Changed-file formatting:
  `meteor npm exec prettier -- --check ...`
  - latest pre-documentation result: passed.
- Static checks:
  `meteor npm run typecheck`, `meteor npm run lint`,
  `meteor npm run lint:project`, and `git diff --check`
  - final result: passed.
- RUN 1 focused Kaplay baseline:
  4 passed, 1 failed, workers=1, retries=0.
- RUN 2 focused Kaplay after saved-entry correction:
  5 passed, workers=1, retries=0.
- RUN 3 focused Kaplay clean-start confirmation:
  5 passed, workers=1, retries=0.
- Standard saved-entry launcher regression:
  first run failed at clean `Discard changes` after create; rerun after
  persisted-baseline correction passed 1 test.

## Unresolved

- The historical preview/vendor/SockJS 503 failures did not reproduce during
  009B3. Their startup/rebuild/routing/lifecycle cause remains unconfirmed.
- The Rspack orphan cleanup defect is corrected for isolated evidence-mode
  launcher runs, but it is not evidence for the historical 503s.
- Ordinary development should eventually expose supported Kaplay screens
  automatically while respecting explicit Off and reduced motion. That
  development-preview access/default work is the agreed next small UI-access
  task and was not implemented here.

## Review Archive

Created and inspected:
`/home/pierreferreira/Desktop/rugby-predictor/rugby-rooster-ccpp009b3-isolated-script-delivery-eomd-20260918.zip`.

The archive includes changed source, relevant unchanged context, focused tests,
updated docs, command results, and sanitized evidence copies. Raw Playwright
traces and videos are excluded; `zipinfo` confirmed no `trace.zip` or
`video.webm` entries. Repository originals were copied, not removed.
