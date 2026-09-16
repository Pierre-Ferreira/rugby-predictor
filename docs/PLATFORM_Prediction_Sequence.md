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

- `imports/shared/predictions/sequence.ts` - built-in step definitions and
  active-step/navigation helpers.
- `imports/shared/predictions/messages.ts` - shared Intro/step copy catalog,
  stable variant selection, team-name interpolation, and ruleset-derived
  deduction text.
- `imports/ui/predictions/standardPredictionState.ts` - standard prediction form
  state helpers, score derivation adapters, result consistency detection, and
  first-try constraint handling.
- `imports/ui/pages/PredictionEntryPage.tsx` - route wrapper, standard sequence
  presentation, Review, submit/revise/reload/conflict/read-only behavior.

## Current Built-In Sequence

Intro and Review are outside numbered prediction progress. The current default
enabled sequence is:

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

The score-building steps remain present because the current prediction validator
requires scoring components to derive predicted rugby scores and validate match
result consistency. Existing ruleset enablement is respected for built-in
categorical steps and for the cards step when card questions are disabled.
Review uses the same active-step model for Edit destinations and additionally
hides grouped sections when no active rows remain.

## Message Catalog

Step copy lives in `predictionMessageCatalog`. Each built-in step has three
reviewed variants. A prediction session selects variant indexes once with
`selectPredictionMessageVariants(...)`; the React page stores that selection in
state so copy stays stable through rerenders, Back/Continue navigation, Review
edits, and local form updates.

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

## Standard State Rules

The standard experience keeps one `PredictionFormState` for the whole sequence.
Intro, numbered steps, Review, Edit-from-Review, submit/revise, reload, and
conflict handling all read or update that same state.

Predicted rugby match scores are derived with shared scoring helpers. The view
does not maintain a separately editable score and does not duplicate the score
formula. Rugby component point values are exported from
`imports/shared/scoring/derived.ts` and used by `deriveTeamScore`.

Result consistency warnings are shown only after score-producing categories are
known. The warning never changes the selected result or score inputs. From that
point onward, the standard step view disables forward Continue navigation while
keeping Back and the warning's Edit match result/Edit scores actions usable.
Review disables final submission when the chosen result conflicts with derived
scores; the server remains authoritative.

First-try constraints are derived from predicted tries. Impossible hidden answers
are removed immediately, and forced answers are explained as based on predicted
tries.

## Future Extension Point

Future milestones may supply additional sequence items for optional standard
questions or configured custom questions by extending the active ordered step
list and providing matching message/review/render metadata.

CCPP-007 does not define or implement:

- custom-question persistence;
- custom-question prediction storage changes;
- custom-question scoring or settlement;
- custom official-answer workflows;
- admin configuration or CRUD;
- future balancing across fixtures with different question counts or weights.

Those product decisions must be documented and implemented in later milestones.
