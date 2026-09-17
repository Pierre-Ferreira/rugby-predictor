import {
  combineObservationStatuses,
  deriveMatchResult,
  deriveTeamScore,
  scoringComponentFields,
  teamNumericFieldByQuestionId,
  teamSides,
} from './derived';
import {
  addSafe,
  scoreCategoricalAnswer,
  scoreNumericDifference,
} from './primitives';
import { ScoringValidationError, validationIssue } from './errors';
import {
  STARTING_POINTS,
  type BreakdownItemStatus,
  type BreakdownStatus,
  type CalculationMode,
  type CategoricalBreakdownItem,
  type CategoricalBuiltInQuestionId,
  type CustomAnswerValue,
  type FixtureObservations,
  type FixturePrediction,
  type FixtureScoreResult,
  type NumericBreakdownItem,
  type CustomObservedValue,
  type ObservedValue,
  type QuestionDefinition,
  type QuestionScoreBreakdown,
  type ScoreFixtureInput,
  type TeamNumericBuiltInQuestionId,
  type TeamScoringComponents,
  type TeamSide,
  type ValidationIssue,
} from './types';
import {
  assertValid,
  createRulesetSnapshot,
  readCustomObservation,
  readObservation,
  validateObservations,
  validatePrediction,
  validateRuleset,
  validationResult,
} from './validation';

interface ObservedNumeric {
  readonly value: number | null;
  readonly status: BreakdownItemStatus;
}

export const scoreFixture = (input: unknown): FixtureScoreResult => {
  const initialIssues = validateScoreFixtureRequest(input);

  assertValid(validationResult(initialIssues));

  const request = input as ScoreFixtureInput;
  const ruleset = createRulesetSnapshot(request.ruleset);
  const predictionValidation = validatePrediction(request.prediction, ruleset);
  const observationValidation = validateObservations(
    request.observations,
    ruleset,
  );
  const validationIssues = [
    ...predictionValidation.issues,
    ...observationValidation.issues,
  ];

  assertValid(validationResult(validationIssues));

  const breakdown = buildBreakdown(
    ruleset.questions.filter((question) => question.enabled),
    request.prediction,
    request.observations,
  );
  const finalIssues = validateFinalReadiness(
    request.calculationMode,
    request.observations,
    breakdown,
  );

  assertValid(validationResult(finalIssues));

  const evaluatedDeductions = breakdown.flatMap((question) =>
    question.items
      .map((item) => item.deduction)
      .filter((deduction): deduction is number => deduction !== null),
  );
  const totalDeductions = safeAdd(evaluatedDeductions, ['totalDeductions']);
  const score = Math.max(0, STARTING_POINTS - totalDeductions);

  return {
    startingPoints: STARTING_POINTS,
    totalDeductions,
    score,
    calculationStatus:
      request.calculationMode === 'final' ? 'final' : 'provisional',
    pendingQuestionIds: breakdown
      .filter(
        (question) =>
          question.status === 'pending' ||
          question.status === 'partially-pending',
      )
      .map((question) => question.questionId),
    ruleset: {
      schemaVersion: ruleset.schemaVersion,
      id: ruleset.id,
      version: ruleset.version,
      questionCount: ruleset.questions.length,
    },
    breakdown,
  };
};

const validateScoreFixtureRequest = (
  input: unknown,
): readonly ValidationIssue[] => {
  if (!isRecord(input)) {
    return [
      validationIssue(
        'invalid_score_request',
        [],
        'Score fixture request must be a non-array object.',
      ),
    ];
  }

  const issues: ValidationIssue[] = [];

  for (const field of [
    'ruleset',
    'prediction',
    'observations',
    'calculationMode',
  ]) {
    if (!hasOwn(input, field)) {
      issues.push(
        validationIssue(
          'missing_required_field',
          [field],
          `Score fixture request is missing '${field}'.`,
        ),
      );
    }
  }

  if (
    hasOwn(input, 'calculationMode') &&
    input.calculationMode !== 'if-ended-now' &&
    input.calculationMode !== 'final'
  ) {
    issues.push(
      validationIssue(
        'invalid_calculation_mode',
        ['calculationMode'],
        'Calculation mode must be if-ended-now or final.',
      ),
    );
  }

  if (hasOwn(input, 'ruleset')) {
    issues.push(...validateRuleset(input.ruleset).issues);
  }

  return issues;
};

const buildBreakdown = (
  questions: readonly QuestionDefinition[],
  prediction: FixturePrediction,
  observations: FixtureObservations,
): readonly QuestionScoreBreakdown[] =>
  questions.map((question) => {
    if (question.type === 'built-in-team-numeric') {
      return scoreBuiltInTeamNumeric(question, prediction, observations);
    }

    if (question.type === 'built-in-categorical') {
      return scoreBuiltInCategorical(question, prediction, observations);
    }

    if (question.type === 'custom-numeric') {
      return scoreCustomNumeric(question, prediction, observations);
    }

    return scoreCustomCategorical(question, prediction, observations);
  });

const scoreBuiltInTeamNumeric = (
  question: Extract<QuestionDefinition, { type: 'built-in-team-numeric' }>,
  prediction: FixturePrediction,
  observations: FixtureObservations,
): QuestionScoreBreakdown => {
  const items = teamSides.map((side) => {
    const predicted = teamNumericPrediction(question.id, prediction, side);
    const observed = teamNumericObservation(question.id, observations, side);

    return numericItem({
      team: side,
      prediction: predicted,
      observed,
      rate: question.rate,
    });
  });

  return questionBreakdown(question, items);
};

const teamNumericPrediction = (
  questionId: TeamNumericBuiltInQuestionId,
  prediction: FixturePrediction,
  side: TeamSide,
): number => {
  if (questionId === 'team-score') {
    return safeDerivedTeamScore(prediction[side], ['prediction', side]);
  }

  const field = teamNumericFieldByQuestionId[questionId];

  if (!field) {
    throw new ScoringValidationError([
      {
        code: 'unsupported_question',
        path: ['ruleset', 'questions', questionId],
        message: `Unsupported team numeric question '${questionId}'.`,
      },
    ]);
  }

  const value = prediction[side][field];

  if (typeof value !== 'number') {
    throw new ScoringValidationError([
      {
        code: 'missing_required_answer',
        path: ['prediction', side, field],
        message: `Missing required answer '${field}'.`,
      },
    ]);
  }

  return value;
};

const teamNumericObservation = (
  questionId: TeamNumericBuiltInQuestionId,
  observations: FixtureObservations,
  side: TeamSide,
): ObservedNumeric => {
  if (questionId === 'team-score') {
    return observedTeamScore(observations, side);
  }

  const field = teamNumericFieldByQuestionId[questionId];

  if (!field) {
    throw new ScoringValidationError([
      {
        code: 'unsupported_question',
        path: ['ruleset', 'questions', questionId],
        message: `Unsupported team numeric question '${questionId}'.`,
      },
    ]);
  }

  const observed = readObservation<number>(observations[side][field]);

  return observed.status === 'pending'
    ? { value: null, status: 'pending' }
    : { value: observed.value ?? null, status: observed.status };
};

const observedTeamScore = (
  observations: FixtureObservations,
  side: TeamSide,
): ObservedNumeric => {
  const componentObservations = scoringComponentFields.map((field) =>
    readObservation<number>(observations[side][field]),
  );
  const status = combineObservationStatuses(
    componentObservations.map((observation) => observation.status),
  );

  if (status === 'pending') {
    return { value: null, status };
  }

  const components = Object.fromEntries(
    scoringComponentFields.map((field, index) => [
      field,
      componentObservations[index].value,
    ]),
  ) as unknown as TeamScoringComponents;

  return {
    value: safeDerivedTeamScore(components, ['observations', side]),
    status,
  };
};

const scoreBuiltInCategorical = (
  question: Extract<QuestionDefinition, { type: 'built-in-categorical' }>,
  prediction: FixturePrediction,
  observations: FixtureObservations,
): QuestionScoreBreakdown => {
  const observed = categoricalObservation(question.id, observations);
  const predicted = categoricalPrediction(question.id, prediction);
  const item = categoricalItem({
    prediction: predicted,
    observed,
    incorrectDeduction: question.incorrectDeduction,
  });

  return questionBreakdown(question, [item]);
};

const categoricalPrediction = (
  questionId: CategoricalBuiltInQuestionId,
  prediction: FixturePrediction,
): string => {
  if (questionId === 'match-result') {
    return prediction.matchResult ?? '';
  }

  if (questionId === 'first-try') {
    return prediction.firstTry ?? '';
  }

  if (questionId === 'highest-scoring-half') {
    return prediction.highestScoringHalf ?? '';
  }

  return prediction.halfTimeLeader ?? '';
};

const categoricalObservation = (
  questionId: CategoricalBuiltInQuestionId,
  observations: FixtureObservations,
): ObservedValue<string> => {
  if (questionId === 'match-result') {
    const team1Score = observedTeamScore(observations, 'team1');
    const team2Score = observedTeamScore(observations, 'team2');
    const status = combineObservationStatuses([
      team1Score.status as ObservedValue<string>['status'],
      team2Score.status as ObservedValue<string>['status'],
    ]);

    if (
      status === 'pending' ||
      team1Score.value === null ||
      team2Score.value === null
    ) {
      return { status: 'pending' };
    }

    return {
      status,
      value: deriveMatchResult(team1Score.value, team2Score.value),
    };
  }

  if (questionId === 'first-try') {
    return readObservation(observations.firstTry);
  }

  if (questionId === 'highest-scoring-half') {
    return readObservation(observations.highestScoringHalf);
  }

  return readObservation(observations.halfTimeLeader);
};

const scoreCustomNumeric = (
  question: Extract<QuestionDefinition, { type: 'custom-numeric' }>,
  prediction: FixturePrediction,
  observations: FixtureObservations,
): QuestionScoreBreakdown => {
  const predicted = prediction.customAnswers?.[question.id] as number;
  const observed = readCustomObservation<CustomAnswerValue>(
    observations.customAnswers?.[question.id],
  );
  const item = numericItem({
    prediction: predicted,
    observed:
      observed.status === 'pending' || observed.status === 'void'
        ? { value: null, status: observed.status }
        : { value: observed.value as number, status: observed.status },
    rate: question.rate,
  });

  return questionBreakdown(question, [item]);
};

const scoreCustomCategorical = (
  question: Extract<QuestionDefinition, { type: 'custom-categorical' }>,
  prediction: FixturePrediction,
  observations: FixtureObservations,
): QuestionScoreBreakdown => {
  const predicted = prediction.customAnswers?.[question.id] as string;
  const observed = readCustomObservation<CustomAnswerValue>(
    observations.customAnswers?.[question.id],
  );
  const item = categoricalItem({
    prediction: predicted,
    observed:
      observed.status === 'pending' || observed.status === 'void'
        ? { status: observed.status }
        : { status: observed.status, value: observed.value as string },
    incorrectDeduction: question.incorrectDeduction,
  });

  return questionBreakdown(question, [item]);
};

const numericItem = ({
  team,
  prediction,
  observed,
  rate,
}: {
  readonly team?: TeamSide;
  readonly prediction: number;
  readonly observed: ObservedNumeric;
  readonly rate: number;
}): NumericBreakdownItem => {
  if (observed.status === 'void') {
    return {
      team,
      prediction,
      observed: null,
      difference: null,
      rate,
      deduction: 0,
      status: 'void',
    };
  }

  if (observed.status === 'pending' || observed.value === null) {
    return {
      team,
      prediction,
      observed: null,
      difference: null,
      rate,
      deduction: null,
      status: 'pending',
    };
  }

  const score = scoreNumericDifference(prediction, observed.value, rate);

  return {
    team,
    prediction,
    observed: observed.value,
    difference: score.difference,
    rate,
    deduction: score.deduction,
    status: observed.status,
  };
};

const categoricalItem = ({
  prediction,
  observed,
  incorrectDeduction,
}: {
  readonly prediction: string;
  readonly observed: CustomObservedValue<string> | ObservedValue<string>;
  readonly incorrectDeduction: number;
}): CategoricalBreakdownItem => {
  if (observed.status === 'void') {
    return {
      prediction,
      observed: null,
      incorrectDeduction,
      deduction: 0,
      status: 'void',
    };
  }

  if (observed.status === 'pending') {
    return {
      prediction,
      observed: null,
      incorrectDeduction,
      deduction: null,
      status: 'pending',
    };
  }

  const score = scoreCategoricalAnswer(
    prediction,
    observed.value ?? '',
    incorrectDeduction,
  );

  return {
    prediction,
    observed: observed.value ?? null,
    incorrectDeduction,
    deduction: score.deduction,
    status: observed.status,
  };
};

const questionBreakdown = (
  question: QuestionDefinition,
  items: readonly (NumericBreakdownItem | CategoricalBreakdownItem)[],
): QuestionScoreBreakdown => ({
  questionId: question.id,
  label: question.label,
  type: question.type,
  status: breakdownStatus(items),
  deduction: questionDeduction(items),
  items,
});

const breakdownStatus = (
  items: readonly (NumericBreakdownItem | CategoricalBreakdownItem)[],
): BreakdownStatus => {
  if (items.every((item) => item.status === 'pending')) {
    return 'pending';
  }

  if (items.some((item) => item.status === 'pending')) {
    return 'partially-pending';
  }

  if (items.some((item) => item.status === 'provisional')) {
    return 'provisional';
  }

  if (items.every((item) => item.status === 'void')) {
    return 'void';
  }

  return 'confirmed';
};

const questionDeduction = (
  items: readonly (NumericBreakdownItem | CategoricalBreakdownItem)[],
): number | null => {
  const deductions = items
    .map((item) => item.deduction)
    .filter((deduction): deduction is number => deduction !== null);

  return deductions.length > 0 ? safeAdd(deductions) : null;
};

const validateFinalReadiness = (
  calculationMode: CalculationMode,
  observations: FixtureObservations,
  breakdown: readonly QuestionScoreBreakdown[],
): readonly ValidationIssue[] => {
  if (calculationMode !== 'final') {
    return [];
  }

  const issues: ValidationIssue[] = [];

  if (observations.matchStatus !== 'confirmed') {
    issues.push({
      code: 'final_match_status_not_confirmed',
      path: ['observations', 'matchStatus'],
      message: 'Official final scoring requires confirmed match status.',
    });
  }

  for (const question of breakdown) {
    if (question.status !== 'confirmed' && question.status !== 'void') {
      issues.push({
        code: 'final_observation_not_confirmed',
        path: ['observations', question.questionId],
        message: `Official final scoring requires confirmed observation '${question.questionId}'.`,
      });
    }
  }

  return issues;
};

const safeDerivedTeamScore = (
  components: TeamScoringComponents,
  path: readonly (string | number)[],
): number => {
  try {
    return deriveTeamScore(components);
  } catch (error) {
    if (error instanceof ScoringValidationError) {
      throw error;
    }

    throw new ScoringValidationError([
      {
        code: 'unsafe_arithmetic',
        path,
        message: 'Derived team score is outside the safe integer range.',
      },
    ]);
  }
};

const safeAdd = (
  values: readonly number[],
  path: readonly (string | number)[] = [],
): number => addSafe(values, path);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);
