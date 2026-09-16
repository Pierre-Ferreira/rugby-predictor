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
includes only regulation time. CCPP-008 stores this definition for admin/future
settlement use and does not decide final player-facing presentation.

## Temporary Custom Publish Gate

Players cannot answer custom questions yet. A draft fixture with one or more
custom questions is saveable, but it cannot be published until player custom
prediction answering is implemented.

The gate is server-authoritative. The admin UI also explains the blocked
publication state, but disabling or hiding a client control is not the security
boundary.

## Future Settlement States

Future result/settlement milestones should model custom question outcomes as:

- Pending: no official answer is available.
- Settled: an official answer is available and can score predictions.
- Void: the question cannot be settled reliably and deducts nothing.

CCPP-008 does not implement official answers, result entry, settlement, or
voiding workflows.

## Unresolved Balancing Policy

Rugby Rooster still has an unresolved product decision around fixtures with
different question counts and deduction weights. CCPP-008 does not normalize
scores, scale to percentages, alter the 10,000-point starting score, or change
the zero floor.
