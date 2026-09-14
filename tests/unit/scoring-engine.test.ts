import { describe, expect, it } from 'vitest';
import {
  createRulesetSnapshot,
  defaultRuleset,
  scoreFixture,
  ScoringValidationError,
  validatePrediction,
  validateRuleset,
  type FixtureObservations,
  type FixturePrediction,
  type NumericBreakdownItem,
  type ObservedValue,
  type QuestionDefinition,
  type QuestionScoreBreakdown,
  type RulesetSnapshot,
} from '../../imports/shared/scoring';

function observed<T>(
  value: T,
  status: 'provisional' | 'confirmed' = 'confirmed',
): ObservedValue<T> {
  return { status, value };
}

function pending<T>(): ObservedValue<T> {
  return { status: 'pending' };
}

const basePrediction: FixturePrediction = {
  team1: {
    tries: 3,
    conversions: 3,
    penaltyKicks: 1,
    dropGoals: 0,
    yellowCards: 1,
    redCards: 0,
  },
  team2: {
    tries: 2,
    conversions: 1,
    penaltyKicks: 1,
    dropGoals: 0,
    yellowCards: 0,
    redCards: 1,
  },
  matchResult: 'team1',
  firstTry: 'team1',
  highestScoringHalf: 'first',
  halfTimeLeader: 'team1',
};

const observationsFromPrediction = (
  prediction: FixturePrediction,
  status: 'provisional' | 'confirmed' = 'confirmed',
): FixtureObservations => ({
  matchStatus: status,
  team1: {
    tries: observed(prediction.team1.tries, status),
    conversions: observed(prediction.team1.conversions, status),
    penaltyKicks: observed(prediction.team1.penaltyKicks, status),
    dropGoals: observed(prediction.team1.dropGoals, status),
    yellowCards: observed(prediction.team1.yellowCards ?? 0, status),
    redCards: observed(prediction.team1.redCards ?? 0, status),
  },
  team2: {
    tries: observed(prediction.team2.tries, status),
    conversions: observed(prediction.team2.conversions, status),
    penaltyKicks: observed(prediction.team2.penaltyKicks, status),
    dropGoals: observed(prediction.team2.dropGoals, status),
    yellowCards: observed(prediction.team2.yellowCards ?? 0, status),
    redCards: observed(prediction.team2.redCards ?? 0, status),
  },
  firstTry: observed(prediction.firstTry ?? 'team1', status),
  highestScoringHalf: observed(
    prediction.highestScoringHalf ?? 'first',
    status,
  ),
  halfTimeLeader: observed(prediction.halfTimeLeader ?? 'team1', status),
});

const score = (
  prediction: FixturePrediction,
  observations: FixtureObservations,
  ruleset: RulesetSnapshot = defaultRuleset,
  calculationMode: 'if-ended-now' | 'final' = 'if-ended-now',
) =>
  scoreFixture({
    ruleset,
    prediction,
    observations,
    calculationMode,
  });

const updateDefaultRuleset = (
  version: string,
  update: (question: QuestionDefinition) => QuestionDefinition,
): RulesetSnapshot =>
  createRulesetSnapshot({
    ...defaultRuleset,
    version,
    questions: defaultRuleset.questions.map(update),
  });

const rulesetWithOnlyEnabled = (
  enabledIds: readonly string[],
  version: string,
): RulesetSnapshot =>
  updateDefaultRuleset(version, (question) => ({
    ...question,
    enabled: enabledIds.includes(question.id),
  }));

const question = (
  breakdown: readonly QuestionScoreBreakdown[],
  id: string,
): QuestionScoreBreakdown => {
  const match = breakdown.find((item) => item.questionId === id);

  if (!match) {
    throw new Error(`Missing breakdown question ${id}`);
  }

  return match;
};

const numericTeamItem = (
  breakdown: QuestionScoreBreakdown,
  team: 'team1' | 'team2',
): NumericBreakdownItem => {
  const item = breakdown.items.find(
    (candidate): candidate is NumericBreakdownItem =>
      'team' in candidate && candidate.team === team,
  );

  if (!item) {
    throw new Error(`Missing ${team} item`);
  }

  return item;
};

const expectScoringError = (
  action: () => unknown,
  expectedCodes: readonly string[],
): void => {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ScoringValidationError);
    const codes = (error as ScoringValidationError).issues.map(
      (issue) => issue.code,
    );

    expectedCodes.forEach((code) => expect(codes).toContain(code));
    return;
  }

  throw new Error('Expected scoring validation error');
};

describe('Rugby Rooster scoring engine', () => {
  it('scores perfect confirmed predictions at 10,000 points', () => {
    const result = score(
      basePrediction,
      observationsFromPrediction(basePrediction),
      defaultRuleset,
      'final',
    );

    expect(result.startingPoints).toBe(10_000);
    expect(result.totalDeductions).toBe(0);
    expect(result.score).toBe(10_000);
    expect(result.calculationStatus).toBe('final');
    expect(result.pendingQuestionIds).toEqual([]);
    expect(result.ruleset).toMatchObject({
      id: 'rugby-rooster-default',
      version: 'ccpp-003-v1',
      schemaVersion: 1,
    });
  });

  it('applies every default numeric rate per team for over and under predictions', () => {
    const prediction: FixturePrediction = {
      team1: {
        tries: 3,
        conversions: 2,
        penaltyKicks: 1,
        dropGoals: 0,
        yellowCards: 1,
        redCards: 0,
      },
      team2: {
        tries: 2,
        conversions: 1,
        penaltyKicks: 0,
        dropGoals: 1,
        yellowCards: 0,
        redCards: 1,
      },
      matchResult: 'team1',
      firstTry: 'team1',
      highestScoringHalf: 'first',
      halfTimeLeader: 'team1',
    };
    const observations: FixtureObservations = {
      matchStatus: 'confirmed',
      team1: {
        tries: observed(4),
        conversions: observed(3),
        penaltyKicks: observed(2),
        dropGoals: observed(1),
        yellowCards: observed(2),
        redCards: observed(1),
      },
      team2: {
        tries: observed(1),
        conversions: observed(0),
        penaltyKicks: observed(2),
        dropGoals: observed(0),
        yellowCards: observed(1),
        redCards: observed(0),
      },
      firstTry: observed('team1'),
      highestScoringHalf: observed('first'),
      halfTimeLeader: observed('team1'),
    };

    const result = score(prediction, observations, defaultRuleset, 'final');

    expect(question(result.breakdown, 'tries').deduction).toBe(100);
    expect(question(result.breakdown, 'conversions').deduction).toBe(100);
    expect(question(result.breakdown, 'penalty-kicks').deduction).toBe(300);
    expect(question(result.breakdown, 'drop-goals').deduction).toBe(300);
    expect(question(result.breakdown, 'team-score').deduction).toBe(340);
    expect(question(result.breakdown, 'yellow-cards').deduction).toBe(400);
    expect(question(result.breakdown, 'red-cards').deduction).toBe(400);
    expect(
      numericTeamItem(question(result.breakdown, 'team-score'), 'team1'),
    ).toMatchObject({
      prediction: 22,
      observed: 35,
      difference: 13,
      deduction: 260,
    });
    expect(
      numericTeamItem(question(result.breakdown, 'team-score'), 'team2'),
    ).toMatchObject({
      prediction: 15,
      observed: 11,
      difference: 4,
      deduction: 80,
    });
    expect(result.totalDeductions).toBe(1_940);
    expect(result.score).toBe(8_060);
  });

  it('deducts for wrong results, allows correct draws, and deducts for incorrect draws', () => {
    const matchOnlyRules = rulesetWithOnlyEnabled(
      ['match-result'],
      'match-only',
    );
    const predictedTeam1: FixturePrediction = {
      team1: { tries: 1, conversions: 1, penaltyKicks: 0, dropGoals: 0 },
      team2: { tries: 0, conversions: 0, penaltyKicks: 0, dropGoals: 0 },
      matchResult: 'team1',
    };
    const observedTeam2: FixtureObservations = {
      matchStatus: 'confirmed',
      team1: {
        tries: observed(0),
        conversions: observed(0),
        penaltyKicks: observed(0),
        dropGoals: observed(0),
      },
      team2: {
        tries: observed(1),
        conversions: observed(1),
        penaltyKicks: observed(0),
        dropGoals: observed(0),
      },
    };
    const drawPrediction: FixturePrediction = {
      team1: { tries: 0, conversions: 0, penaltyKicks: 0, dropGoals: 0 },
      team2: { tries: 0, conversions: 0, penaltyKicks: 0, dropGoals: 0 },
      matchResult: 'draw',
    };
    const observedDraw: FixtureObservations = {
      matchStatus: 'confirmed',
      team1: {
        tries: observed(0),
        conversions: observed(0),
        penaltyKicks: observed(0),
        dropGoals: observed(0),
      },
      team2: {
        tries: observed(0),
        conversions: observed(0),
        penaltyKicks: observed(0),
        dropGoals: observed(0),
      },
    };
    const observedTeam1Penalty: FixtureObservations = {
      matchStatus: 'confirmed',
      team1: {
        tries: observed(0),
        conversions: observed(0),
        penaltyKicks: observed(1),
        dropGoals: observed(0),
      },
      team2: {
        tries: observed(0),
        conversions: observed(0),
        penaltyKicks: observed(0),
        dropGoals: observed(0),
      },
    };

    const wrongWinner = score(
      predictedTeam1,
      observedTeam2,
      matchOnlyRules,
      'final',
    );
    const correctDraw = score(
      drawPrediction,
      observedDraw,
      matchOnlyRules,
      'final',
    );
    const incorrectDraw = score(
      drawPrediction,
      observedTeam1Penalty,
      matchOnlyRules,
      'final',
    );

    expect(wrongWinner.totalDeductions).toBe(5_000);
    expect(wrongWinner.score).toBe(5_000);
    expect(correctDraw.totalDeductions).toBe(0);
    expect(correctDraw.score).toBe(10_000);
    expect(incorrectDraw.totalDeductions).toBe(5_000);
    expect(incorrectDraw.score).toBe(5_000);
  });

  it('counts normalized penalty tries as one try and one conversion without double counting', () => {
    const prediction: FixturePrediction = {
      team1: {
        tries: 1,
        conversions: 1,
        penaltyKicks: 0,
        dropGoals: 0,
        yellowCards: 0,
        redCards: 0,
      },
      team2: {
        tries: 0,
        conversions: 0,
        penaltyKicks: 0,
        dropGoals: 0,
        yellowCards: 0,
        redCards: 0,
      },
      matchResult: 'team1',
      firstTry: 'team1',
      highestScoringHalf: 'first',
      halfTimeLeader: 'team1',
    };

    const result = score(
      prediction,
      observationsFromPrediction(prediction),
      defaultRuleset,
      'final',
    );

    expect(
      numericTeamItem(question(result.breakdown, 'team-score'), 'team1'),
    ).toMatchObject({
      prediction: 7,
      observed: 7,
      deduction: 0,
    });
    expect(question(result.breakdown, 'tries').deduction).toBe(0);
    expect(question(result.breakdown, 'conversions').deduction).toBe(0);
    expect(result.score).toBe(10_000);
  });

  it('rejects conversions that exceed tries', () => {
    const invalidPrediction: FixturePrediction = {
      ...basePrediction,
      team1: { ...basePrediction.team1, tries: 1, conversions: 2 },
    };

    const validation = validatePrediction(invalidPrediction, defaultRuleset);

    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain(
      'conversion_count_exceeds_tries',
    );
  });

  it('rejects selected winners that contradict derived predicted scores', () => {
    const invalidPrediction: FixturePrediction = {
      ...basePrediction,
      team1: {
        ...basePrediction.team1,
        tries: 0,
        conversions: 0,
        penaltyKicks: 0,
      },
      team2: {
        ...basePrediction.team2,
        tries: 1,
        conversions: 1,
        penaltyKicks: 0,
      },
      matchResult: 'team1',
    };

    const validation = validatePrediction(invalidPrediction, defaultRuleset);

    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain(
      'match_result_contradicts_scores',
    );
  });

  it('rejects first-try answers that contradict predicted tries', () => {
    const noTryContradiction: FixturePrediction = {
      ...basePrediction,
      firstTry: 'no-tries',
    };
    const teamContradiction: FixturePrediction = {
      ...basePrediction,
      team2: { ...basePrediction.team2, tries: 0, conversions: 0 },
      firstTry: 'team2',
    };

    expect(
      validatePrediction(noTryContradiction, defaultRuleset).issues.map(
        (issue) => issue.code,
      ),
    ).toContain('first_try_contradicts_tries');
    expect(
      validatePrediction(teamContradiction, defaultRuleset).issues.map(
        (issue) => issue.code,
      ),
    ).toContain('first_try_contradicts_tries');
  });

  it('scores no tries, half-time draw, and equal-scoring halves as valid categorical answers', () => {
    const prediction: FixturePrediction = {
      team1: {
        tries: 0,
        conversions: 0,
        penaltyKicks: 0,
        dropGoals: 0,
        yellowCards: 0,
        redCards: 0,
      },
      team2: {
        tries: 0,
        conversions: 0,
        penaltyKicks: 0,
        dropGoals: 0,
        yellowCards: 0,
        redCards: 0,
      },
      matchResult: 'draw',
      firstTry: 'no-tries',
      highestScoringHalf: 'equal',
      halfTimeLeader: 'draw',
    };

    const result = score(
      prediction,
      observationsFromPrediction(prediction),
      defaultRuleset,
      'final',
    );

    expect(result.score).toBe(10_000);
    expect(question(result.breakdown, 'first-try').deduction).toBe(0);
    expect(question(result.breakdown, 'highest-scoring-half').deduction).toBe(
      0,
    );
    expect(question(result.breakdown, 'half-time-leader').deduction).toBe(0);
  });

  it('floors scores at zero while keeping the full deduction breakdown', () => {
    const prediction: FixturePrediction = {
      team1: {
        tries: 0,
        conversions: 0,
        penaltyKicks: 0,
        dropGoals: 0,
        yellowCards: 0,
        redCards: 0,
      },
      team2: {
        tries: 0,
        conversions: 0,
        penaltyKicks: 0,
        dropGoals: 0,
        yellowCards: 0,
        redCards: 0,
      },
      matchResult: 'draw',
      firstTry: 'no-tries',
      highestScoringHalf: 'equal',
      halfTimeLeader: 'draw',
    };
    const observations: FixtureObservations = {
      matchStatus: 'confirmed',
      team1: {
        tries: observed(100),
        conversions: observed(100),
        penaltyKicks: observed(100),
        dropGoals: observed(100),
        yellowCards: observed(20),
        redCards: observed(20),
      },
      team2: {
        tries: observed(100),
        conversions: observed(100),
        penaltyKicks: observed(100),
        dropGoals: observed(100),
        yellowCards: observed(20),
        redCards: observed(20),
      },
      firstTry: observed('team1'),
      highestScoringHalf: observed('first'),
      halfTimeLeader: observed('team1'),
    };

    const result = score(prediction, observations, defaultRuleset, 'final');

    expect(result.totalDeductions).toBeGreaterThan(10_000);
    expect(result.score).toBe(0);
    expect(question(result.breakdown, 'team-score').deduction).toBe(52_000);
    expect(question(result.breakdown, 'tries').deduction).toBe(10_000);
  });

  it('can disable an optional built-in deduction while still deriving team score from the component input', () => {
    const ruleset = updateDefaultRuleset('drop-goals-disabled', (question) =>
      question.id === 'drop-goals' ? { ...question, enabled: false } : question,
    );
    const observations: FixtureObservations = {
      ...observationsFromPrediction(basePrediction),
      team1: {
        ...observationsFromPrediction(basePrediction).team1,
        dropGoals: observed(1),
      },
    };

    const result = score(basePrediction, observations, ruleset, 'final');

    expect(result.breakdown.map((item) => item.questionId)).not.toContain(
      'drop-goals',
    );
    expect(question(result.breakdown, 'team-score').deduction).toBe(60);
    expect(result.totalDeductions).toBe(60);
  });

  it('scores custom numeric and categorical questions with stable option ids', () => {
    const customRuleset = createRulesetSnapshot({
      ...defaultRuleset,
      version: 'custom-questions',
      questions: [
        ...defaultRuleset.questions,
        {
          id: 'winning-margin',
          label: 'Winning margin',
          type: 'custom-numeric',
          enabled: true,
          rate: 30,
        },
        {
          id: 'weather',
          label: 'Weather',
          type: 'custom-categorical',
          enabled: true,
          incorrectDeduction: 75,
          options: [
            { id: 'dry', label: 'Dry' },
            { id: 'wet', label: 'Wet' },
          ],
        },
      ],
    });
    const prediction: FixturePrediction = {
      ...basePrediction,
      customAnswers: { 'winning-margin': 5, weather: 'wet' },
    };
    const observations: FixtureObservations = {
      ...observationsFromPrediction(basePrediction),
      customAnswers: {
        'winning-margin': observed(8),
        weather: observed('dry'),
      },
    };

    const result = score(prediction, observations, customRuleset, 'final');

    expect(question(result.breakdown, 'winning-margin').deduction).toBe(90);
    expect(question(result.breakdown, 'weather').deduction).toBe(75);
    expect(result.totalDeductions).toBe(165);
    expect(result.score).toBe(9_835);
  });

  it('rejects invalid rulesets and missing or unexpected answers', () => {
    const invalidRuleset = {
      ...defaultRuleset,
      questions: [
        defaultRuleset.questions[0],
        defaultRuleset.questions[0],
        { ...defaultRuleset.questions[1], rate: 0 },
        {
          id: 'mystery',
          label: 'Mystery',
          type: 'ai-formula',
          enabled: true,
        },
      ],
    };

    const rulesetValidation = validateRuleset(invalidRuleset);
    const missingFirstTryPrediction: FixturePrediction = {
      team1: basePrediction.team1,
      team2: basePrediction.team2,
      matchResult: basePrediction.matchResult,
      highestScoringHalf: basePrediction.highestScoringHalf,
      halfTimeLeader: basePrediction.halfTimeLeader,
    };
    const missingAnswerValidation = validatePrediction(
      missingFirstTryPrediction,
      defaultRuleset,
    );
    const disabledFirstTryRuleset = updateDefaultRuleset(
      'first-try-disabled',
      (question) =>
        question.id === 'first-try'
          ? { ...question, enabled: false }
          : question,
    );
    const unexpectedAnswerValidation = validatePrediction(
      basePrediction,
      disabledFirstTryRuleset,
    );

    expect(rulesetValidation.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'duplicate_question_id',
        'invalid_rate',
        'unknown_question_type',
      ]),
    );
    expect(missingAnswerValidation.issues.map((issue) => issue.code)).toContain(
      'missing_required_answer',
    );
    expect(
      unexpectedAnswerValidation.issues.map((issue) => issue.code),
    ).toContain('unexpected_answer');
  });

  it('rejects negative, fractional, non-finite, unsafe, and unsafe-arithmetic numeric values', () => {
    const invalidValues = [-1, 1.5, Number.POSITIVE_INFINITY, Number.NaN];

    for (const invalidValue of invalidValues) {
      const validation = validatePrediction(
        {
          ...basePrediction,
          team1: { ...basePrediction.team1, tries: invalidValue },
        },
        defaultRuleset,
      );

      expect(validation.issues.map((issue) => issue.code)).toContain(
        'invalid_numeric_answer',
      );
    }

    expect(
      validatePrediction(
        {
          ...basePrediction,
          team1: {
            ...basePrediction.team1,
            tries: Number.MAX_SAFE_INTEGER + 1,
          },
        },
        defaultRuleset,
      ).issues.map((issue) => issue.code),
    ).toContain('invalid_numeric_answer');

    expect(
      validatePrediction(
        {
          ...basePrediction,
          team1: {
            ...basePrediction.team1,
            tries: Number.MAX_SAFE_INTEGER,
          },
        },
        defaultRuleset,
      ).issues.map((issue) => issue.code),
    ).toContain('unsafe_arithmetic');
  });

  it('distinguishes explicit zero observations from pending observations', () => {
    const triesOnlyRuleset = rulesetWithOnlyEnabled(['tries'], 'tries-only');
    const prediction: FixturePrediction = {
      team1: { tries: 1, conversions: 0, penaltyKicks: 0, dropGoals: 0 },
      team2: { tries: 1, conversions: 0, penaltyKicks: 0, dropGoals: 0 },
    };
    const observations: FixtureObservations = {
      matchStatus: 'provisional',
      team1: { tries: observed(0, 'provisional') },
      team2: { tries: pending() },
    };

    const result = score(prediction, observations, triesOnlyRuleset);
    const tries = question(result.breakdown, 'tries');

    expect(tries.status).toBe('partially-pending');
    expect(numericTeamItem(tries, 'team1')).toMatchObject({
      observed: 0,
      difference: 1,
      deduction: 50,
      status: 'provisional',
    });
    expect(numericTeamItem(tries, 'team2')).toMatchObject({
      observed: null,
      difference: null,
      deduction: null,
      status: 'pending',
    });
    expect(result.pendingQuestionIds).toEqual(['tries']);
    expect(result.totalDeductions).toBe(50);
  });

  it('labels provisional and confirmed breakdowns independently', () => {
    const observations: FixtureObservations = {
      ...observationsFromPrediction(basePrediction),
      matchStatus: 'provisional',
      team1: {
        ...observationsFromPrediction(basePrediction).team1,
        tries: observed(basePrediction.team1.tries, 'provisional'),
      },
    };

    const result = score(basePrediction, observations);

    expect(result.calculationStatus).toBe('provisional');
    expect(question(result.breakdown, 'tries').status).toBe('provisional');
    expect(question(result.breakdown, 'team-score').status).toBe('provisional');
    expect(question(result.breakdown, 'first-try').status).toBe('confirmed');
  });

  it('rejects official final scoring when match status or enabled observations are not confirmed', () => {
    const observations: FixtureObservations = {
      ...observationsFromPrediction(basePrediction),
      matchStatus: 'provisional',
      firstTry: pending(),
    };

    expectScoringError(
      () => score(basePrediction, observations, defaultRuleset, 'final'),
      ['final_match_status_not_confirmed', 'final_observation_not_confirmed'],
    );
  });

  it('keeps ruleset snapshots isolated, produces deterministic output, and does not mutate inputs', () => {
    const observations: FixtureObservations = {
      ...observationsFromPrediction(basePrediction),
      team1: {
        ...observationsFromPrediction(basePrediction).team1,
        tries: observed(4),
      },
    };

    const originalRuleset = createRulesetSnapshot(defaultRuleset);
    const changedRuleset = updateDefaultRuleset('tries-rate-500', (question) =>
      question.id === 'tries' ? { ...question, rate: 500 } : question,
    );
    const originalInput = {
      ruleset: originalRuleset,
      prediction: basePrediction,
      observations,
      calculationMode: 'if-ended-now' as const,
    };
    const before = JSON.stringify(originalInput);
    const first = scoreFixture(originalInput);
    const second = scoreFixture(originalInput);
    const changed = score(basePrediction, observations, changedRuleset);

    expect(first).toEqual(second);
    expect(JSON.stringify(originalInput)).toBe(before);
    expect(question(first.breakdown, 'tries').deduction).toBe(50);
    expect(question(changed.breakdown, 'tries').deduction).toBe(500);
    expect(first.ruleset.version).toBe('ccpp-003-v1');
    expect(changed.ruleset.version).toBe('tries-rate-500');
  });

  it('verifies worked example A from the scoring rules documentation', () => {
    const prediction: FixturePrediction = {
      team1: {
        tries: 2,
        conversions: 1,
        penaltyKicks: 2,
        dropGoals: 0,
        yellowCards: 1,
        redCards: 0,
      },
      team2: {
        tries: 1,
        conversions: 1,
        penaltyKicks: 1,
        dropGoals: 0,
        yellowCards: 0,
        redCards: 0,
      },
      matchResult: 'team1',
      firstTry: 'team2',
      highestScoringHalf: 'second',
      halfTimeLeader: 'draw',
    };
    const observations: FixtureObservations = {
      matchStatus: 'confirmed',
      team1: {
        tries: observed(3),
        conversions: observed(2),
        penaltyKicks: observed(1),
        dropGoals: observed(0),
        yellowCards: observed(1),
        redCards: observed(0),
      },
      team2: {
        tries: observed(1),
        conversions: observed(1),
        penaltyKicks: observed(2),
        dropGoals: observed(0),
        yellowCards: observed(1),
        redCards: observed(0),
      },
      firstTry: observed('team1'),
      highestScoringHalf: observed('second'),
      halfTimeLeader: observed('draw'),
    };

    const result = score(prediction, observations, defaultRuleset, 'final');

    expect(question(result.breakdown, 'tries').deduction).toBe(50);
    expect(question(result.breakdown, 'conversions').deduction).toBe(50);
    expect(question(result.breakdown, 'penalty-kicks').deduction).toBe(200);
    expect(question(result.breakdown, 'team-score').deduction).toBe(140);
    expect(question(result.breakdown, 'yellow-cards').deduction).toBe(200);
    expect(question(result.breakdown, 'first-try').deduction).toBe(250);
    expect(result.totalDeductions).toBe(890);
    expect(result.score).toBe(9_110);
  });

  it('verifies worked example B from the scoring rules documentation', () => {
    const prediction: FixturePrediction = {
      team1: {
        tries: 1,
        conversions: 1,
        penaltyKicks: 1,
        dropGoals: 0,
        yellowCards: 0,
        redCards: 0,
      },
      team2: {
        tries: 0,
        conversions: 0,
        penaltyKicks: 0,
        dropGoals: 0,
        yellowCards: 0,
        redCards: 0,
      },
      matchResult: 'team1',
      firstTry: 'team1',
      highestScoringHalf: 'first',
      halfTimeLeader: 'team1',
    };
    const observations: FixtureObservations = {
      matchStatus: 'confirmed',
      team1: {
        tries: observed(1),
        conversions: observed(1),
        penaltyKicks: observed(0),
        dropGoals: observed(0),
        yellowCards: observed(0),
        redCards: observed(0),
      },
      team2: {
        tries: observed(1),
        conversions: observed(0),
        penaltyKicks: observed(1),
        dropGoals: observed(0),
        yellowCards: observed(0),
        redCards: observed(0),
      },
      firstTry: observed('team1'),
      highestScoringHalf: observed('second'),
      halfTimeLeader: observed('draw'),
    };

    const result = score(prediction, observations, defaultRuleset, 'final');

    expect(question(result.breakdown, 'match-result').deduction).toBe(5_000);
    expect(question(result.breakdown, 'tries').deduction).toBe(50);
    expect(question(result.breakdown, 'penalty-kicks').deduction).toBe(200);
    expect(question(result.breakdown, 'team-score').deduction).toBe(220);
    expect(question(result.breakdown, 'highest-scoring-half').deduction).toBe(
      250,
    );
    expect(question(result.breakdown, 'half-time-leader').deduction).toBe(250);
    expect(result.totalDeductions).toBe(5_970);
    expect(result.score).toBe(4_030);
  });
});
