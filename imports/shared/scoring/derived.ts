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
  const score =
    components.tries * 5 +
    components.conversions * 2 +
    components.penaltyKicks * 3 +
    components.dropGoals * 3;

  if (!Number.isSafeInteger(score)) {
    throw new Error('Derived team score is outside the safe integer range.');
  }

  return score;
};

export const deriveMatchResult = (
  team1Score: number,
  team2Score: number,
): MatchResult => {
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
  if (statuses.includes('pending')) {
    return 'pending';
  }

  if (statuses.includes('provisional')) {
    return 'provisional';
  }

  return 'confirmed';
};
