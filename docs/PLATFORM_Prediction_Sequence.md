# Rugby Rooster Prediction Sequence Platform

## Purpose

CCPP-007 introduces the shared sequence and message layer used by the standard
React prediction experience. The layer is intentionally small: it is not a
workflow engine, but it keeps progress, navigation, Review edit destinations,
and player-facing step copy out of one-off page logic.

The future Kaplay prediction experience should consume the same sequence,
message, ruleset, validation, scoring, and submission contracts instead of
reimplementing prediction business rules in animation code.

## Source Map

- `imports/shared/predictions/sequence.ts` - built-in step definitions,
  dynamic custom step projection, and active-step/navigation helpers.
- `imports/shared/predictions/messages.ts` - shared Intro/step copy catalog,
  stable variant selection, team-name interpolation, and ruleset-derived
  deduction text.
- `imports/ui/predictions/predictionSession.ts` - CCPP-009A editable
  session owner, renderer-facing state/actions, navigation guards, selected
  message variants, revision capture, discard/conflict behavior, and submission
  handling.
- `imports/ui/predictions/standardPredictionState.ts` - standard prediction form
  state helpers, score derivation adapters, result consistency detection, and
  first-try constraint handling.
- `imports/ui/pages/PredictionEntryPage.tsx` - route wrapper, subscription and
  readiness host, Standard presentation, Review UI, and read-only persisted
  saved-entry display.

## Current Sequence

Intro and Review are outside numbered prediction progress. The current default
enabled built-in sequence is:

1. Match result
2. Tries
3. Conversions
4. Successful penalty kicks
5. Drop goals
6. Yellow and red cards
7. First try
8. Highest-scoring half
9. Half-time leader

The active numbered list is built from `activePredictionSteps(ruleset)`.
Progress, Back/Continue, final `Review predictions`, Review edit destinations,
and locked read-only Review rendering consume that active list.

CCPP-008A extends that same active list with dynamic custom steps from the
fixture's frozen ruleset snapshot. Custom step IDs use
`custom:<questionId>`. The player order is:

1. active built-in standard steps;
2. active custom questions ordered by the frozen custom `order`;
3. Review.

No custom insertion between Tries, Conversions, Cards, or other built-in steps
exists in CCPP-008A.

The score-building steps remain present because the current prediction validator
requires scoring components to derive predicted rugby scores and validate match
result consistency. Existing ruleset enablement is respected for built-in
categorical steps and for the cards step when card questions are disabled.
Review uses the same active-step model for Edit destinations and additionally
hides grouped sections when no active rows remain.

## Message Catalog

Step copy lives in `predictionMessageCatalog`. Each built-in step has three
reviewed variants. A prediction session selects variant indexes once with
`selectPredictionMessageVariants(...)`; `usePredictionSession(...)` stores that
selection so copy stays stable through rerenders, Back/Continue navigation,
Review edits, local form updates, and renderer remounts.

Deduction values are not duplicated in React. Message resolution reads the
fixture's stored ruleset snapshot through narrow helpers such as
`teamNumericDeductionRate(...)` and `categoricalIncorrectDeduction(...)`.
Those helpers return values only for enabled questions, so disabled built-in
numeric or categorical questions cannot surface as active deduction copy. Card
copy derives from the enabled card questions only. Team names are interpolated
through the message context where the catalog uses them.

Intro copy is built from the shared scoring configuration instead of embedding a
separate rendered starting-points literal. Half-Time Leader variants use
explicit half-time wording, and the Half-Time Leader draw display is
`Half-time Draw`; Match Result keeps the generic `Draw` label.

No runtime AI-generated copy is used.

Custom questions are fixture-authored and do not use randomized message
variants. The Standard view renders the frozen prompt, optional banter/context,
standardized Number or Choice deduction text from shared helpers, and the frozen
counting definition.

## Standard State Rules

The shared prediction session keeps one `PredictionFormState` for the whole
sequence. Intro, numbered steps, Review, Edit-from-Review, submit/revise,
discard, conflict recovery, Standard React, and future renderers all read or
update that same state through the session contract.

Custom answers live in the same form state under `customAnswers`, keyed by
stable custom question ID. Number custom answers are kept as strings while
editing and normalized to numbers only when building the submission payload.
Choice custom answers store the stable option ID selected by the player.

The Review discard control compares the current form with the latest persisted
entry projected into the same `PredictionFormState`. Clean forms keep
`Discard changes` disabled. Dirty forms require confirmation before restoring
the persisted entry, including custom Number/Choice answers. Stale-save conflict
recovery uses `Load latest saved prediction` wording and replaces local form
state only after the player explicitly chooses it.

Predicted rugby match scores are derived with shared scoring helpers. The view
does not maintain a separately editable score and does not duplicate the score
formula. Rugby component point values are exported from
`imports/shared/scoring/derived.ts` and used by `deriveTeamScore`.

Result consistency warnings are shown only after score-producing categories are
known. The warning never changes the selected result or score inputs. From that
point onward, the session disables forward Continue navigation while keeping
Back and the warning's Edit match result/Edit scores actions usable. Review
disables final submission when the chosen result conflicts with derived scores;
the server remains authoritative.

First-try constraints are derived from predicted tries. Impossible hidden answers
are removed immediately, and forced answers are explained as based on predicted
tries.

## Custom Questions

CCPP-008 makes optional standard question enablement configurable through the
fixture ruleset snapshot. The existing active-step helper already includes only
enabled built-in optional steps, so disabled First Try, Highest-Scoring Half, or
Half-Time Leader questions disappear from player progress and Review.

CCPP-008A supplies additional sequence items for configured custom questions.
`activeCustomQuestions(ruleset)` reads enabled `custom-numeric` and
`custom-categorical` definitions from the frozen snapshot. Review uses
`editStepIdForCustomQuestion(...)` so each custom Review row returns to the
correct custom step.

CCPP-008A still does not define or implement:

- custom-question scoring or settlement;
- custom official-answer workflows;
- future balancing across fixtures with different question counts or weights.

Those product decisions must be documented and implemented in later milestones.
