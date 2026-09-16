export const STARTING_POINTS = 10_000;
export const RULESET_SCHEMA_VERSION = 1;

export const builtInQuestionIds = [
  'match-result',
  'tries',
  'conversions',
  'penalty-kicks',
  'drop-goals',
  'team-score',
  'yellow-cards',
  'red-cards',
  'first-try',
  'highest-scoring-half',
  'half-time-leader',
] as const;

export const teamNumericBuiltInQuestionIds = [
  'tries',
  'conversions',
  'penalty-kicks',
  'drop-goals',
  'team-score',
  'yellow-cards',
  'red-cards',
] as const;

export const categoricalBuiltInQuestionIds = [
  'match-result',
  'first-try',
  'highest-scoring-half',
  'half-time-leader',
] as const;

export type TeamSide = 'team1' | 'team2';
export type MatchResult = TeamSide | 'draw';
export type FirstTryAnswer = TeamSide | 'no-tries';
export type HighestScoringHalf = 'first' | 'second' | 'equal';
export type HalfTimeLeader = MatchResult;
export type BuiltInQuestionId = (typeof builtInQuestionIds)[number];
export type TeamNumericBuiltInQuestionId =
  (typeof teamNumericBuiltInQuestionIds)[number];
export type CategoricalBuiltInQuestionId =
  (typeof categoricalBuiltInQuestionIds)[number];
export type QuestionId = string;
export type ObservationStatus = 'pending' | 'provisional' | 'confirmed';
export type MatchObservationStatus = 'provisional' | 'confirmed';
export type CalculationMode = 'if-ended-now' | 'final';
export type CalculationStatus = 'provisional' | 'final';
export type BreakdownStatus =
  'pending' | 'partially-pending' | 'provisional' | 'confirmed';
export type CustomAnswerValue = number | string;

export interface TeamScoringComponents {
  readonly tries: number;
  readonly conversions: number;
  readonly penaltyKicks: number;
  readonly dropGoals: number;
}

export interface TeamCardTotals {
  readonly yellowCards?: number;
  readonly redCards?: number;
}

export type TeamPrediction = TeamScoringComponents & TeamCardTotals;

export interface FixturePrediction {
  readonly team1: TeamPrediction;
  readonly team2: TeamPrediction;
  readonly matchResult?: MatchResult;
  readonly firstTry?: FirstTryAnswer;
  readonly highestScoringHalf?: HighestScoringHalf;
  readonly halfTimeLeader?: HalfTimeLeader;
  readonly customAnswers?: Readonly<Record<string, CustomAnswerValue>>;
}

export interface ObservedValue<T> {
  readonly status: ObservationStatus;
  readonly value?: T;
}

export interface ObservedTeamScoringComponents {
  readonly tries?: ObservedValue<number>;
  readonly conversions?: ObservedValue<number>;
  readonly penaltyKicks?: ObservedValue<number>;
  readonly dropGoals?: ObservedValue<number>;
}

export interface ObservedTeamCardTotals {
  readonly yellowCards?: ObservedValue<number>;
  readonly redCards?: ObservedValue<number>;
}

export type ObservedTeamTotals = ObservedTeamScoringComponents &
  ObservedTeamCardTotals;

export interface FixtureObservations {
  readonly matchStatus: MatchObservationStatus;
  readonly team1: ObservedTeamTotals;
  readonly team2: ObservedTeamTotals;
  readonly firstTry?: ObservedValue<FirstTryAnswer>;
  readonly highestScoringHalf?: ObservedValue<HighestScoringHalf>;
  readonly halfTimeLeader?: ObservedValue<HalfTimeLeader>;
  readonly customAnswers?: Readonly<
    Record<string, ObservedValue<CustomAnswerValue>>
  >;
}

export interface RulesetIdentity {
  readonly schemaVersion: typeof RULESET_SCHEMA_VERSION;
  readonly id: string;
  readonly version: string;
}

export interface QuestionBase {
  readonly id: QuestionId;
  readonly label: string;
  readonly enabled: boolean;
}

export interface BuiltInTeamNumericQuestion extends QuestionBase {
  readonly type: 'built-in-team-numeric';
  readonly id: TeamNumericBuiltInQuestionId;
  readonly rate: number;
}

export interface BuiltInCategoricalQuestion extends QuestionBase {
  readonly type: 'built-in-categorical';
  readonly id: CategoricalBuiltInQuestionId;
  readonly incorrectDeduction: number;
}

export interface CustomNumericQuestion extends QuestionBase {
  readonly type: 'custom-numeric';
  readonly banter?: string;
  readonly countingDefinition: string;
  readonly max: number;
  readonly min: number;
  readonly order: number;
  readonly prompt: string;
  readonly rate: number;
}

export interface CustomCategoricalOption {
  readonly id: string;
  readonly label: string;
}

export interface CustomCategoricalQuestion extends QuestionBase {
  readonly type: 'custom-categorical';
  readonly banter?: string;
  readonly countingDefinition: string;
  readonly incorrectDeduction: number;
  readonly order: number;
  readonly options: readonly CustomCategoricalOption[];
  readonly prompt: string;
}

export type QuestionDefinition =
  | BuiltInTeamNumericQuestion
  | BuiltInCategoricalQuestion
  | CustomNumericQuestion
  | CustomCategoricalQuestion;

export interface RulesetSnapshot extends RulesetIdentity {
  readonly questions: readonly QuestionDefinition[];
}

export interface ValidationIssue {
  readonly code: string;
  readonly path: readonly (string | number)[];
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

export interface ScoreFixtureInput {
  readonly ruleset: RulesetSnapshot;
  readonly prediction: FixturePrediction;
  readonly observations: FixtureObservations;
  readonly calculationMode: CalculationMode;
}

export interface RulesetResultReference extends RulesetIdentity {
  readonly questionCount: number;
}

export interface NumericBreakdownItem {
  readonly team?: TeamSide;
  readonly prediction: number;
  readonly observed: number | null;
  readonly difference: number | null;
  readonly rate: number;
  readonly deduction: number | null;
  readonly status: ObservationStatus;
}

export interface CategoricalBreakdownItem {
  readonly prediction: string;
  readonly observed: string | null;
  readonly incorrectDeduction: number;
  readonly deduction: number | null;
  readonly status: ObservationStatus;
}

export interface QuestionScoreBreakdown {
  readonly questionId: QuestionId;
  readonly label: string;
  readonly type: QuestionDefinition['type'];
  readonly status: BreakdownStatus;
  readonly deduction: number | null;
  readonly items: readonly (NumericBreakdownItem | CategoricalBreakdownItem)[];
}

export interface FixtureScoreResult {
  readonly startingPoints: typeof STARTING_POINTS;
  readonly totalDeductions: number;
  readonly score: number;
  readonly calculationStatus: CalculationStatus;
  readonly pendingQuestionIds: readonly QuestionId[];
  readonly ruleset: RulesetResultReference;
  readonly breakdown: readonly QuestionScoreBreakdown[];
}
