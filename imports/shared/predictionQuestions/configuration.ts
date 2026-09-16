import {
  createRulesetSnapshot,
  defaultRuleset,
  type QuestionDefinition,
  type RulesetSnapshot,
} from '../scoring';
import {
  customQuestionAnswerTypes,
  optionalStandardQuestionIds,
  permanentCoreQuestionIds,
  PREDICTION_QUESTION_CONFIG_SCHEMA_VERSION,
  type CustomChoiceOptionConfig,
  type CustomChoiceQuestionConfig,
  type CustomNumberQuestionConfig,
  type CustomQuestionConfig,
  type FixturePredictionQuestionConfig,
  type OptionalStandardQuestionConfig,
  type OptionalStandardQuestionId,
  type RulesetQuestionConfigSource,
} from './types';

export const MAX_CUSTOM_QUESTIONS_PER_FIXTURE = 2;
export const MAX_CUSTOM_CHOICE_OPTIONS = 8;

export const QUESTION_CONFIG_TEXT_LIMITS = {
  banter: 240,
  choiceLabel: 80,
  countingDefinition: 500,
  prompt: 180,
} as const;

const stableIdPattern = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const optionalStandardIdSet = new Set<string>(optionalStandardQuestionIds);
const permanentCoreIdSet = new Set<string>(permanentCoreQuestionIds);
const customQuestionAnswerTypeSet = new Set<string>(customQuestionAnswerTypes);
const allBuiltInQuestionIds = new Set<string>([
  ...optionalStandardQuestionIds,
  ...permanentCoreQuestionIds,
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const cleanWhitespace = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');

const normalizeLabelForComparison = (value: string): string =>
  cleanWhitespace(value).toLocaleLowerCase('en-ZA');

const isSafeNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  Number.isSafeInteger(value) &&
  value >= 0;

const isPositiveSafeInteger = (value: unknown): value is number =>
  isSafeNonNegativeInteger(value) && value > 0;

const assertAllowedKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string,
): void => {
  const allowed = new Set(allowedKeys);
  const unknownKeys = Object.keys(value).filter((key) => !allowed.has(key));

  if (unknownKeys.length > 0) {
    questionConfigError(
      'unknown-question-config-field',
      `${label} contains unsupported fields: ${unknownKeys.join(', ')}.`,
    );
  }
};

export class PredictionQuestionConfigValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PredictionQuestionConfigValidationError';
    this.code = code;
  }
}

const questionConfigError = (code: string, message: string): never => {
  throw new PredictionQuestionConfigValidationError(code, message);
};

const sanitizeStableId = (
  value: unknown,
  label: string,
  options: { readonly allowBuiltIn?: boolean } = {},
): string => {
  if (typeof value !== 'string' || !stableIdPattern.test(value)) {
    questionConfigError(
      'invalid-question-config-id',
      `${label} must be a stable lower-case identifier.`,
    );
  }
  const id = value as string;

  if (!options.allowBuiltIn && allBuiltInQuestionIds.has(id)) {
    questionConfigError(
      'reserved-question-config-id',
      `${label} cannot reuse a built-in question id.`,
    );
  }

  return id;
};

const sanitizeRequiredText = (
  value: unknown,
  label: string,
  maxLength: number,
): string => {
  if (typeof value !== 'string') {
    questionConfigError(
      'invalid-question-config-text',
      `${label} is required.`,
    );
  }

  const cleaned = cleanWhitespace(value as string);

  if (!cleaned) {
    questionConfigError(
      'invalid-question-config-text',
      `${label} is required.`,
    );
  }

  if (cleaned.length > maxLength) {
    questionConfigError(
      'invalid-question-config-text',
      `${label} must be ${maxLength} characters or fewer.`,
    );
  }

  return cleaned;
};

const sanitizeOptionalText = (
  value: unknown,
  label: string,
  maxLength: number,
): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    questionConfigError(
      'invalid-question-config-text',
      `${label} must be text.`,
    );
  }

  const cleaned = cleanWhitespace(value as string);

  if (!cleaned) {
    return undefined;
  }

  if (cleaned.length > maxLength) {
    questionConfigError(
      'invalid-question-config-text',
      `${label} must be ${maxLength} characters or fewer.`,
    );
  }

  return cleaned;
};

const sanitizeNonNegativeInteger = (value: unknown, label: string): number => {
  if (!isSafeNonNegativeInteger(value)) {
    questionConfigError(
      'invalid-question-config-number',
      `${label} must be a finite non-negative whole number.`,
    );
  }

  return value as number;
};

const sanitizePositiveInteger = (value: unknown, label: string): number => {
  if (!isPositiveSafeInteger(value)) {
    questionConfigError(
      'invalid-question-config-number',
      `${label} must be a finite whole number greater than zero.`,
    );
  }

  return value as number;
};

const optionalStandardQuestionFromRuleset = (
  ruleset: RulesetSnapshot,
  id: OptionalStandardQuestionId,
): OptionalStandardQuestionConfig => {
  const question = ruleset.questions.find((candidate) => candidate.id === id);

  if (question?.type !== 'built-in-categorical') {
    questionConfigError(
      'invalid-question-config-default',
      `Default ruleset is missing optional standard question '${id}'.`,
    );
  }
  const categoricalQuestion = question as Extract<
    QuestionDefinition,
    { type: 'built-in-categorical' }
  >;

  return {
    enabled: categoricalQuestion.enabled,
    id,
    incorrectDeduction: categoricalQuestion.incorrectDeduction,
  };
};

export const defaultFixturePredictionQuestionConfig = (
  ruleset: RulesetSnapshot = defaultRuleset,
): FixturePredictionQuestionConfig => ({
  customQuestions: [],
  optionalStandardQuestions: optionalStandardQuestionIds.map((id) =>
    optionalStandardQuestionFromRuleset(ruleset, id),
  ),
  schemaVersion: PREDICTION_QUESTION_CONFIG_SCHEMA_VERSION,
});

export const predictionQuestionConfigForFixture = (
  source: RulesetQuestionConfigSource,
): FixturePredictionQuestionConfig => {
  if (source.predictionQuestionConfig) {
    return normalizeFixturePredictionQuestionConfig(
      source.predictionQuestionConfig,
    );
  }

  return defaultFixturePredictionQuestionConfig(
    source.rulesetSnapshot ?? defaultRuleset,
  );
};

export const normalizeFixturePredictionQuestionConfig = (
  input: unknown,
): FixturePredictionQuestionConfig => {
  if (!isRecord(input)) {
    questionConfigError(
      'invalid-question-config',
      'Prediction question configuration is required.',
    );
  }
  const record = input as Record<string, unknown>;

  assertAllowedKeys(
    record,
    ['schemaVersion', 'optionalStandardQuestions', 'customQuestions'],
    'Prediction question configuration',
  );

  if (record.schemaVersion !== PREDICTION_QUESTION_CONFIG_SCHEMA_VERSION) {
    questionConfigError(
      'invalid-question-config-version',
      `Prediction question configuration version must be ${PREDICTION_QUESTION_CONFIG_SCHEMA_VERSION}.`,
    );
  }

  return {
    customQuestions: sanitizeCustomQuestions(record.customQuestions),
    optionalStandardQuestions: sanitizeOptionalStandardQuestions(
      record.optionalStandardQuestions,
    ),
    schemaVersion: PREDICTION_QUESTION_CONFIG_SCHEMA_VERSION,
  };
};

const sanitizeOptionalStandardQuestions = (
  value: unknown,
): readonly OptionalStandardQuestionConfig[] => {
  if (!Array.isArray(value)) {
    questionConfigError(
      'invalid-question-config-standard',
      'Optional standard questions must be an array.',
    );
  }
  const candidates = value as unknown[];

  const byId = new Map<
    OptionalStandardQuestionId,
    OptionalStandardQuestionConfig
  >();

  candidates.forEach((candidate: unknown, index: number) => {
    if (!isRecord(candidate)) {
      questionConfigError(
        'invalid-question-config-standard',
        `Optional standard question ${index + 1} is invalid.`,
      );
    }
    const record = candidate as Record<string, unknown>;

    assertAllowedKeys(
      record,
      ['id', 'enabled', 'incorrectDeduction'],
      'Optional standard question',
    );

    if (
      typeof record.id !== 'string' ||
      !optionalStandardIdSet.has(record.id)
    ) {
      if (typeof record.id === 'string' && permanentCoreIdSet.has(record.id)) {
        questionConfigError(
          'core-question-not-configurable',
          'Permanent core questions cannot be disabled or configured here.',
        );
      }

      questionConfigError(
        'unsupported-standard-question',
        'Optional standard question is not supported.',
      );
    }

    if (typeof record.enabled !== 'boolean') {
      questionConfigError(
        'invalid-question-config-enabled',
        'Optional standard question enabled state must be true or false.',
      );
    }

    const id = record.id as OptionalStandardQuestionId;

    if (byId.has(id)) {
      questionConfigError(
        'duplicate-question-config-id',
        `Optional standard question '${id}' is duplicated.`,
      );
    }

    byId.set(id, {
      enabled: record.enabled as boolean,
      id,
      incorrectDeduction: sanitizePositiveInteger(
        record.incorrectDeduction,
        'Incorrect-answer deduction',
      ),
    });
  });

  const missing = optionalStandardQuestionIds.find((id) => !byId.has(id));

  if (missing) {
    questionConfigError(
      'missing-standard-question',
      `Optional standard question '${missing}' is required.`,
    );
  }

  return optionalStandardQuestionIds.map((id) => byId.get(id)!);
};

const sanitizeCustomQuestions = (
  value: unknown,
): readonly CustomQuestionConfig[] => {
  if (!Array.isArray(value)) {
    questionConfigError(
      'invalid-question-config-custom',
      'Custom questions must be an array.',
    );
  }
  const candidates = value as unknown[];

  if (candidates.length > MAX_CUSTOM_QUESTIONS_PER_FIXTURE) {
    questionConfigError(
      'too-many-custom-questions',
      `Maximum of ${MAX_CUSTOM_QUESTIONS_PER_FIXTURE} custom questions.`,
    );
  }

  const seenIds = new Set<string>();

  return candidates.map((candidate: unknown, index: number) => {
    const question = sanitizeCustomQuestion(candidate, index);

    if (seenIds.has(question.id)) {
      questionConfigError(
        'duplicate-question-config-id',
        `Custom question id '${question.id}' is duplicated.`,
      );
    }

    seenIds.add(question.id);

    return {
      ...question,
      order: index + 1,
    };
  });
};

const sanitizeCustomQuestion = (
  value: unknown,
  index: number,
): CustomQuestionConfig => {
  if (!isRecord(value)) {
    questionConfigError(
      'invalid-question-config-custom',
      `Custom question ${index + 1} is invalid.`,
    );
  }
  const record = value as Record<string, unknown>;

  if (
    typeof record.answerType !== 'string' ||
    !customQuestionAnswerTypeSet.has(record.answerType)
  ) {
    questionConfigError(
      'unsupported-custom-question-type',
      'Custom question answer type is not supported.',
    );
  }

  const base = {
    id: sanitizeStableId(record.id, 'Custom question id'),
    prompt: sanitizeRequiredText(
      record.prompt,
      'Question',
      QUESTION_CONFIG_TEXT_LIMITS.prompt,
    ),
    countingDefinition: sanitizeRequiredText(
      record.countingDefinition,
      'Counting definition',
      QUESTION_CONFIG_TEXT_LIMITS.countingDefinition,
    ),
  };
  const banter = sanitizeOptionalText(
    record.banter,
    'Banter/context',
    QUESTION_CONFIG_TEXT_LIMITS.banter,
  );

  if (record.answerType === 'number') {
    assertAllowedKeys(
      record,
      [
        'answerType',
        'banter',
        'countingDefinition',
        'deductionPerUnit',
        'id',
        'max',
        'min',
        'order',
        'prompt',
      ],
      'Number custom question',
    );

    const min = sanitizeNonNegativeInteger(record.min, 'Minimum answer');
    const max = sanitizeNonNegativeInteger(record.max, 'Maximum answer');

    if (max < min) {
      questionConfigError(
        'invalid-question-config-range',
        'Maximum must be greater than or equal to minimum.',
      );
    }

    return {
      ...base,
      ...(banter ? { banter } : {}),
      answerType: 'number',
      deductionPerUnit: sanitizePositiveInteger(
        record.deductionPerUnit,
        'Deduction per unit',
      ),
      max,
      min,
      order: index + 1,
    } satisfies CustomNumberQuestionConfig;
  }

  assertAllowedKeys(
    record,
    [
      'answerType',
      'banter',
      'countingDefinition',
      'id',
      'incorrectDeduction',
      'options',
      'order',
      'prompt',
    ],
    'Choice custom question',
  );

  return {
    ...base,
    ...(banter ? { banter } : {}),
    answerType: 'choice',
    incorrectDeduction: sanitizePositiveInteger(
      record.incorrectDeduction,
      'Incorrect-answer deduction',
    ),
    options: sanitizeChoiceOptions(record.options),
    order: index + 1,
  } satisfies CustomChoiceQuestionConfig;
};

const sanitizeChoiceOptions = (
  value: unknown,
): readonly CustomChoiceOptionConfig[] => {
  if (!Array.isArray(value) || value.length < 2) {
    questionConfigError('invalid-choice-options', 'Add at least two choices.');
  }

  const candidates = value as unknown[];

  if (candidates.length > MAX_CUSTOM_CHOICE_OPTIONS) {
    questionConfigError(
      'too-many-choice-options',
      `Maximum of ${MAX_CUSTOM_CHOICE_OPTIONS} choices.`,
    );
  }
  const seenIds = new Set<string>();
  const seenLabels = new Set<string>();

  return candidates.map((candidate: unknown, index: number) => {
    if (!isRecord(candidate)) {
      questionConfigError(
        'invalid-choice-option',
        `Choice option ${index + 1} is invalid.`,
      );
    }
    const record = candidate as Record<string, unknown>;

    assertAllowedKeys(record, ['id', 'label'], 'Choice option');

    const id = sanitizeStableId(record.id, 'Choice option id');
    const label = sanitizeRequiredText(
      record.label,
      'Choice label',
      QUESTION_CONFIG_TEXT_LIMITS.choiceLabel,
    );
    const normalizedLabel = normalizeLabelForComparison(label);

    if (seenIds.has(id)) {
      questionConfigError(
        'duplicate-choice-option-id',
        `Choice option id '${id}' is duplicated.`,
      );
    }

    if (seenLabels.has(normalizedLabel)) {
      questionConfigError(
        'duplicate-choice-option-label',
        'Choice labels must be unique.',
      );
    }

    seenIds.add(id);
    seenLabels.add(normalizedLabel);

    return {
      id,
      label,
    };
  });
};

export const buildConfiguredRulesetSnapshot = (
  configInput: FixturePredictionQuestionConfig,
  baseRuleset: RulesetSnapshot = defaultRuleset,
): RulesetSnapshot => {
  const config = normalizeFixturePredictionQuestionConfig(configInput);
  const optionalById = new Map(
    config.optionalStandardQuestions.map((question) => [question.id, question]),
  );
  const questions: QuestionDefinition[] = baseRuleset.questions.map(
    (question) => {
      const optionalConfig = optionalById.get(
        question.id as OptionalStandardQuestionId,
      );

      if (optionalConfig && question.type === 'built-in-categorical') {
        return {
          ...question,
          enabled: optionalConfig.enabled,
          incorrectDeduction: optionalConfig.incorrectDeduction,
        };
      }

      return { ...question };
    },
  );
  const customQuestions = config.customQuestions.map((question) => {
    if (question.answerType === 'number') {
      return {
        id: question.id,
        label: question.prompt,
        type: 'custom-numeric',
        enabled: true,
        ...(question.banter ? { banter: question.banter } : {}),
        countingDefinition: question.countingDefinition,
        max: question.max,
        min: question.min,
        order: question.order,
        prompt: question.prompt,
        rate: question.deductionPerUnit,
      } satisfies QuestionDefinition;
    }

    return {
      id: question.id,
      label: question.prompt,
      type: 'custom-categorical',
      enabled: true,
      ...(question.banter ? { banter: question.banter } : {}),
      countingDefinition: question.countingDefinition,
      incorrectDeduction: question.incorrectDeduction,
      options: question.options.map((option) => ({
        id: option.id,
        label: option.label,
      })),
      order: question.order,
      prompt: question.prompt,
    } satisfies QuestionDefinition;
  });

  return createRulesetSnapshot({
    id: baseRuleset.id,
    questions: [...questions, ...customQuestions],
    schemaVersion: baseRuleset.schemaVersion,
    version: baseRuleset.version,
  });
};
