# AUDIT 009A1 Session Lifecycle Guards

## Scope

CCPP-009A1 corrects lifecycle and command-guard gaps found after the
provisionally accepted CCPP-009A shared prediction session extraction. Rugby
Rooster remains separate from Rugby Tracker / Rucks and Mauls.

This milestone did not implement Kaplay, canvas rendering, renderer switching,
animation preferences, browser draft persistence, prediction server API changes,
scoring changes, result settlement, leaderboards, or a Standard UI redesign.

## Implementation Summary

- Updated `imports/ui/predictions/predictionSession.ts` so the session owner
  mounted guard is symmetrical: effect setup marks the owner active and cleanup
  marks it disposed.
- Kept account/fixture identity as the session lifetime key. Renderer,
  reactive entry revision, step, and message variant still do not recreate the
  owner.
- Preserved stale-response protection with both owner disposal and session-key
  checks. Ignoring a stale UI response does not cancel any server request that
  was already accepted.
- Added shared reducer/derivation guards so read-only context blocks direct
  answer edits, editable navigation, submit, discard, and latest-load
  replacement while leaving internal submit completion actions available.
- Blocked discard and load-latest replacement while `isSubmitting=true`,
  including direct confirm/reload and the conflict recovery branch.
- Added an optional controlled submit transport injection for unit hook tests;
  production still defaults to the existing Meteor method wrapper.
- Added `jsdom@24.1.3` as a dev dependency for real React DOM unit tests.

## Behaviour Notes

- Presentation replacement is distinct from session replacement. A keyed
  consumer below the owner can unmount and remount without losing answers,
  location, Review edit context, message variants, captured expected revision,
  feedback, or submitting state.
- Session replacement disposes the old owner. Late success, error, and finally
  handling from that old owner cannot update the new account/fixture session or
  clear the new session's submit lock.
- Duplicate submit activation uses the real command boundary and transport
  call count: only one request is issued while the first is pending.
- If a save was accepted before kickoff and the context becomes read-only before
  completion, the same active session can still adopt the success revision,
  show completion feedback, and clear submitting state. The locked visible view
  remains persisted-entry based.

## Test Evidence

- `tests/unit/prediction-session.test.ts` remains reducer/derivation contract
  coverage. It now includes read-only command guards, in-flight discard/reload
  blocking, permitted discard/reload recovery after completion, and internal
  submit completion after read-only context changes.
- `tests/unit/prediction-session-hook.test.ts` mounts the actual
  `usePredictionSession(...)` hook with React DOM and `jsdom`.
- The hook tests assert Strict Mode effect setup/cleanup/re-setup occurred
  before successful and failed save completions.
- The hook tests replace a real keyed consumer below one session owner, verify
  consumer unmount/remount events, and prove replacement itself sends no save
  request.
- The hook tests start a save, replace the consumer while pending, resolve the
  controlled transport, and verify the replacement consumer receives the
  legitimate completion with exactly one request.
- The hook tests dispose owner A, mount owner B with a different account/fixture
  key, keep B's own request pending, resolve A's old request, and verify B's
  answers, feedback, revision, location, and submitting state are unchanged.

The hook tests mock only the transport boundary with controlled promises. They
do not mock `useEffect`, `useReducer`, `useState`, or reimplement the session
logic. They are not Meteor integration tests.

## Files Changed

- `imports/ui/predictions/predictionSession.ts`
- `tests/unit/prediction-session.test.ts`
- `tests/unit/prediction-session-hook.test.ts`
- `package.json`
- `package-lock.json`
- `docs/PLATFORM_Prediction_Session.md`
- `docs/PLATFORM_Testing.md`
- `docs/MAP_System.md`
- `docs/CORE_Predictions.md`
- `docs/TEMP_009A1_Resume.md`
- `docs/AUDIT_009A1_Session_Lifecycle_Guards.md`

## Verification

| Check                                                                                                                                                                                                                                                                                       | Result                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meteor npm run test:unit -- tests/unit/prediction-session.test.ts`                                                                                                                                                                                                                         | Passed: 1 file, 9 tests. Existing npm `nodedir` warning emitted.                                                                                                                                                                            |
| `meteor npm run test:unit -- tests/unit/prediction-session-hook.test.ts`                                                                                                                                                                                                                    | Initial run failed 4 tests by timeout due a test-helper promise-flattening bug, not an assertion failure. Fixed helper; rerun passed: 1 file, 7 tests. Existing npm `nodedir` warning emitted.                                              |
| `meteor npm install --save-dev jsdom`                                                                                                                                                                                                                                                       | Succeeded but installed `jsdom@30`, whose engine range did not match direct Node 20.20.2. Re-pinned before final verification.                                                                                                              |
| `meteor npm install --save-dev jsdom@24.1.3`                                                                                                                                                                                                                                                | Succeeded. Existing npm `nodedir`, deprecated `whatwg-encoding`, funding, and audit warnings emitted.                                                                                                                                       |
| `meteor npm run test:unit -- tests/unit/prediction-session-hook.test.ts`                                                                                                                                                                                                                    | Passed after pinning jsdom: 1 file, 7 tests. Existing npm `nodedir` warning emitted.                                                                                                                                                        |
| `meteor npm run test:unit -- tests/unit/prediction-session-hook.test.ts tests/unit/prediction-session.test.ts tests/unit/prediction-sequence.test.ts tests/unit/predictions.test.ts`                                                                                                        | Passed: 4 files, 47 tests. Existing npm `nodedir` warning emitted.                                                                                                                                                                          |
| `meteor npm exec prettier -- --write <changed files>`                                                                                                                                                                                                                                       | Passed and formatted changed source/docs/package files. Existing npm `nodedir` warning emitted.                                                                                                                                             |
| `meteor npm run typecheck`                                                                                                                                                                                                                                                                  | Passed. Existing npm `nodedir` warning emitted.                                                                                                                                                                                             |
| `meteor npm run lint`                                                                                                                                                                                                                                                                       | First run failed on React Hooks immutability in the test harness mutating controller props. Fixed by using callback props. Rerun passed. Existing npm `nodedir` warning emitted.                                                            |
| `meteor npm run lint:project`                                                                                                                                                                                                                                                               | Passed. Existing npm `nodedir` warning emitted.                                                                                                                                                                                             |
| `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts -g "guides Intro\|warns after score-building\|submits valid predictions\|discards dirty saved\|answers custom Number\|discards unsaved custom\|edits a saved prediction\|shows persisted saved entry\|preserves unsaved answers"` | Initial focused browser run passed 8 of 9 Chromium tests. The custom Number/Choice sequence failed waiting for the `Prediction updated.` status after a revised save. Existing npm `nodedir` and `NO_COLOR`/`FORCE_COLOR` warnings emitted. |
| `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts -g "answers custom Number and Choice questions in the standard sequence"`                                                                                                                                                         | Targeted rerun of the failed browser case passed: 1 Chromium test. Existing npm `nodedir` and `NO_COLOR`/`FORCE_COLOR` warnings emitted.                                                                                                    |
| `meteor npm run test:unit -- tests/unit/prediction-session-hook.test.ts`                                                                                                                                                                                                                    | Passed after the lint-driven harness cleanup: 1 file, 7 tests. Existing npm `nodedir` warning emitted.                                                                                                                                      |
| `meteor npm run test:unit -- tests/unit/prediction-session-hook.test.ts tests/unit/prediction-session.test.ts tests/unit/prediction-sequence.test.ts tests/unit/predictions.test.ts`                                                                                                        | Final focused unit rerun passed: 4 files, 47 tests. Existing npm `nodedir` warning emitted.                                                                                                                                                 |
| `meteor npm run typecheck`                                                                                                                                                                                                                                                                  | Final rerun passed. Existing npm `nodedir` warning emitted.                                                                                                                                                                                 |
| `meteor npm exec prettier -- --check <changed files>`                                                                                                                                                                                                                                       | Passed. Existing npm `nodedir` warning emitted.                                                                                                                                                                                             |
| `git diff --check`                                                                                                                                                                                                                                                                          | Passed.                                                                                                                                                                                                                                     |
| `meteor npm run lint:project`                                                                                                                                                                                                                                                               | Post-archive rerun passed with the root ZIP present. Existing npm `nodedir` warning emitted.                                                                                                                                                |

Not run: full authentication browser suite, fixture pagination/history suites,
result-admin browser suite, scoring integration suites, and Meteor full-app
integration tests. This milestone changed client session lifecycle/guards and
test harness code, not server prediction persistence APIs.

## Red/Green Note

The new Strict Mode hook test is designed to fail against the reviewed 009A
mounted-flag implementation because effect cleanup leaves the surviving owner
marked inactive. A destructive checkout/reset was not used to rerun the full
pre-fix source state; the historical 009A audit remains unchanged.

## Review Archive

Created and inspected:

- `rugby-rooster-ccpp009a1-session-lifecycle-guards-eomd-20260918.zip`

Archive inspection listed 19 intended files: the corrected session owner,
Standard route/renderer context, shared prediction form helpers, reducer and
React hook lifecycle tests, focused existing sequence/prediction/browser tests,
test configuration and dependency manifests, updated/new docs, and the
historical 009A audit. The archive excludes credentials, settings,
`node_modules`, `.meteor/local`, generated build/test output, and unrelated
archives. Original repository files were verified still present after ZIP
creation.
