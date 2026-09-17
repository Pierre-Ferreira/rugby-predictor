# CCPP-008B1 Raw Observation Validation Audit

## Scope

Implemented a narrow corrective pass for CCPP-008B.

Fixed:

- malformed raw result observation objects being normalized into valid
  provisional/confirmed observations before validation could reject them;
- read-only provisional results on cancelled fixtures being headed as confirmed
  summaries.

Explicitly not implemented: player scoring persistence, leaderboard/ranking,
winners, score jobs, Kaplay, live events, result correction/reopen workflow,
custom-question redesign, fixture redesign, authorization redesign, AI, or any
match-result persistence redesign.

## Raw Input Vulnerability

The prior method flow sanitized the top-level method envelope and checked
enabled observation keys, but nested observation objects still entered lifecycle
normalization too early. A raw observation such as
`{ status: "garbage", value: 3 }` could be treated as an entered value and
persisted as `provisional` or `confirmed`. Unknown nested fields could be
stripped by normalization, and built-in `void` could be rewritten into a
non-void lifecycle status.

## Validation Order Change

`imports/shared/matchResults/validation.ts` now validates the raw observation
envelope before lifecycle normalization:

1. verify enabled top-level observation keys;
2. verify team, standard categorical, custom Number, and custom Choice
   observation objects contain only supported keys;
3. verify allowed incoming statuses;
4. preserve custom-only Void shape rules;
5. normalize legitimate observations into server-owned provisional/final
   lifecycle status;
6. run the existing shared observation validators and final completeness checks.

The existing scoring/observation validators remain the authoritative domain
validators for values, categorical answers, conversion consistency, First Try
consistency, custom option IDs, and final completeness.

## Allowed Raw Shape And Statuses

Supported raw observation object keys are:

- `status`
- `value`

Incoming non-void statuses accepted at the raw boundary:

- `pending`
- `provisional`
- `confirmed`

Client-provided `confirmed` does not force final persistence. Provisional saves
still persist legitimate entered values as `provisional`; final confirmation
still persists legitimate entered values as `confirmed`.

Built-in team numeric observations, card observations, and standard categorical
observations reject `void`.

## Custom Void Preservation

Custom Number and custom Choice observations may use:

```json
{ "status": "void" }
```

Only known active custom questions accept Void. Void observations with `value`
are rejected. Legitimate custom Void remains Void during provisional save and
final confirmation, deducts zero later, is not Pending, and does not block final
confirmation.

## Nested Unknown-Field Rejection

The raw boundary rejects unknown nested fields for:

- team numeric/card observations;
- standard categorical observations;
- custom Number observations;
- custom Choice observations.

Malformed requests fail directly; they are not saved and are not merely stripped
before persistence.

## Read-Only Status Label Correction

`imports/ui/pages/AdminFixtureResultsPage.tsx` now derives the read-only summary
heading from `result.observations.matchStatus`.

- Confirmed result: `Confirmed result summary`
- Provisional result made read-only by fixture cancellation: `Provisional result
summary`

No edit, confirm, unconfirm, delete, or reopen workflow was added.

## Tests Actually Run

Passed:

- `meteor npm run test:unit -- tests/unit/match-results.test.ts tests/unit/scoring-engine.test.ts`
  - final post-format rerun: 2 files, 35 tests passed.
- `meteor npm run test:integration -- --grep "match result administration"`
  - 67 server tests passed, including the 9 match-result administration tests.
- `meteor npm run test:e2e -- tests/e2e/results.spec.ts`
  - final rerun: 3 Chromium tests passed.
- `meteor npm run typecheck`
  - final post-format rerun passed.
- `meteor npm run lint`
- `meteor npm run lint:project`
- Changed-file Prettier check with `meteor npm exec prettier -- --check <changed files>`
- `git diff --check`
- Review ZIP listing and original-file presence check
  - `unzip -l rugby-rooster-ccpp008b1-raw-observation-validation-eomd-20260917.zip`
  - shell `test -f` loop over archived source/docs/tests returned
    `originals-present`.

Interim browser reruns before the final passing run exposed and fixed test
fragility:

- result test-token login can transiently lose its execution context during
  local navigation;
- score assertions using non-exact text could match generated team labels;
- the cancelled-result setup was narrowed to create the provisional result via
  the server method so the browser test focuses on the read-only UI state.

Failed:

- `meteor npm run format:check`
  - failed on unrelated older files listed below.

## Known Unrelated Failures

Repo-wide `meteor npm run format:check` still reports formatting issues in
older files not changed for CCPP-008B1:

- `docs/AUDIT_004A_Database_Isolation_Verification.md`
- `docs/AUDIT_004A_Login_Navigation_Fix.md`
- `imports/server/auth/mongoConnectionIdentity.ts`
- `imports/shared/auth/testDatabaseIdentity.ts`
- `playwright.config.ts`
- `scripts/test-environment.mjs`
- `tests/unit/test-launchers.test.ts`

## Review Archive

Created and inspected:

- `rugby-rooster-ccpp008b1-raw-observation-validation-eomd-20260917.zip`

The archive contains 12 files:

- raw match-result validation/normalization source;
- shared scoring observation validation source;
- server result method source;
- result integration tests;
- changed result admin React source;
- focused raw observation unit tests;
- result admin browser tests, including cancelled provisional read-only
  coverage;
- changed match-result/testing docs;
- this audit and the resume checkpoint.
