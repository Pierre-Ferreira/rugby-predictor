import {
  assertValid,
  enabledQuestions,
  isBuiltInEnabled,
  validatePrediction,
  type CustomAnswerValue,
  type FirstTryAnswer,
  type FixturePrediction,
  type HalfTimeLeader,
  type HighestScoringHalf,
  type MatchResult,
  type RulesetSnapshot,
  type TeamPrediction,
} from '/imports/shared/scoring';
import { sanitizeFixtureId } from '/imports/shared/fixtures';
import type { SanitizedSubmitPredictionInput } from './types';

export const INITIAL_PREDICTION_REVISION = 1;

export class PredictionValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PredictionValidationError';
    this.code = code;
  }
}

const predictionError = (code: string, message: string): never => {
  throw new PredictionValidationError(code, message);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const assertAllowedKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string,
): void => {
  const allowed = new Set(allowedKeys);
  const unknownKeys = Object.keys(value).filter((key) => !allowed.has(key));

  if (unknownKeys.length > 0) {
    predictionError(
      'unknown-prediction-field',
      `${label} contains unsupported fields: ${unknownKeys.join(', ')}.`,
    );
  }
};

export const sanitizePredictionRevision = (value: unknown): number => {
  if (typeof value !== 'number') {
    predictionError(
      'invalid-prediction-revision',
      'Expected prediction revision is invalid.',
    );
  }

  const revision = value as number;

  if (
    !Number.isSafeInteger(revision) ||
    revision < INITIAL_PREDICTION_REVISION
  ) {
    predictionError(
      'invalid-prediction-revision',
      'Expected prediction revision is invalid.',
    );
  }

  return revision;
};

const normalizeTeamPrediction = (team: TeamPrediction): TeamPrediction => {
  const normalized: {
    conversions: number;
    dropGoals: number;
    penaltyKicks: number;
    redCards?: number;
    tries: number;
    yellowCards?: number;
  } = {
    conversions: team.conversions,
    dropGoals: team.dropGoals,
    penaltyKicks: team.penaltyKicks,
    tries: team.tries,
  };

  if (team.yellowCards !== undefined) {
    normalized.yellowCards = team.yellowCards;
  }

  if (team.redCards !== undefined) {
    normalized.redCards = team.redCards;
  }

  return normalized;
};

export const normalizePredictionForStorage = (
  prediction: unknown,
  ruleset: RulesetSnapshot,
): FixturePrediction => {
  assertValid(validatePrediction(prediction, ruleset));

  const source = prediction as FixturePrediction;
  const customQuestions = enabledQuestions(ruleset).filter(
    (question) =>
      question.type === 'custom-numeric' ||
      question.type === 'custom-categorical',
  );

  return {
    ...(isBuiltInEnabled(ruleset, 'match-result')
      ? { matchResult: source.matchResult as MatchResult }
      : {}),
    ...(isBuiltInEnabled(ruleset, 'first-try')
      ? { firstTry: source.firstTry as FirstTryAnswer }
      : {}),
    ...(isBuiltInEnabled(ruleset, 'highest-scoring-half')
      ? {
          highestScoringHalf: source.highestScoringHalf as HighestScoringHalf,
        }
      : {}),
    ...(isBuiltInEnabled(ruleset, 'half-time-leader')
      ? { halfTimeLeader: source.halfTimeLeader as HalfTimeLeader }
      : {}),
    ...(customQuestions.length > 0
      ? {
          customAnswers: Object.fromEntries(
            customQuestions.map((question) => [
              question.id,
              source.customAnswers?.[question.id] as CustomAnswerValue,
            ]),
          ),
        }
      : {}),
    team1: normalizeTeamPrediction(source.team1),
    team2: normalizeTeamPrediction(source.team2),
  };
};

export const sanitizeSubmitPredictionInput = (
  input: unknown,
  ruleset: RulesetSnapshot,
): SanitizedSubmitPredictionInput => {
  if (!isRecord(input)) {
    predictionError(
      'invalid-prediction-request',
      'Prediction submission input is required.',
    );
  }

  const record = input as Record<string, unknown>;

  assertAllowedKeys(
    record,
    ['expectedRevision', 'fixtureId', 'prediction'],
    'Prediction submission input',
  );

  if (!hasOwn(record, 'prediction')) {
    predictionError('missing-prediction', 'Prediction answers are required.');
  }

  return {
    ...(hasOwn(record, 'expectedRevision')
      ? {
          expectedRevision: sanitizePredictionRevision(record.expectedRevision),
        }
      : {}),
    fixtureId: sanitizeFixtureId(record.fixtureId),
    prediction: normalizePredictionForStorage(record.prediction, ruleset),
  };
};
