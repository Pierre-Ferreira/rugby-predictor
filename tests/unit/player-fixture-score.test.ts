import { describe, expect, it } from 'vitest';
import {
  PlayerFixtureScoreError,
  calculatePlayerFixtureScoreProjection,
  type PlayerFixtureScoreFixtureInput,
  type PlayerFixtureScorePredictionInput,
  type PlayerFixtureScoreProjection,
  type PlayerFixtureScoreResultInput,
} from '../../imports/shared/playerFixtureScores';
import {
  buildConfiguredRulesetSnapshot,
  defaultFixturePredictionQuestionConfig,
} from '../../imports/shared/predictionQuestions';
import {
  defaultRuleset,
  type FixtureObservations,
  type FixturePrediction,
  type ObservedValue,
  type QuestionDefinition,
  type RulesetIdentity,
  type RulesetSnapshot,
} from '../../imports/shared/scoring';

const observed = <T>(
  value: T,
  status: 'provisional' | 'confirmed' = 'confirmed',
): ObservedValue<T> => ({ status, value });

const pending = <T>(): ObservedValue<T> => ({ status: 'pending' });

const identity = (ruleset: RulesetSnapshot): RulesetIdentity => ({
  id: ruleset.id,
  schemaVersion: ruleset.schemaVersion,
  version: ruleset.version,
});

const basePrediction: FixturePrediction = {
  firstTry: 'team1',
  halfTimeLeader: 'team1',
  highestScoringHalf: 'first',
  matchResult: 'team1',
  team1: {
    conversions: 2,
    dropGoals: 0,
    penaltyKicks: 1,
    redCards: 0,
    tries: 2,
    yellowCards: 0,
  },
  team2: {
    conversions: 1,
    dropGoals: 0,
    penaltyKicks: 0,
    redCards: 0,
    tries: 1,
    yellowCards: 0,
  },
};

const fixture = (
  overrides: Partial<PlayerFixtureScoreFixtureInput> = {},
): PlayerFixtureScoreFixtureInput => ({
  _id: 'fixture-011a',
  isCancelled: false,
  rulesetSnapshot: defaultRuleset,
  ...overrides,
});

const predictionEntry = (
  overrides: Partial<PlayerFixtureScorePredictionInput> = {},
  ruleset: RulesetSnapshot = defaultRuleset,
): PlayerFixtureScorePredictionInput => ({
  fixtureId: 'fixture-011a',
  prediction: basePrediction,
  revision: 3,
  ruleset: identity(ruleset),
  ...overrides,
});

const observationsFromPrediction = (
  prediction: FixturePrediction,
  status: 'provisional' | 'confirmed' = 'confirmed',
): FixtureObservations => ({
  firstTry: observed(prediction.firstTry ?? 'team1', status),
  halfTimeLeader: observed(prediction.halfTimeLeader ?? 'team1', status),
  highestScoringHalf: observed(
    prediction.highestScoringHalf ?? 'first',
    status,
  ),
  matchStatus: status,
  team1: {
    conversions: observed(prediction.team1.conversions, status),
    dropGoals: observed(prediction.team1.dropGoals, status),
    penaltyKicks: observed(prediction.team1.penaltyKicks, status),
    redCards: observed(prediction.team1.redCards ?? 0, status),
    tries: observed(prediction.team1.tries, status),
    yellowCards: observed(prediction.team1.yellowCards ?? 0, status),
  },
  team2: {
    conversions: observed(prediction.team2.conversions, status),
    dropGoals: observed(prediction.team2.dropGoals, status),
    penaltyKicks: observed(prediction.team2.penaltyKicks, status),
    redCards: observed(prediction.team2.redCards ?? 0, status),
    tries: observed(prediction.team2.tries, status),
    yellowCards: observed(prediction.team2.yellowCards ?? 0, status),
  },
});

const resultEntry = (
  observations: FixtureObservations,
  overrides: Partial<PlayerFixtureScoreResultInput> = {},
  ruleset: RulesetSnapshot = defaultRuleset,
): PlayerFixtureScoreResultInput => ({
  fixtureId: 'fixture-011a',
  observations,
  revision: 7,
  ruleset: identity(ruleset),
  ...overrides,
});

const component = (
  projection: PlayerFixtureScoreProjection,
  questionId: string,
) => {
  const match = projection.components.find(
    (candidate) => candidate.questionId === questionId,
  );

  if (!match) {
    throw new Error(`Missing component ${questionId}`);
  }

  return match;
};

const customRuleset = (): RulesetSnapshot =>
  buildConfiguredRulesetSnapshot({
    ...defaultFixturePredictionQuestionConfig(),
    customQuestions: [
      {
        answerType: 'number',
        countingDefinition: 'Scrum penalties conceded by Team 2.',
        deductionPerUnit: 25,
        id: 'scrum-pressure',
        max: 12,
        min: 0,
        order: 1,
        prompt: 'How many scrum penalties?',
      },
      {
        answerType: 'choice',
        countingDefinition: 'Official player of the match group.',
        id: 'player-band',
        incorrectDeduction: 75,
        options: [
          { id: 'backs', label: 'Backs' },
          { id: 'forwards', label: 'Forwards' },
        ],
        order: 2,
        prompt: 'Which group produces the player of the match?',
      },
    ],
  });

describe('player fixture score projection', () => {
  it('returns an awaiting-result projection without treating starting points as earned', () => {
    const projection = calculatePlayerFixtureScoreProjection({
      fixture: fixture(),
      prediction: predictionEntry(),
      result: null,
    });

    expect(projection).toMatchObject({
      currentScore: null,
      finalScore: null,
      fixtureId: 'fixture-011a',
      pendingCount: 0,
      predictionRevision: 3,
      resolvedDeduction: 0,
      resultRevision: null,
      startingPoints: 10_000,
      status: 'awaiting_result',
    });
    expect(projection.components).toEqual([]);
  });

  it('projects provisional scores from resolved components while keeping pending components unresolved', () => {
    const observations = observationsFromPrediction(
      basePrediction,
      'provisional',
    );
    const projection = calculatePlayerFixtureScoreProjection({
      fixture: fixture(),
      prediction: predictionEntry(),
      result: resultEntry({
        ...observations,
        team1: {
          ...observations.team1,
          redCards: pending(),
          tries: observed(3, 'provisional'),
          yellowCards: pending(),
        },
        team2: {
          ...observations.team2,
          redCards: pending(),
          yellowCards: pending(),
        },
      }),
    });

    expect(projection.status).toBe('provisional');
    expect(projection.currentScore).toBeLessThan(10_000);
    expect(projection.finalScore).toBeNull();
    expect(projection.resultRevision).toBe(7);
    expect(projection.pendingCount).toBe(2);
    expect(component(projection, 'tries')).toMatchObject({
      deduction: 50,
      status: 'resolved',
    });
    expect(component(projection, 'yellow-cards')).toMatchObject({
      deduction: null,
      status: 'pending',
    });
    expect(component(projection, 'red-cards')).toMatchObject({
      deduction: null,
      status: 'pending',
    });
  });

  it('projects final score, zero pending components, and stable finalScore', () => {
    const projection = calculatePlayerFixtureScoreProjection({
      fixture: fixture(),
      prediction: predictionEntry(),
      result: resultEntry(observationsFromPrediction(basePrediction)),
    });

    expect(projection.status).toBe('final');
    expect(projection.currentScore).toBe(10_000);
    expect(projection.finalScore).toBe(10_000);
    expect(projection.pendingCount).toBe(0);
    expect(
      projection.components.every((item) => item.status === 'resolved'),
    ).toBe(true);
  });

  it('keeps Draw as a legitimate match result through the projection', () => {
    const drawPrediction: FixturePrediction = {
      ...basePrediction,
      halfTimeLeader: 'draw',
      highestScoringHalf: 'equal',
      matchResult: 'draw',
      team1: {
        ...basePrediction.team1,
        conversions: 1,
        dropGoals: 0,
        penaltyKicks: 0,
        tries: 1,
      },
      team2: {
        ...basePrediction.team2,
        conversions: 1,
        dropGoals: 0,
        penaltyKicks: 0,
        tries: 1,
      },
    };
    const projection = calculatePlayerFixtureScoreProjection({
      fixture: fixture(),
      prediction: predictionEntry({ prediction: drawPrediction }),
      result: resultEntry(observationsFromPrediction(drawPrediction)),
    });
    const drawnResultForNonDrawPrediction =
      observationsFromPrediction(basePrediction);
    const nonDrawProjection = calculatePlayerFixtureScoreProjection({
      fixture: fixture(),
      prediction: predictionEntry(),
      result: resultEntry({
        ...drawnResultForNonDrawPrediction,
        halfTimeLeader: observed('draw'),
        highestScoringHalf: observed('equal'),
        team2: {
          ...drawnResultForNonDrawPrediction.team2,
          conversions: observed(2),
          penaltyKicks: observed(1),
          tries: observed(2),
        },
      }),
    });

    expect(projection.status).toBe('final');
    expect(projection.finalScore).toBe(10_000);
    expect(component(nonDrawProjection, 'match-result').deduction).toBe(5_000);
  });

  it('keeps the scoring engine authoritative for wrong results and the zero floor', () => {
    const heavyRuleset: RulesetSnapshot = {
      ...defaultRuleset,
      id: 'historic-heavy-result',
      questions: defaultRuleset.questions.map((question): QuestionDefinition =>
        question.id === 'match-result' &&
        question.type === 'built-in-categorical'
          ? { ...question, incorrectDeduction: 20_000 }
          : question,
      ),
      version: '011a-heavy-result',
    };
    const observations: FixtureObservations = {
      ...observationsFromPrediction(basePrediction),
      firstTry: observed('team2'),
      halfTimeLeader: observed('team2'),
      highestScoringHalf: observed('second'),
      team1: {
        conversions: observed(0),
        dropGoals: observed(0),
        penaltyKicks: observed(0),
        redCards: observed(1),
        tries: observed(0),
        yellowCards: observed(2),
      },
      team2: {
        conversions: observed(3),
        dropGoals: observed(1),
        penaltyKicks: observed(3),
        redCards: observed(1),
        tries: observed(3),
        yellowCards: observed(2),
      },
    };
    const projection = calculatePlayerFixtureScoreProjection({
      fixture: fixture({ rulesetSnapshot: heavyRuleset }),
      prediction: predictionEntry({}, heavyRuleset),
      result: resultEntry(observations, {}, heavyRuleset),
    });

    expect(component(projection, 'match-result').deduction).toBe(20_000);
    expect(projection.resolvedDeduction).toBeGreaterThan(10_000);
    expect(projection.currentScore).toBe(0);
    expect(projection.finalScore).toBe(0);
  });

  it('preserves custom choice Void and custom number scoring from the frozen ruleset', () => {
    const ruleset = customRuleset();
    const prediction = predictionEntry(
      {
        prediction: {
          ...basePrediction,
          customAnswers: {
            'player-band': 'forwards',
            'scrum-pressure': 4,
          },
        },
      },
      ruleset,
    );
    const projection = calculatePlayerFixtureScoreProjection({
      fixture: fixture({ rulesetSnapshot: ruleset }),
      prediction,
      result: resultEntry(
        {
          ...observationsFromPrediction(prediction.prediction),
          customAnswers: {
            'player-band': { status: 'void' },
            'scrum-pressure': { status: 'confirmed', value: 6 },
          },
        },
        {},
        ruleset,
      ),
    });

    expect(component(projection, 'scrum-pressure')).toMatchObject({
      deduction: 50,
      status: 'resolved',
    });
    expect(component(projection, 'player-band')).toMatchObject({
      deduction: 0,
      status: 'void',
    });
    expect(projection.pendingCount).toBe(0);
  });

  it('returns a cancelled non-score projection without invoking ordinary scoring', () => {
    const observations = observationsFromPrediction(basePrediction);
    const projection = calculatePlayerFixtureScoreProjection({
      fixture: fixture({ isCancelled: true }),
      prediction: predictionEntry(),
      result: resultEntry(observations),
    });

    expect(projection).toMatchObject({
      currentScore: null,
      finalScore: null,
      pendingCount: 0,
      resolvedDeduction: 0,
      resultRevision: 7,
      status: 'cancelled',
    });
    expect(projection.components).toEqual([]);
  });

  it('fails safely when canonical fixture, prediction, and result inputs disagree', () => {
    expect(() =>
      calculatePlayerFixtureScoreProjection({
        fixture: fixture(),
        prediction: predictionEntry({
          ruleset: {
            ...identity(defaultRuleset),
            version: 'older-fixture-rules',
          },
        }),
        result: null,
      }),
    ).toThrow(PlayerFixtureScoreError);

    expect(() =>
      calculatePlayerFixtureScoreProjection({
        fixture: fixture(),
        prediction: predictionEntry(),
        result: resultEntry(observationsFromPrediction(basePrediction), {
          fixtureId: 'other-fixture',
        }),
      }),
    ).toThrow(PlayerFixtureScoreError);
  });
});
