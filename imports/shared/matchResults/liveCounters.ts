import {
  assertValid,
  enabledQuestions,
  isBuiltInEnabled,
  scoringComponentFields,
  teamNumericFieldByQuestionId,
  teamSides,
  validateObservations,
  type CustomAnswerValue,
  type CustomObservedValue,
  type FixtureObservations,
  type ObservedValue,
  type QuestionDefinition,
  type RulesetSnapshot,
  type ScoringComponentField,
} from '/imports/shared/scoring';

const cardCounterFields = ['yellowCards', 'redCards'] as const;

export const LIVE_BUILT_IN_COUNTER_FIELDS = [
  ...scoringComponentFields,
  ...cardCounterFields,
] as const;

export type LiveBuiltInCounterField =
  (typeof LIVE_BUILT_IN_COUNTER_FIELDS)[number];

const liveBuiltInCounterFieldSet = new Set<string>(
  LIVE_BUILT_IN_COUNTER_FIELDS,
);

const customQuestionTypes = new Set(['custom-numeric', 'custom-categorical']);

export const isLiveBuiltInCounterField = (
  field: unknown,
): field is LiveBuiltInCounterField =>
  typeof field === 'string' && liveBuiltInCounterFieldSet.has(field);

export const requiredScoringObservationFields = (
  ruleset: RulesetSnapshot,
): ReadonlySet<ScoringComponentField> => {
  const requiredFields = new Set<ScoringComponentField>();

  for (const question of enabledQuestions(ruleset)) {
    if (question.id === 'match-result' || question.id === 'team-score') {
      scoringComponentFields.forEach((field) => requiredFields.add(field));
      continue;
    }

    if (question.type !== 'built-in-team-numeric') {
      continue;
    }

    const field = teamNumericFieldByQuestionId[question.id];

    if (scoringComponentFields.includes(field as ScoringComponentField)) {
      requiredFields.add(field as ScoringComponentField);
    }
  }

  return requiredFields;
};

export const enabledLiveBuiltInCounterFields = (
  ruleset: RulesetSnapshot,
): readonly LiveBuiltInCounterField[] => {
  const fields = new Set<LiveBuiltInCounterField>(
    requiredScoringObservationFields(ruleset),
  );

  for (const id of ['yellow-cards', 'red-cards'] as const) {
    const field = teamNumericFieldByQuestionId[id];

    if (field && isBuiltInEnabled(ruleset, id)) {
      fields.add(field);
    }
  }

  return LIVE_BUILT_IN_COUNTER_FIELDS.filter((field) => fields.has(field));
};

const enabledCustomQuestions = (
  ruleset: RulesetSnapshot,
): readonly Extract<
  QuestionDefinition,
  { readonly type: 'custom-numeric' | 'custom-categorical' }
>[] =>
  enabledQuestions(ruleset).filter(
    (
      question,
    ): question is Extract<
      QuestionDefinition,
      { readonly type: 'custom-numeric' | 'custom-categorical' }
    > => customQuestionTypes.has(question.type),
  );

const provisionalZero = (): ObservedValue<number> => ({
  status: 'provisional',
  value: 0,
});

const pending = <T>(): ObservedValue<T> => ({ status: 'pending' });

export const buildInitializedLiveResultObservations = (
  ruleset: RulesetSnapshot,
): FixtureObservations => {
  const fields = enabledLiveBuiltInCounterFields(ruleset);
  const zeroTeam = () =>
    Object.fromEntries(
      fields.map((field) => [field, provisionalZero()]),
    ) as Record<LiveBuiltInCounterField, ObservedValue<number>>;
  const observations: {
    customAnswers?: FixtureObservations['customAnswers'];
    firstTry?: FixtureObservations['firstTry'];
    halfTimeLeader?: FixtureObservations['halfTimeLeader'];
    highestScoringHalf?: FixtureObservations['highestScoringHalf'];
    matchStatus: FixtureObservations['matchStatus'];
    team1: FixtureObservations['team1'];
    team2: FixtureObservations['team2'];
  } = {
    matchStatus: 'provisional',
    team1: zeroTeam(),
    team2: zeroTeam(),
  };

  if (isBuiltInEnabled(ruleset, 'first-try')) {
    observations.firstTry = pending();
  }

  if (isBuiltInEnabled(ruleset, 'highest-scoring-half')) {
    observations.highestScoringHalf = pending();
  }

  if (isBuiltInEnabled(ruleset, 'half-time-leader')) {
    observations.halfTimeLeader = pending();
  }

  const customQuestions = enabledCustomQuestions(ruleset);

  if (customQuestions.length > 0) {
    observations.customAnswers = Object.fromEntries(
      customQuestions.map((question) => [
        question.id,
        pending<CustomAnswerValue>() as CustomObservedValue<CustomAnswerValue>,
      ]),
    );
  }

  assertValid(validateObservations(observations, ruleset));

  return observations;
};

export const preserveResolvedLiveCounterObservations = ({
  current,
  incoming,
  ruleset,
}: {
  readonly current: FixtureObservations;
  readonly incoming: FixtureObservations;
  readonly ruleset: RulesetSnapshot;
}): FixtureObservations => {
  const fields = enabledLiveBuiltInCounterFields(ruleset);
  const team1: Record<string, ObservedValue<number>> = {
    ...incoming.team1,
  };
  const team2: Record<string, ObservedValue<number>> = {
    ...incoming.team2,
  };
  const teams = {
    team1,
    team2,
  };
  const merged: FixtureObservations = {
    ...incoming,
    team1,
    team2,
  };

  for (const side of teamSides) {
    for (const field of fields) {
      const nextValue = incoming[side][field];
      const currentValue = current[side][field];

      if (
        nextValue?.status === 'pending' &&
        currentValue?.status !== undefined &&
        currentValue.status !== 'pending' &&
        currentValue.value !== undefined
      ) {
        teams[side][field] = currentValue;
      }
    }
  }

  return merged;
};
