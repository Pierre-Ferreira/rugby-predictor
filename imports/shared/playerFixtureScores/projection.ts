import {
  STARTING_POINTS,
  createRulesetSnapshot,
  scoreFixture,
  type BreakdownStatus,
  type QuestionScoreBreakdown,
  type RulesetIdentity,
  type RulesetResultReference,
  type RulesetSnapshot,
} from '/imports/shared/scoring';
import { PlayerFixtureScoreError } from './errors';
import type {
  CalculatePlayerFixtureScoreProjectionInput,
  PlayerFixtureScoreComponent,
  PlayerFixtureScoreComponentStatus,
  PlayerFixtureScoreProjection,
  PlayerFixtureScoreResultInput,
} from './types';

const scoreError = (code: string, message: string): never => {
  throw new PlayerFixtureScoreError(code, message);
};

const rulesetReference = (
  ruleset: RulesetSnapshot,
): RulesetResultReference => ({
  id: ruleset.id,
  questionCount: ruleset.questions.length,
  schemaVersion: ruleset.schemaVersion,
  version: ruleset.version,
});

const sameRulesetIdentity = (
  left: RulesetIdentity,
  right: RulesetIdentity,
): boolean =>
  left.schemaVersion === right.schemaVersion &&
  left.id === right.id &&
  left.version === right.version;

const assertRulesetIdentity = (
  label: string,
  actual: RulesetIdentity,
  expected: RulesetIdentity,
): void => {
  if (!sameRulesetIdentity(actual, expected)) {
    scoreError(
      'fixture-score-ruleset-mismatch',
      `${label} ruleset identity does not match the fixture ruleset snapshot.`,
    );
  }
};

const assertCanonicalRelationships = (
  input: CalculatePlayerFixtureScoreProjectionInput,
  ruleset: RulesetSnapshot,
): void => {
  if (input.prediction.fixtureId !== input.fixture._id) {
    scoreError(
      'fixture-score-input-mismatch',
      'Prediction does not belong to the requested fixture.',
    );
  }

  assertRulesetIdentity('Prediction', input.prediction.ruleset, ruleset);

  if (!input.result) {
    return;
  }

  if (input.result.fixtureId !== input.fixture._id) {
    scoreError(
      'fixture-score-input-mismatch',
      'Match result does not belong to the requested fixture.',
    );
  }

  assertRulesetIdentity('Result', input.result.ruleset, ruleset);
};

const componentStatus = (
  status: BreakdownStatus,
): PlayerFixtureScoreComponentStatus => {
  if (status === 'void') {
    return 'void';
  }

  if (status === 'pending' || status === 'partially-pending') {
    return 'pending';
  }

  return 'resolved';
};

const componentFromBreakdown = (
  breakdown: QuestionScoreBreakdown,
): PlayerFixtureScoreComponent => ({
  deduction: breakdown.deduction,
  items: breakdown.items,
  key: breakdown.questionId,
  label: breakdown.label,
  questionId: breakdown.questionId,
  status: componentStatus(breakdown.status),
  type: breakdown.type,
});

const nonScoreProjection = ({
  fixtureId,
  predictionRevision,
  result,
  ruleset,
  status,
}: {
  readonly fixtureId: string;
  readonly predictionRevision: number;
  readonly result?: PlayerFixtureScoreResultInput | null;
  readonly ruleset: RulesetSnapshot;
  readonly status: 'awaiting_result' | 'cancelled';
}): PlayerFixtureScoreProjection => ({
  components: [],
  currentScore: null,
  finalScore: null,
  fixtureId,
  pendingCount: 0,
  predictionRevision,
  resolvedDeduction: 0,
  resultRevision: result?.revision ?? null,
  ruleset: rulesetReference(ruleset),
  startingPoints: STARTING_POINTS,
  status,
});

const requireFixtureRuleset = (
  ruleset: RulesetSnapshot | undefined,
): RulesetSnapshot => {
  if (ruleset === undefined) {
    throw new PlayerFixtureScoreError(
      'fixture-ruleset-unavailable',
      "This fixture's published prediction rules are unavailable.",
    );
  }

  return ruleset;
};

export const calculatePlayerFixtureScoreProjection = (
  input: CalculatePlayerFixtureScoreProjectionInput,
): PlayerFixtureScoreProjection => {
  const ruleset = createRulesetSnapshot(
    requireFixtureRuleset(input.fixture.rulesetSnapshot),
  );

  assertCanonicalRelationships(input, ruleset);

  if (input.fixture.isCancelled) {
    return nonScoreProjection({
      fixtureId: input.fixture._id,
      predictionRevision: input.prediction.revision,
      result: input.result,
      ruleset,
      status: 'cancelled',
    });
  }

  if (!input.result) {
    return nonScoreProjection({
      fixtureId: input.fixture._id,
      predictionRevision: input.prediction.revision,
      ruleset,
      status: 'awaiting_result',
    });
  }

  const calculationMode =
    input.result.observations.matchStatus === 'confirmed'
      ? 'final'
      : 'if-ended-now';
  const score = scoreFixture({
    calculationMode,
    observations: input.result.observations,
    prediction: input.prediction.prediction,
    ruleset,
  });
  const isFinal = score.calculationStatus === 'final';

  return {
    components: score.breakdown.map(componentFromBreakdown),
    currentScore: score.score,
    finalScore: isFinal ? score.score : null,
    fixtureId: input.fixture._id,
    pendingCount: score.pendingQuestionIds.length,
    predictionRevision: input.prediction.revision,
    resolvedDeduction: score.totalDeductions,
    resultRevision: input.result.revision,
    ruleset: score.ruleset,
    startingPoints: score.startingPoints,
    status: isFinal ? 'final' : 'provisional',
  };
};
