import type {
  CategoricalBuiltInQuestionId,
  QuestionId,
  RulesetSnapshot,
} from '../scoring';

export const PREDICTION_QUESTION_CONFIG_SCHEMA_VERSION = 1;

export const permanentCoreQuestionIds = [
  'match-result',
  'tries',
  'conversions',
  'penalty-kicks',
  'drop-goals',
  'team-score',
  'yellow-cards',
  'red-cards',
] as const;

export const optionalStandardQuestionIds = [
  'first-try',
  'highest-scoring-half',
  'half-time-leader',
] as const satisfies readonly CategoricalBuiltInQuestionId[];

export const customQuestionAnswerTypes = ['number', 'choice'] as const;

export type PermanentCoreQuestionId = (typeof permanentCoreQuestionIds)[number];
export type OptionalStandardQuestionId =
  (typeof optionalStandardQuestionIds)[number];
export type CustomQuestionAnswerType =
  (typeof customQuestionAnswerTypes)[number];

export interface OptionalStandardQuestionConfig {
  readonly id: OptionalStandardQuestionId;
  readonly enabled: boolean;
  readonly incorrectDeduction: number;
}

export interface CustomQuestionBaseConfig {
  readonly id: QuestionId;
  readonly prompt: string;
  readonly banter?: string;
  readonly answerType: CustomQuestionAnswerType;
  readonly countingDefinition: string;
  readonly order: number;
}

export interface CustomNumberQuestionConfig extends CustomQuestionBaseConfig {
  readonly answerType: 'number';
  readonly min: number;
  readonly max: number;
  readonly deductionPerUnit: number;
}

export interface CustomChoiceOptionConfig {
  readonly id: string;
  readonly label: string;
}

export interface CustomChoiceQuestionConfig extends CustomQuestionBaseConfig {
  readonly answerType: 'choice';
  readonly options: readonly CustomChoiceOptionConfig[];
  readonly incorrectDeduction: number;
}

export type CustomQuestionConfig =
  CustomNumberQuestionConfig | CustomChoiceQuestionConfig;

export interface FixturePredictionQuestionConfig {
  readonly schemaVersion: typeof PREDICTION_QUESTION_CONFIG_SCHEMA_VERSION;
  readonly optionalStandardQuestions: readonly OptionalStandardQuestionConfig[];
  readonly customQuestions: readonly CustomQuestionConfig[];
}

export interface FixtureQuestionConfigInput {
  readonly config: unknown;
  readonly expectedRevision: unknown;
  readonly fixtureId: unknown;
}

export interface FixtureQuestionConfigMutationResult {
  readonly fixtureId: string;
  readonly revision: number;
  readonly status: 'updated';
}

export interface RulesetQuestionConfigSource {
  readonly predictionQuestionConfig?: FixturePredictionQuestionConfig;
  readonly rulesetSnapshot?: RulesetSnapshot;
}
