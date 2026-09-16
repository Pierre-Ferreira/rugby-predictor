import { ScoringValidationError, validationIssue } from './errors';
import {
  type MatchResult,
  type ObservationStatus,
  type TeamNumericBuiltInQuestionId,
  type TeamScoringComponents,
  type TeamSide,
} from './types';

export const teamSides = [
  'team1',
  'team2',
] as const satisfies readonly TeamSide[];

export const scoringComponentFields = [
  'tries',
  'conversions',
  'penaltyKicks',
  'dropGoals',
] as const;

export type ScoringComponentField = (typeof scoringComponentFields)[number];

export const teamScoreComponentRugbyPoints = {
  conversions: 2,
  dropGoals: 3,
  penaltyKicks: 3,
  tries: 5,
} as const satisfies Readonly<Record<ScoringComponentField, number>>;

export const teamNumericFieldByQuestionId = {
  tries: 'tries',
  conversions: 'conversions',
  'penalty-kicks': 'penaltyKicks',
  'drop-goals': 'dropGoals',
  'yellow-cards': 'yellowCards',
  'red-cards': 'redCards',
} as const satisfies Partial<
  Record<
    TeamNumericBuiltInQuestionId,
    ScoringComponentField | 'yellowCards' | 'redCards'
  >
>;

export const deriveTeamScore = (components: TeamScoringComponents): number => {
  const issues = validateTeamScoringComponents(components);

  if (issues.length > 0) {
    throw new ScoringValidationError(issues);
  }

  const score =
    components.tries * teamScoreComponentRugbyPoints.tries +
    components.conversions * teamScoreComponentRugbyPoints.conversions +
    components.penaltyKicks * teamScoreComponentRugbyPoints.penaltyKicks +
    components.dropGoals * teamScoreComponentRugbyPoints.dropGoals;

  if (!Number.isSafeInteger(score)) {
    throw new ScoringValidationError([
      validationIssue(
        'unsafe_arithmetic',
        ['components'],
        'Derived team score is outside the safe integer range.',
      ),
    ]);
  }

  return score;
};

export const deriveMatchResult = (
  team1Score: number,
  team2Score: number,
): MatchResult => {
  const issues = [
    ...numericIssue(team1Score, ['team1Score']),
    ...numericIssue(team2Score, ['team2Score']),
  ];

  if (issues.length > 0) {
    throw new ScoringValidationError(issues);
  }

  if (team1Score > team2Score) {
    return 'team1';
  }

  if (team2Score > team1Score) {
    return 'team2';
  }

  return 'draw';
};

export const combineObservationStatuses = (
  statuses: readonly ObservationStatus[],
): ObservationStatus => {
  if (!Array.isArray(statuses) || statuses.length === 0) {
    throw new ScoringValidationError([
      validationIssue(
        'invalid_observation_status',
        ['statuses'],
        'Observation statuses must be a non-empty array.',
      ),
    ]);
  }

  const invalidIndex = statuses.findIndex(
    (status) =>
      status !== 'pending' &&
      status !== 'provisional' &&
      status !== 'confirmed',
  );

  if (invalidIndex !== -1) {
    throw new ScoringValidationError([
      validationIssue(
        'invalid_observation_status',
        ['statuses', invalidIndex],
        'Observation status must be pending, provisional, or confirmed.',
      ),
    ]);
  }

  if (statuses.includes('pending')) {
    return 'pending';
  }

  if (statuses.includes('provisional')) {
    return 'provisional';
  }

  return 'confirmed';
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSafeNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  Number.isSafeInteger(value) &&
  value >= 0;

const numericIssue = (value: unknown, path: readonly (string | number)[]) =>
  isSafeNonNegativeInteger(value)
    ? []
    : [
        validationIssue(
          'invalid_numeric_answer',
          path,
          'Numeric values must be finite, non-negative safe integers.',
        ),
      ];

const validateTeamScoringComponents = (components: TeamScoringComponents) => {
  if (!isRecord(components)) {
    return [
      validationIssue(
        'invalid_components',
        ['components'],
        'Team scoring components must be an object.',
      ),
    ];
  }

  const issues = [
    ...numericIssue(components.tries, ['components', 'tries']),
    ...numericIssue(components.conversions, ['components', 'conversions']),
    ...numericIssue(components.penaltyKicks, ['components', 'penaltyKicks']),
    ...numericIssue(components.dropGoals, ['components', 'dropGoals']),
  ];

  if (
    isSafeNonNegativeInteger(components.tries) &&
    isSafeNonNegativeInteger(components.conversions) &&
    components.conversions > components.tries
  ) {
    issues.push(
      validationIssue(
        'conversion_count_exceeds_tries',
        ['components', 'conversions'],
        'Conversions cannot exceed tries.',
      ),
    );
  }

  return issues;
};
