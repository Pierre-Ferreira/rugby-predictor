import {
  categoricalBuiltInQuestionIds,
  RULESET_SCHEMA_VERSION,
  teamNumericBuiltInQuestionIds,
  type BuiltInQuestionId,
  type CategoricalBuiltInQuestionId,
  type CustomAnswerValue,
  type FixtureObservations,
  type FixturePrediction,
  type FirstTryAnswer,
  type HalfTimeLeader,
  type HighestScoringHalf,
  type MatchResult,
  type ObservationStatus,
  type ObservedValue,
  type QuestionDefinition,
  type QuestionId,
  type RulesetSnapshot,
  type ValidationIssue,
  type ValidationResult,
} from './types';
import { ScoringValidationError, validationIssue } from './errors';
import {
  deriveMatchResult,
  deriveTeamScore,
  scoringComponentFields,
  teamNumericFieldByQuestionId,
  teamSides,
  type ScoringComponentField,
} from './derived';

const idPattern = /^[a-z0-9][a-z0-9._:-]*$/;
const allowedQuestionTypes = new Set([
  'built-in-team-numeric',
  'built-in-categorical',
  'custom-numeric',
  'custom-categorical',
]);
const builtInIds = new Set<string>([
  ...teamNumericBuiltInQuestionIds,
  ...categoricalBuiltInQuestionIds,
]);
const teamNumericIds = new Set<string>(teamNumericBuiltInQuestionIds);
const categoricalBuiltInIds = new Set<string>(categoricalBuiltInQuestionIds);
const matchResults = new Set(['team1', 'team2', 'draw']);
const firstTryAnswers = new Set(['team1', 'team2', 'no-tries']);
const highestScoringHalfAnswers = new Set(['first', 'second', 'equal']);
const observationStatuses = new Set(['pending', 'provisional', 'confirmed']);
const matchObservationStatuses = new Set(['provisional', 'confirmed']);

const issue = validationIssue;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isStableId = (value: unknown): value is string =>
  isNonEmptyString(value) && idPattern.test(value);

const isSafeNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  Number.isSafeInteger(value) &&
  value >= 0;

const isPositiveSafeInteger = (value: unknown): value is number =>
  isSafeNonNegativeInteger(value) && value > 0;

const addNumericIssue = (
  issues: ValidationIssue[],
  path: readonly (string | number)[],
): void => {
  issues.push(
    issue(
      'invalid_numeric_answer',
      path,
      'Numeric answers must be finite, non-negative safe integers.',
    ),
  );
};

const pathToString = (path: readonly (string | number)[]): string =>
  path.join('.');

export const assertValid = (result: ValidationResult): void => {
  if (!result.valid) {
    throw new ScoringValidationError(result.issues);
  }
};

export const validationResult = (
  issues: readonly ValidationIssue[],
): ValidationResult => ({
  valid: issues.length === 0,
  issues,
});

export const validateRuleset = (ruleset: unknown): ValidationResult => {
  const issues: ValidationIssue[] = [];

  if (!isRecord(ruleset)) {
    return validationResult([
      issue('invalid_ruleset', ['ruleset'], 'Ruleset must be an object.'),
    ]);
  }

  if (ruleset.schemaVersion !== RULESET_SCHEMA_VERSION) {
    issues.push(
      issue(
        'invalid_schema_version',
        ['ruleset', 'schemaVersion'],
        `Ruleset schemaVersion must be ${RULESET_SCHEMA_VERSION}.`,
      ),
    );
  }

  if (!isNonEmptyString(ruleset.id)) {
    issues.push(
      issue('invalid_ruleset_id', ['ruleset', 'id'], 'Ruleset id is required.'),
    );
  }

  if (!isNonEmptyString(ruleset.version)) {
    issues.push(
      issue(
        'invalid_ruleset_version',
        ['ruleset', 'version'],
        'Ruleset version is required.',
      ),
    );
  }

  if (!Array.isArray(ruleset.questions)) {
    issues.push(
      issue(
        'invalid_questions',
        ['ruleset', 'questions'],
        'Ruleset questions must be an array.',
      ),
    );
    return validationResult(issues);
  }

  const seenQuestionIds = new Set<string>();

  ruleset.questions.forEach((question, index) => {
    const path = ['ruleset', 'questions', index] as const;

    if (!isRecord(question)) {
      issues.push(
        issue(
          'invalid_question',
          path,
          'Question definition must be an object.',
        ),
      );
      return;
    }

    if (!isStableId(question.id)) {
      issues.push(
        issue(
          'invalid_question_id',
          [...path, 'id'],
          'Question id must be a stable lower-case identifier.',
        ),
      );
    } else if (seenQuestionIds.has(question.id)) {
      issues.push(
        issue(
          'duplicate_question_id',
          [...path, 'id'],
          `Question id '${question.id}' is duplicated.`,
        ),
      );
    } else {
      seenQuestionIds.add(question.id);
    }

    if (!isNonEmptyString(question.label)) {
      issues.push(
        issue(
          'invalid_question_label',
          [...path, 'label'],
          'Question label is required.',
        ),
      );
    }

    if (typeof question.enabled !== 'boolean') {
      issues.push(
        issue(
          'invalid_question_enabled',
          [...path, 'enabled'],
          'Question enabled flag must be boolean.',
        ),
      );
    }

    if (
      typeof question.type !== 'string' ||
      !allowedQuestionTypes.has(question.type)
    ) {
      issues.push(
        issue(
          'unknown_question_type',
          [...path, 'type'],
          'Question type is not supported by this scoring engine.',
        ),
      );
      return;
    }

    if (question.type === 'built-in-team-numeric') {
      if (typeof question.id !== 'string' || !teamNumericIds.has(question.id)) {
        issues.push(
          issue(
            'invalid_built_in_question_id',
            [...path, 'id'],
            'Built-in team numeric question id is not supported.',
          ),
        );
      }

      if (!isPositiveSafeInteger(question.rate)) {
        issues.push(
          issue(
            'invalid_rate',
            [...path, 'rate'],
            'Numeric deduction rate must be a positive safe integer.',
          ),
        );
      }
    }

    if (question.type === 'built-in-categorical') {
      if (
        typeof question.id !== 'string' ||
        !categoricalBuiltInIds.has(question.id)
      ) {
        issues.push(
          issue(
            'invalid_built_in_question_id',
            [...path, 'id'],
            'Built-in categorical question id is not supported.',
          ),
        );
      }

      if (!isPositiveSafeInteger(question.incorrectDeduction)) {
        issues.push(
          issue(
            'invalid_deduction',
            [...path, 'incorrectDeduction'],
            'Incorrect-answer deduction must be a positive safe integer.',
          ),
        );
      }
    }

    if (question.type === 'custom-numeric') {
      if (typeof question.id === 'string' && builtInIds.has(question.id)) {
        issues.push(
          issue(
            'reserved_question_id',
            [...path, 'id'],
            'Custom questions cannot reuse built-in question ids.',
          ),
        );
      }

      if (!isPositiveSafeInteger(question.rate)) {
        issues.push(
          issue(
            'invalid_rate',
            [...path, 'rate'],
            'Numeric deduction rate must be a positive safe integer.',
          ),
        );
      }
    }

    if (question.type === 'custom-categorical') {
      if (typeof question.id === 'string' && builtInIds.has(question.id)) {
        issues.push(
          issue(
            'reserved_question_id',
            [...path, 'id'],
            'Custom questions cannot reuse built-in question ids.',
          ),
        );
      }

      if (!isPositiveSafeInteger(question.incorrectDeduction)) {
        issues.push(
          issue(
            'invalid_deduction',
            [...path, 'incorrectDeduction'],
            'Incorrect-answer deduction must be a positive safe integer.',
          ),
        );
      }

      if (!Array.isArray(question.options) || question.options.length < 2) {
        issues.push(
          issue(
            'invalid_options',
            [...path, 'options'],
            'Custom categorical questions need at least two options.',
          ),
        );
      } else {
        const seenOptionIds = new Set<string>();

        question.options.forEach((option, optionIndex) => {
          const optionPath = [...path, 'options', optionIndex] as const;

          if (!isRecord(option)) {
            issues.push(
              issue(
                'invalid_option',
                optionPath,
                'Custom categorical option must be an object.',
              ),
            );
            return;
          }

          if (!isStableId(option.id)) {
            issues.push(
              issue(
                'invalid_option_id',
                [...optionPath, 'id'],
                'Custom categorical option id must be stable.',
              ),
            );
          } else if (seenOptionIds.has(option.id)) {
            issues.push(
              issue(
                'duplicate_option_id',
                [...optionPath, 'id'],
                `Option id '${option.id}' is duplicated.`,
              ),
            );
          } else {
            seenOptionIds.add(option.id);
          }

          if (!isNonEmptyString(option.label)) {
            issues.push(
              issue(
                'invalid_option_label',
                [...optionPath, 'label'],
                'Custom categorical option label is required.',
              ),
            );
          }
        });
      }
    }
  });

  return validationResult(issues);
};

export const createRulesetSnapshot = (
  ruleset: RulesetSnapshot,
): RulesetSnapshot => {
  const validation = validateRuleset(ruleset);
  assertValid(validation);

  return {
    schemaVersion: RULESET_SCHEMA_VERSION,
    id: ruleset.id,
    version: ruleset.version,
    questions: ruleset.questions.map((question) => {
      if (question.type === 'custom-categorical') {
        return {
          id: question.id,
          label: question.label,
          type: question.type,
          enabled: question.enabled,
          incorrectDeduction: question.incorrectDeduction,
          options: question.options.map((option) => ({
            id: option.id,
            label: option.label,
          })),
        };
      }

      return { ...question };
    }),
  };
};

export const enabledQuestions = (
  ruleset: RulesetSnapshot,
): readonly QuestionDefinition[] =>
  ruleset.questions.filter((question) => question.enabled);

export const questionById = (
  ruleset: RulesetSnapshot,
): ReadonlyMap<QuestionId, QuestionDefinition> =>
  new Map(ruleset.questions.map((question) => [question.id, question]));

export const isBuiltInEnabled = (
  ruleset: RulesetSnapshot,
  id: BuiltInQuestionId,
): boolean =>
  ruleset.questions.some((question) => question.id === id && question.enabled);

const validateKnownKeys = (
  value: Record<string, unknown>,
  path: readonly (string | number)[],
  allowedKeys: ReadonlySet<string>,
  issues: ValidationIssue[],
): void => {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      issues.push(
        issue(
          'unexpected_answer',
          [...path, key],
          `Unexpected answer field '${key}'.`,
        ),
      );
    }
  }
};

const assertSafeNumberField = (
  record: Record<string, unknown>,
  field: string,
  path: readonly (string | number)[],
  issues: ValidationIssue[],
): number | undefined => {
  if (!hasOwn(record, field)) {
    issues.push(
      issue(
        'missing_required_answer',
        [...path, field],
        `Missing required answer '${field}'.`,
      ),
    );
    return undefined;
  }

  const value = record[field];

  if (!isSafeNonNegativeInteger(value)) {
    addNumericIssue(issues, [...path, field]);
    return undefined;
  }

  return value;
};

const validateMatchResult = (
  value: unknown,
  path: readonly (string | number)[],
  issues: ValidationIssue[],
): value is MatchResult => {
  if (typeof value !== 'string' || !matchResults.has(value)) {
    issues.push(
      issue('invalid_answer', path, 'Answer must be Team1, Team2, or Draw.'),
    );
    return false;
  }

  return true;
};

const validateFirstTry = (
  value: unknown,
  path: readonly (string | number)[],
  issues: ValidationIssue[],
): value is FirstTryAnswer => {
  if (typeof value !== 'string' || !firstTryAnswers.has(value)) {
    issues.push(
      issue(
        'invalid_answer',
        path,
        'Answer must be Team1, Team2, or No tries.',
      ),
    );
    return false;
  }

  return true;
};

const validateHighestScoringHalf = (
  value: unknown,
  path: readonly (string | number)[],
  issues: ValidationIssue[],
): value is HighestScoringHalf => {
  if (typeof value !== 'string' || !highestScoringHalfAnswers.has(value)) {
    issues.push(
      issue(
        'invalid_answer',
        path,
        'Answer must be First, Second, or Equal points.',
      ),
    );
    return false;
  }

  return true;
};

export const validatePrediction = (
  prediction: unknown,
  ruleset: RulesetSnapshot,
): ValidationResult => {
  const issues: ValidationIssue[] = [];
  const rulesetValidation = validateRuleset(ruleset);

  if (!rulesetValidation.valid) {
    return rulesetValidation;
  }

  if (!isRecord(prediction)) {
    return validationResult([
      issue(
        'invalid_prediction',
        ['prediction'],
        'Prediction must be an object.',
      ),
    ]);
  }

  validateKnownKeys(
    prediction,
    ['prediction'],
    new Set([
      'team1',
      'team2',
      'matchResult',
      'firstTry',
      'highestScoringHalf',
      'halfTimeLeader',
      'customAnswers',
    ]),
    issues,
  );

  const teamAnswers: Partial<
    Record<'team1' | 'team2', Record<string, number>>
  > = {};
  const cardQuestionIds = ['yellow-cards', 'red-cards'] as const;

  for (const side of teamSides) {
    const teamPath = ['prediction', side] as const;
    const team = prediction[side];

    if (!isRecord(team)) {
      issues.push(
        issue(
          'missing_required_answer',
          teamPath,
          `Missing required ${side} prediction answers.`,
        ),
      );
      continue;
    }

    const allowedTeamKeys = new Set<string>(scoringComponentFields);

    for (const id of cardQuestionIds) {
      const field = teamNumericFieldByQuestionId[id];

      if (field && isBuiltInEnabled(ruleset, id)) {
        allowedTeamKeys.add(field);
      }
    }

    validateKnownKeys(team, teamPath, allowedTeamKeys, issues);

    const values: Record<string, number> = {};

    for (const field of scoringComponentFields) {
      const value = assertSafeNumberField(team, field, teamPath, issues);

      if (value !== undefined) {
        values[field] = value;
      }
    }

    for (const id of cardQuestionIds) {
      const field = teamNumericFieldByQuestionId[id];

      if (!field) {
        continue;
      }

      if (isBuiltInEnabled(ruleset, id)) {
        const value = assertSafeNumberField(team, field, teamPath, issues);

        if (value !== undefined) {
          values[field] = value;
        }
      } else if (hasOwn(team, field)) {
        issues.push(
          issue(
            'unexpected_answer',
            [...teamPath, field],
            `Answer '${field}' is not enabled by this ruleset.`,
          ),
        );
      }
    }

    if (
      isSafeNonNegativeInteger(values.conversions) &&
      isSafeNonNegativeInteger(values.tries) &&
      values.conversions > values.tries
    ) {
      issues.push(
        issue(
          'conversion_count_exceeds_tries',
          [...teamPath, 'conversions'],
          'Conversions cannot exceed tries.',
        ),
      );
    }

    if (hasAllScoringComponents(values)) {
      tryDeriveTeamScore(values, teamPath, issues);
    }

    teamAnswers[side] = values;
  }

  validateBuiltInCategoricalPrediction(
    prediction,
    ruleset,
    issues,
    teamAnswers,
  );
  validateCustomPredictionAnswers(prediction, ruleset, issues);

  return validationResult(issues);
};

const hasAllScoringComponents = (
  values: Record<string, number> | undefined,
): values is Record<ScoringComponentField, number> =>
  values !== undefined &&
  scoringComponentFields.every((field) =>
    isSafeNonNegativeInteger(values[field]),
  );

const tryDeriveTeamScore = (
  values: Record<ScoringComponentField, number>,
  path: readonly (string | number)[],
  issues: ValidationIssue[],
): number | undefined => {
  try {
    return deriveTeamScore(values);
  } catch (error) {
    if (error instanceof ScoringValidationError) {
      for (const validationError of error.issues) {
        const remappedPath =
          validationError.path[0] === 'components'
            ? [...path, ...validationError.path.slice(1)]
            : path;

        issues.push({ ...validationError, path: remappedPath });
      }

      return undefined;
    }

    issues.push(
      issue(
        'unsafe_arithmetic',
        path,
        'Derived team score is outside the safe integer range.',
      ),
    );
    return undefined;
  }
};

const validateBuiltInCategoricalPrediction = (
  prediction: Record<string, unknown>,
  ruleset: RulesetSnapshot,
  issues: ValidationIssue[],
  teamAnswers: Partial<Record<'team1' | 'team2', Record<string, number>>>,
): void => {
  if (isBuiltInEnabled(ruleset, 'match-result')) {
    if (!hasOwn(prediction, 'matchResult')) {
      issues.push(
        issue(
          'missing_required_answer',
          ['prediction', 'matchResult'],
          'Match result answer is required.',
        ),
      );
    } else if (
      validateMatchResult(
        prediction.matchResult,
        ['prediction', 'matchResult'],
        issues,
      ) &&
      hasAllScoringComponents(teamAnswers.team1) &&
      hasAllScoringComponents(teamAnswers.team2)
    ) {
      const team1Score = tryDeriveTeamScore(
        teamAnswers.team1,
        ['prediction', 'team1'],
        issues,
      );
      const team2Score = tryDeriveTeamScore(
        teamAnswers.team2,
        ['prediction', 'team2'],
        issues,
      );

      if (team1Score === undefined || team2Score === undefined) {
        return;
      }

      const derivedResult = deriveMatchResult(team1Score, team2Score);

      if (prediction.matchResult !== derivedResult) {
        issues.push(
          issue(
            'match_result_contradicts_scores',
            ['prediction', 'matchResult'],
            'Selected match result must agree with derived predicted scores.',
          ),
        );
      }
    }
  } else if (hasOwn(prediction, 'matchResult')) {
    issues.push(
      issue(
        'unexpected_answer',
        ['prediction', 'matchResult'],
        'Match result answer is not enabled by this ruleset.',
      ),
    );
  }

  if (isBuiltInEnabled(ruleset, 'first-try')) {
    if (!hasOwn(prediction, 'firstTry')) {
      issues.push(
        issue(
          'missing_required_answer',
          ['prediction', 'firstTry'],
          'First-try answer is required.',
        ),
      );
    } else if (
      validateFirstTry(prediction.firstTry, ['prediction', 'firstTry'], issues)
    ) {
      const team1Tries = teamAnswers.team1?.tries;
      const team2Tries = teamAnswers.team2?.tries;

      if (prediction.firstTry === 'no-tries') {
        if (team1Tries !== 0 || team2Tries !== 0) {
          issues.push(
            issue(
              'first_try_contradicts_tries',
              ['prediction', 'firstTry'],
              'No tries requires zero predicted tries for both teams.',
            ),
          );
        }
      } else if (teamAnswers[prediction.firstTry]?.tries === 0) {
        issues.push(
          issue(
            'first_try_contradicts_tries',
            ['prediction', 'firstTry'],
            'Selected first-try team must have at least one predicted try.',
          ),
        );
      }
    }
  } else if (hasOwn(prediction, 'firstTry')) {
    issues.push(
      issue(
        'unexpected_answer',
        ['prediction', 'firstTry'],
        'First-try answer is not enabled by this ruleset.',
      ),
    );
  }

  validateSimpleCategoricalPrediction(
    prediction,
    ruleset,
    'highest-scoring-half',
    'highestScoringHalf',
    validateHighestScoringHalf,
    issues,
  );
  validateSimpleCategoricalPrediction(
    prediction,
    ruleset,
    'half-time-leader',
    'halfTimeLeader',
    validateMatchResult,
    issues,
  );
};

const validateSimpleCategoricalPrediction = (
  prediction: Record<string, unknown>,
  ruleset: RulesetSnapshot,
  questionId: CategoricalBuiltInQuestionId,
  field: string,
  validator: (
    value: unknown,
    path: readonly (string | number)[],
    issues: ValidationIssue[],
  ) => boolean,
  issues: ValidationIssue[],
): void => {
  if (isBuiltInEnabled(ruleset, questionId)) {
    if (!hasOwn(prediction, field)) {
      issues.push(
        issue(
          'missing_required_answer',
          ['prediction', field],
          `Answer '${field}' is required.`,
        ),
      );
    } else {
      validator(prediction[field], ['prediction', field], issues);
    }
  } else if (hasOwn(prediction, field)) {
    issues.push(
      issue(
        'unexpected_answer',
        ['prediction', field],
        `Answer '${field}' is not enabled by this ruleset.`,
      ),
    );
  }
};

const validateCustomPredictionAnswers = (
  prediction: Record<string, unknown>,
  ruleset: RulesetSnapshot,
  issues: ValidationIssue[],
): void => {
  const customQuestions = enabledQuestions(ruleset).filter(
    (question) =>
      question.type === 'custom-numeric' ||
      question.type === 'custom-categorical',
  );
  const answers = prediction.customAnswers;
  const answerRecord = isRecord(answers) ? answers : undefined;

  if (answers !== undefined && !answerRecord) {
    issues.push(
      issue(
        'invalid_custom_answers',
        ['prediction', 'customAnswers'],
        'Custom answers must be an object keyed by question id.',
      ),
    );
    return;
  }

  for (const question of customQuestions) {
    if (!answerRecord || !hasOwn(answerRecord, question.id)) {
      issues.push(
        issue(
          'missing_required_answer',
          ['prediction', 'customAnswers', question.id],
          `Custom answer '${question.id}' is required.`,
        ),
      );
      continue;
    }

    const value = answerRecord[question.id];

    if (question.type === 'custom-numeric') {
      if (!isSafeNonNegativeInteger(value)) {
        addNumericIssue(issues, ['prediction', 'customAnswers', question.id]);
      }
    } else if (
      typeof value !== 'string' ||
      !question.options.some((option) => option.id === value)
    ) {
      issues.push(
        issue(
          'invalid_answer',
          ['prediction', 'customAnswers', question.id],
          'Custom categorical answer must use one of the option ids.',
        ),
      );
    }
  }

  if (answerRecord) {
    const enabledCustomIds = new Set(
      customQuestions.map((question) => question.id),
    );

    for (const answerId of Object.keys(answerRecord)) {
      if (!enabledCustomIds.has(answerId)) {
        issues.push(
          issue(
            'unexpected_answer',
            ['prediction', 'customAnswers', answerId],
            `Custom answer '${answerId}' is not enabled by this ruleset.`,
          ),
        );
      }
    }
  }
};

export const validateObservations = (
  observations: unknown,
  ruleset: RulesetSnapshot,
): ValidationResult => {
  const issues: ValidationIssue[] = [];
  const rulesetValidation = validateRuleset(ruleset);

  if (!rulesetValidation.valid) {
    return rulesetValidation;
  }

  if (!isRecord(observations)) {
    return validationResult([
      issue(
        'invalid_observations',
        ['observations'],
        'Observations must be an object.',
      ),
    ]);
  }

  validateKnownKeys(
    observations,
    ['observations'],
    new Set([
      'matchStatus',
      'team1',
      'team2',
      'firstTry',
      'highestScoringHalf',
      'halfTimeLeader',
      'customAnswers',
    ]),
    issues,
  );

  if (
    typeof observations.matchStatus !== 'string' ||
    !matchObservationStatuses.has(observations.matchStatus)
  ) {
    issues.push(
      issue(
        'invalid_match_status',
        ['observations', 'matchStatus'],
        'Match status must be provisional or confirmed.',
      ),
    );
  }

  validateTeamObservations(observations, ruleset, issues);
  validateBuiltInCategoricalObservations(observations, ruleset, issues);
  validateFirstTryObservationConsistency(observations, ruleset, issues);
  validateCustomObservations(observations, ruleset, issues);

  return validationResult(issues);
};

const requiredScoringObservationFields = (
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

const validateTeamObservations = (
  observations: Record<string, unknown>,
  ruleset: RulesetSnapshot,
  issues: ValidationIssue[],
): void => {
  const requiredScoringFields = requiredScoringObservationFields(ruleset);
  const cardQuestionIds = ['yellow-cards', 'red-cards'] as const;

  for (const side of teamSides) {
    const teamPath = ['observations', side] as const;
    const team = observations[side];

    if (!isRecord(team)) {
      issues.push(
        issue(
          'missing_required_observation',
          teamPath,
          `Missing ${side} observations.`,
        ),
      );
      continue;
    }

    const allowedTeamKeys = new Set<string>();

    requiredScoringFields.forEach((field) => allowedTeamKeys.add(field));

    for (const id of cardQuestionIds) {
      const field = teamNumericFieldByQuestionId[id];

      if (field && isBuiltInEnabled(ruleset, id)) {
        allowedTeamKeys.add(field);
      }
    }

    validateKnownKeys(team, teamPath, allowedTeamKeys, issues);

    for (const field of scoringComponentFields) {
      if (requiredScoringFields.has(field)) {
        validateNumericObservation(team[field], [...teamPath, field], issues);
      } else if (hasOwn(team, field)) {
        issues.push(
          issue(
            'unexpected_observation',
            [...teamPath, field],
            `Observation '${field}' is not enabled by this ruleset.`,
          ),
        );
      }
    }

    for (const id of cardQuestionIds) {
      const field = teamNumericFieldByQuestionId[id];

      if (!field) {
        continue;
      }

      if (isBuiltInEnabled(ruleset, id)) {
        validateNumericObservation(team[field], [...teamPath, field], issues);
      } else if (hasOwn(team, field)) {
        issues.push(
          issue(
            'unexpected_observation',
            [...teamPath, field],
            `Observation '${field}' is not enabled by this ruleset.`,
          ),
        );
      }
    }

    validateObservedConversions(team, teamPath, issues);
    validateObservedDerivedScore(team, teamPath, issues);
  }
};

const validateObservedConversions = (
  team: Record<string, unknown>,
  teamPath: readonly (string | number)[],
  issues: ValidationIssue[],
): void => {
  const tries = readConfirmedOrProvisionalNumber(team.tries);
  const conversions = readConfirmedOrProvisionalNumber(team.conversions);

  if (tries !== undefined && conversions !== undefined && conversions > tries) {
    issues.push(
      issue(
        'conversion_count_exceeds_tries',
        [...teamPath, 'conversions'],
        'Conversions cannot exceed tries.',
      ),
    );
  }
};

const validateNumericObservation = (
  value: unknown,
  path: readonly (string | number)[],
  issues: ValidationIssue[],
): void => {
  validateObservationValue(value, path, issues, (answer, answerPath) => {
    if (!isSafeNonNegativeInteger(answer)) {
      addNumericIssue(issues, answerPath);
    }
  });
};

const validateObservationValue = (
  value: unknown,
  path: readonly (string | number)[],
  issues: ValidationIssue[],
  validateAnswer: (
    answer: unknown,
    answerPath: readonly (string | number)[],
  ) => void,
): void => {
  if (!isRecord(value)) {
    issues.push(
      issue(
        'missing_required_observation',
        path,
        `Observation '${pathToString(path)}' must be explicit.`,
      ),
    );
    return;
  }

  validateKnownKeys(value, path, new Set(['status', 'value']), issues);

  if (
    typeof value.status !== 'string' ||
    !observationStatuses.has(value.status)
  ) {
    issues.push(
      issue(
        'invalid_observation_status',
        [...path, 'status'],
        'Observation status must be pending, provisional, or confirmed.',
      ),
    );
    return;
  }

  if (value.status === 'pending') {
    if (hasOwn(value, 'value')) {
      issues.push(
        issue(
          'pending_observation_has_value',
          [...path, 'value'],
          'Pending observations must not include a value.',
        ),
      );
    }

    return;
  }

  if (!hasOwn(value, 'value')) {
    issues.push(
      issue(
        'missing_observed_value',
        [...path, 'value'],
        'Provisional and confirmed observations require a value.',
      ),
    );
    return;
  }

  validateAnswer(value.value, [...path, 'value']);
};

const readConfirmedOrProvisionalNumber = (
  value: unknown,
): number | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  if (value.status === 'pending') {
    return undefined;
  }

  return isSafeNonNegativeInteger(value.value) ? value.value : undefined;
};

const validateObservedDerivedScore = (
  team: Record<string, unknown>,
  teamPath: readonly (string | number)[],
  issues: ValidationIssue[],
): void => {
  const values = Object.fromEntries(
    scoringComponentFields.map((field) => [
      field,
      readConfirmedOrProvisionalNumber(team[field]),
    ]),
  );

  if (
    scoringComponentFields.every((field) =>
      isSafeNonNegativeInteger(values[field]),
    )
  ) {
    tryDeriveTeamScore(
      values as Record<ScoringComponentField, number>,
      teamPath,
      issues,
    );
  }
};

const validateBuiltInCategoricalObservations = (
  observations: Record<string, unknown>,
  ruleset: RulesetSnapshot,
  issues: ValidationIssue[],
): void => {
  validateCategoricalObservation(
    observations,
    ruleset,
    'first-try',
    'firstTry',
    validateFirstTry,
    issues,
  );
  validateCategoricalObservation(
    observations,
    ruleset,
    'highest-scoring-half',
    'highestScoringHalf',
    validateHighestScoringHalf,
    issues,
  );
  validateCategoricalObservation(
    observations,
    ruleset,
    'half-time-leader',
    'halfTimeLeader',
    validateMatchResult,
    issues,
  );
};

const validateCategoricalObservation = (
  observations: Record<string, unknown>,
  ruleset: RulesetSnapshot,
  questionId: CategoricalBuiltInQuestionId,
  field: string,
  validator: (
    value: unknown,
    path: readonly (string | number)[],
    issues: ValidationIssue[],
  ) => boolean,
  issues: ValidationIssue[],
): void => {
  if (isBuiltInEnabled(ruleset, questionId)) {
    validateObservationValue(
      observations[field],
      ['observations', field],
      issues,
      (answer, answerPath) => {
        validator(answer, answerPath, issues);
      },
    );
  } else if (hasOwn(observations, field)) {
    issues.push(
      issue(
        'unexpected_observation',
        ['observations', field],
        `Observation '${field}' is not enabled by this ruleset.`,
      ),
    );
  }
};

const validateFirstTryObservationConsistency = (
  observations: Record<string, unknown>,
  ruleset: RulesetSnapshot,
  issues: ValidationIssue[],
): void => {
  if (!isBuiltInEnabled(ruleset, 'first-try')) {
    return;
  }

  const firstTryObservation = observations.firstTry;

  if (!isRecord(firstTryObservation)) {
    return;
  }

  if (firstTryObservation.status === 'pending') {
    return;
  }

  if (
    firstTryObservation.status !== 'provisional' &&
    firstTryObservation.status !== 'confirmed'
  ) {
    return;
  }

  if (
    typeof firstTryObservation.value !== 'string' ||
    !firstTryAnswers.has(firstTryObservation.value)
  ) {
    return;
  }

  const firstTryValue = firstTryObservation.value as FirstTryAnswer;

  const teamTryCounts = Object.fromEntries(
    teamSides.map((side) => {
      const team = observations[side];

      return [
        side,
        isRecord(team)
          ? readConfirmedOrProvisionalNumber(team.tries)
          : undefined,
      ];
    }),
  ) as Partial<Record<'team1' | 'team2', number>>;

  if (firstTryValue === 'no-tries') {
    for (const side of teamSides) {
      const tries = teamTryCounts[side];

      if (tries !== undefined && tries > 0) {
        issues.push(
          issue(
            'first_try_observation_contradicts_tries',
            ['observations', side, 'tries', 'value'],
            `Observed no-tries first-try answer contradicts ${side} try count.`,
          ),
        );
      }
    }

    return;
  }

  const selectedTeam = firstTryValue;
  const selectedTeamTries = teamTryCounts[selectedTeam];

  if (selectedTeamTries === 0) {
    issues.push(
      issue(
        'first_try_observation_contradicts_tries',
        ['observations', selectedTeam, 'tries', 'value'],
        `Observed first-try team ${selectedTeam} contradicts its zero try count.`,
      ),
    );
  }
};

const validateCustomObservations = (
  observations: Record<string, unknown>,
  ruleset: RulesetSnapshot,
  issues: ValidationIssue[],
): void => {
  const customQuestions = enabledQuestions(ruleset).filter(
    (question) =>
      question.type === 'custom-numeric' ||
      question.type === 'custom-categorical',
  );
  const answers = observations.customAnswers;
  const answerRecord = isRecord(answers) ? answers : undefined;

  if (answers !== undefined && !answerRecord) {
    issues.push(
      issue(
        'invalid_custom_observations',
        ['observations', 'customAnswers'],
        'Custom observations must be an object keyed by question id.',
      ),
    );
    return;
  }

  for (const question of customQuestions) {
    if (!answerRecord || !hasOwn(answerRecord, question.id)) {
      issues.push(
        issue(
          'missing_required_observation',
          ['observations', 'customAnswers', question.id],
          `Custom observation '${question.id}' is required.`,
        ),
      );
      continue;
    }

    validateObservationValue(
      answerRecord[question.id],
      ['observations', 'customAnswers', question.id],
      issues,
      (answer, answerPath) => {
        if (question.type === 'custom-numeric') {
          if (!isSafeNonNegativeInteger(answer)) {
            addNumericIssue(issues, answerPath);
          }
          return;
        }

        if (
          typeof answer !== 'string' ||
          !question.options.some((option) => option.id === answer)
        ) {
          issues.push(
            issue(
              'invalid_answer',
              answerPath,
              'Custom categorical observation must use one of the option ids.',
            ),
          );
        }
      },
    );
  }

  if (answerRecord) {
    const enabledCustomIds = new Set(
      customQuestions.map((question) => question.id),
    );

    for (const answerId of Object.keys(answerRecord)) {
      if (!enabledCustomIds.has(answerId)) {
        issues.push(
          issue(
            'unexpected_observation',
            ['observations', 'customAnswers', answerId],
            `Custom observation '${answerId}' is not enabled by this ruleset.`,
          ),
        );
      }
    }
  }
};

export const customCategoricalOptions = (
  question: QuestionDefinition,
): readonly string[] =>
  question.type === 'custom-categorical'
    ? question.options.map((option) => option.id)
    : [];

export function readObservation<T>(
  value: ObservedValue<T> | undefined,
): ObservedValue<T> {
  return value ?? { status: 'pending' };
}

export const observationStatus = (
  value: ObservedValue<unknown> | undefined,
): ObservationStatus => readObservation(value).status;

export const ensureTypedPrediction = (
  prediction: FixturePrediction,
): FixturePrediction => prediction;

export const ensureTypedObservations = (
  observations: FixtureObservations,
): FixtureObservations => observations;

export type BuiltInCategoricalValue =
  MatchResult | FirstTryAnswer | HighestScoringHalf | HalfTimeLeader;

export type ValidCustomAnswerValue = CustomAnswerValue;
