# CCPP-006 Resume Checkpoint

Status: complete.

Completed:

- Re-read `AGENTS.md` and the requested product, scoring, fixture, auth, testing, map, and build-plan documents.
- Confirmed the worktree started clean.
- Inspected fixture server methods/publications, scoring prediction validation, auth authorization helpers, route handling, fixture detail UI, and existing unit/integration/browser test patterns.
- Added prediction collection/shared validators/server methods/publications/test reset helper.
- Added `/games/:fixtureId/predict`, sign-in return-path support, fixture links, and the React prediction form.
- Added focused unit tests for route resolution, auth return paths, and shared prediction validation.
- Ran `meteor npm run test:unit -- --run tests/unit/routes.test.ts tests/unit/auth-helpers.test.ts tests/unit/predictions.test.ts`: passed 3 files / 17 tests.
- Added focused Meteor integration coverage for prediction ownership, validation, kickoff locking, conflicts, concurrent create, publications, and locked readability.
- Ran `meteor npm run test:integration`: passed 49 tests.
- Added focused Playwright coverage for prediction return path, submit/revisit, edit-before-kickoff, locked read-only display, and conflict value preservation.
- Ran `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts`: passed 5 Chromium tests.
- Ran final `meteor npm run typecheck`: passed.
- Ran final `meteor npm run lint`: passed.
- Ran `meteor npm run lint:project`: passed.
- Ran `meteor npm run test:unit`: passed 10 files / 92 tests.
- Ran final `meteor npm run test:integration`: passed 49 server tests.
- Ran final `meteor npm run test:e2e -- tests/e2e/predictions.spec.ts`: passed 5 Chromium tests.
- Ran `meteor npm run format:check`: blocked by seven pre-existing formatting issues listed in `docs/AUDIT_006_Prediction_Submission.md`.
- Ran changed-file Prettier check for CCPP-006 files: passed.
- Updated mandatory prediction docs, existing system docs, and README route overview.

Final implementation:

- Add a dedicated `predictions` collection/domain with server-owned ownership, timestamps, revisions, ruleset identity, and a unique `{ userId, fixtureId }` index.
- Validate submitted predictions against the fixture's stored `rulesetSnapshot`.
- Add `/games/:fixtureId/predict` with existing passwordless sign-in return paths.
- Keep prediction entry UI fully independent of Kaplay or future animation state.

Remaining work:

- Create the CCPP-006 EOMD ZIP.

Next commands:

```sh
git status --short
zip -r rugby-rooster-ccpp006-prediction-submission-eomd-20260915.zip <changed files>
```
