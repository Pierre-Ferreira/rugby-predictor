# CCPP-010A Shared React Presentation Audit

## Scope

CCPP-010A supersedes the two-renderer prediction-control direction for the
active player prediction route. The active route now uses one React/HTML
prediction experience with optional browser-native decoration. This closeout is
limited to Match Result and Tries, retained evidence inspection, documentation,
focused verification, and review packaging.

CCPP-010A does not begin 010B, migrate Conversions or later visual screens,
implement a half-time quiz, remove Kaplay from dependencies, or delete the
historical prediction-specific Kaplay modules.

## Implementation

- `PredictionPresentationHost.tsx` is now a React presentation host. It owns the
  Animations preference, reduced-motion observation, and the derived
  `animationsEnabled` flag.
- `PredictionEntryPage.tsx` renders the host around the existing shared
  prediction session and imports the React-first presentation components.
- `reactPredictionPresentation.tsx` adds:
  - real Match Result radio-card controls for Team 1, Team 2, and Draw;
  - a decorative noninteractive Match Result shove overlay;
  - real Tries numeric controls for both teams;
  - browser-native numeric pulse decoration for Tries when motion is enabled.
- Match Result answer updates dispatch through
  `selectBuiltInChoice('matchResult', value)`.
- Tries decrement, typed edit, and increment dispatch through
  `changeTeamNumericField(side, 'tries', value)`.
- Later built-in steps, custom questions, Review, edit, submit, revise,
  discard, conflict, and read-only saved-entry behavior stay on the existing
  React/shared-session implementation.
- The active prediction route no longer executes the Kaplay Match Result
  preview/runtime.

## Active Kaplay Status

Kaplay remains installed in `package.json` and `package-lock.json` for possible
future gameplay. It is not active for prediction controls after CCPP-010A.

Retained superseded/deferred-cleanup modules include:

- `imports/ui/predictions/kaplay/KaplayMatchResultPreview.tsx`
- `imports/ui/predictions/kaplay/matchResultRuntime.ts`
- `imports/ui/predictions/kaplay/matchResultMotion.ts`
- `imports/ui/predictions/kaplay/previewAttempt.ts`
- `imports/ui/predictions/presentationMode.ts`
- `tests/e2e/kaplay-prediction-preview.spec.ts`
- `tests/unit/match-result-motion.test.ts`
- `tests/unit/match-result-runtime.test.ts`

These are not reconnected in 010A. The unresolved historical Kaplay resize
failure was not fixed; it ceased to be relevant because that renderer is no
longer active in the prediction flow.

## Intermediate Findings

The interrupted CCPP-010A work produced useful failure evidence before final
correction:

- initial browser configuration placement error;
- sandbox/local-server launch issue;
- strict Playwright locator ambiguity for the `On` button;
- CSS sprite background not reliably painting in Chromium;
- Rooster lane initially overlapping the selected answer.

These failures are retained as historical evidence and are not packaged as the
final visual state.

## Final Corrections

- The browser animation source was changed from a CSS background sprite to
  stacked real `<img>` frames.
- The Rooster lane was clipped/repositioned so the intended animation path does
  not materially trample the selected real answer card.
- Focused Playwright selectors were tightened with exact names where needed.
- The retained final browser stdout records the focused React presentation spec
  passing after the earlier strict-locator failure.

## Retained Browser Evidence

Final retained evidence lives under:

```text
artifacts/ccpp010a-browser-rerun-20260919
```

Inspected retained evidence:

- `playwright-stdout.log`
- `exit.json`
- Match Result desktop screenshots before and after selection
- Match Result Animations Off screenshot
- Match Result 390px interruption and 360px screenshots
- Tries desktop and 390px screenshots
- Tries Animations Off screenshot
- final Playwright WebMs
- extracted and closeout-inspection video frames/contact sheet

Observed from the final retained pixels:

- Match Result uses real React/HTML card/radio controls.
- The selected real answer remains selected after the shove/interruption cases.
- Rejected presentation copies visibly move during the shove window in the
  retained video frames.
- The selected card is not materially covered in the retained static final
  screenshots.
- Tries controls are readable and usable on desktop and 390px mobile capture.
- Mobile Match Result and Tries layouts are coherent at the retained 390px and
  360px widths.
- Animations Off keeps the same essential controls.

Evidence limitation:

- The retained final frame/contact-sheet evidence inspected during closeout does
  not visibly prove the Rooster mascot painting during the shove, even though
  the current source uses real stacked Rooster `<img>` frame assets. This is
  recorded as a final-evidence limitation, not silently upgraded into a visual
  claim.

## Prior-Run Verification Evidence

Retained `playwright-stdout.log` records:

- an earlier `2 failed / 1 passed` focused browser run caused by strict locator
  ambiguity;
- a later `3 passed (33.6s)` run after selector correction;
- the final retained focused run: `3 passed (19.5s)`.

Retained `exit.json` records exit code `0` at
`2026-09-19T19:21:03.597Z`.

The final browser run was not repeated during closeout.

## Closeout Verification

Closeout was non-browser only. No additional browser rerun was started.

Final source caveat:

- `meteor npm run lint` initially failed on the closeout source because
  `reactPredictionPresentation.tsx` synchronously cleared animation state inside
  effects and `prediction-presentation-host.test.ts` used a ref pattern rejected
  by the React hooks lint. These were corrected narrowly.
- The retained final browser evidence predates that lint-driven source
  correction. The correction keeps the same UI contract, hides stale animation
  through derived state, clears obsolete decoration asynchronously, and
  simplifies the unit test's stable-control assertion.

Commands run during closeout:

- `meteor npm run test:unit -- --run tests/unit/prediction-presentation-host.test.ts tests/unit/prediction-presentation-mode.test.ts tests/unit/prediction-sequence.test.ts tests/unit/prediction-session.test.ts`
  - Final current-source result: 4 files passed, 49 tests passed.
- `meteor npm run typecheck`
  - Passed.
- `meteor npm run lint`
  - Initial result: failed with the issues listed above.
  - Final current-source result: passed.
- `meteor npm run lint:project`
  - Passed.
- `meteor npm exec prettier -- --check ...changed files...`
  - Initial result: failed on five changed files.
  - Corrected with scoped Prettier write.
  - Final scoped result: passed.
- `git diff --check`
  - Passed after final tracked documentation/source changes.

## Deliberately Not Rerun

The closeout does not rerun:

- broad auth browser suites;
- fixture history or pagination suites;
- result admin suites;
- historical Kaplay resize browser suites;
- 009C runtime-replacement browser suites for code no longer active in the
  prediction flow.

## Review Package

The EOMD review archive was created at the repository root:

```text
rugby-rooster-ccpp010a-shared-react-match-result-tries-eomd-20260919.zip
```

The package includes copied source/docs/assets/evidence only. Repository
originals are not moved or removed.

Package inspection:

- `unzip -t` reported no compressed-data errors.
- Unwanted hidden staging directory entries `.git/`, `.agents/`, and `.codex/`
  were removed from the archive before final inspection.
- A packaged Match Result PNG was extracted and opened successfully.
- A packaged Playwright WebM was extracted and probed successfully as VP8,
  800x450, duration 3.08 seconds.
- Original source, docs, Rooster assets, and retained evidence remained in the
  repository after packaging.
