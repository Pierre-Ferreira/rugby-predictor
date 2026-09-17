# Rugby Rooster Prediction Questions

## Product Rule

Every player predicting the same fixture must receive the same question set and
the same deduction weights. Prediction question configuration must be final
before predictions are accepted.

Published fixtures freeze the configured standard question set through the
fixture ruleset snapshot. Draft configuration remains editable only until the
fixture is published or cancelled.

## Question Groups

### Permanent Core

Permanent core questions are always part of Rugby Rooster and are not
disableable by fixture admins:

- Match result.
- Tries.
- Conversions.
- Successful penalty kicks.
- Drop goals.
- Final predicted-team-score deduction.
- Yellow cards.
- Red cards.

Their deductions remain controlled by the authoritative scoring ruleset. CCPP-008
does not make core inclusion or core rates admin-configurable.

### Optional Standard

Optional standard questions are supported by the existing standard player
prediction sequence:

- First try.
- Highest-scoring half.
- Half-time leader.

Fixture admins may enable or disable each optional standard question while the
fixture is draft. They may also configure the incorrect-answer deduction within
the current scoring ruleset constraints. Disabled standard questions do not
appear in the active player sequence or Review.

### Custom

Fixture admins may configure up to two fixture-specific custom questions on a
draft fixture.

Initial supported custom answer types:

- Number: integer answer with minimum, maximum, and deduction per absolute unit
  of error.
- Choice: one answer from a defined list of stable options with a fixed
  incorrect-answer deduction.

Each custom question has a stable internal ID that is not derived from editable
text. Each choice option also has a stable internal ID. Admins never manually
enter those IDs.

Custom questions require an objective counting definition. This is plain text
that explains what will be counted or settled later, for example whether a stat
includes only regulation time. CCPP-008A shows this counting definition to
players as secondary helper content so the prediction meaning is explicit.

Custom Number `deductionPerUnit` and Custom Choice `incorrectDeduction` must be
positive safe integers greater than zero. Zero-point custom questions are not
publishable and are rejected rather than silently coerced.

## Standard Player Answering

CCPP-008A makes published custom questions answerable in the Standard React
prediction sequence. The order is:

- active built-in standard steps;
- active custom questions in fixture-configured order;
- Review.

Intro and Review remain outside numbered progress. If optional standard
questions are disabled, numbering collapses from the actual active sequence.

Custom answers are stored on the existing prediction entry as `customAnswers`
keyed by stable custom question ID. Number answers persist as numbers. Choice
answers persist as stable option IDs, not labels.

Review shows a `CUSTOM QUESTIONS` section only when the fixture has active
custom questions. Choice answers are resolved back to frozen player-facing
labels from the fixture snapshot. Locked/read-only views display persisted
custom answers only; dirty local values are not presented as saved data.

Draft fixtures with valid custom questions can publish. Publication freezes the
complete player-safe custom definition into the fixture ruleset snapshot:
prompt, optional banter/context, counting definition, answer type, ranges,
option IDs/labels, deductions, and order. Player routes and server validation
use that frozen snapshot, not mutable draft configuration.

## Settlement States

CCPP-008B models custom question official outcomes as:

- Pending: no official answer is available.
- Settled: an official answer is available and can score predictions.
- Void: the question cannot be settled reliably and deducts nothing.

Official custom answers are entered only through admin match-result settlement
and are validated against the fixture's frozen published ruleset snapshot.
Choice settlements store the stable option ID. Number settlements may exceed
the player's configured prediction range because observed reality is not
bounded by the prediction UI range.

Void is available only for custom questions. Built-in observations remain
non-voidable and must be settled before final confirmation.

## Unresolved Balancing Policy

Rugby Rooster still has an unresolved product decision around fixtures with
different question counts and deduction weights. CCPP-008A does not normalize
scores, scale to percentages, alter the 10,000-point starting score, or change
the zero floor.
