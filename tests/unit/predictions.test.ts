import { describe, expect, it } from 'vitest';

import {
  PredictionValidationError,
  sanitizeSubmitPredictionInput,
} from '../../imports/shared/predictions';
import {
  buildConfiguredRulesetSnapshot,
  defaultFixturePredictionQuestionConfig,
} from '../../imports/shared/predictionQuestions';
import {
  defaultRuleset,
  type FixturePrediction,
  type RulesetSnapshot,
} from '../../imports/shared/scoring';

const validPrediction = (): FixturePrediction => ({
  firstTry: 'team1',
  halfTimeLeader: 'team1',
  highestScoringHalf: 'second',
  matchResult: 'team1',
  team1: {
    conversions: 2,
    dropGoals: 0,
    penaltyKicks: 1,
    redCards: 0,
    tries: 2,
    yellowCards: 1,
  },
  team2: {
    conversions: 1,
    dropGoals: 0,
    penaltyKicks: 1,
    redCards: 0,
    tries: 1,
    yellowCards: 0,
  },
});

const customRuleset = (): RulesetSnapshot =>
  buildConfiguredRulesetSnapshot({
    ...defaultFixturePredictionQuestionConfig(),
    customQuestions: [
      {
        answerType: 'number',
        countingDefinition: 'Scrum penalties awarded against Team 2.',
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

const validCustomPrediction = (): FixturePrediction => ({
  ...validPrediction(),
  customAnswers: {
    'player-band': 'forwards',
    'scrum-pressure': 4,
  },
});

describe('prediction submission validation', () => {
  it('accepts a valid create payload without an expected revision', () => {
    const result = sanitizeSubmitPredictionInput(
      {
        fixtureId: 'fixture_123',
        prediction: validPrediction(),
      },
      defaultRuleset,
    );

    expect(result.expectedRevision).toBeUndefined();
    expect(result).toMatchObject({
      fixtureId: 'fixture_123',
      prediction: {
        matchResult: 'team1',
      },
    });
  });

  it('accepts a valid update payload with a captured revision', () => {
    expect(
      sanitizeSubmitPredictionInput(
        {
          expectedRevision: 2,
          fixtureId: 'fixture_123',
          prediction: validPrediction(),
        },
        defaultRuleset,
      ).expectedRevision,
    ).toBe(2);
  });

  it('preserves internal team-side values in sanitized prediction answers', () => {
    const result = sanitizeSubmitPredictionInput(
      {
        fixtureId: 'fixture_123',
        prediction: {
          ...validPrediction(),
          firstTry: 'team2',
          halfTimeLeader: 'draw',
        },
      },
      defaultRuleset,
    );

    expect(result.prediction.matchResult).toBe('team1');
    expect(result.prediction.firstTry).toBe('team2');
    expect(result.prediction.halfTimeLeader).toBe('draw');
  });

  it('rejects server-owned field injection in the submission envelope', () => {
    expect(() =>
      sanitizeSubmitPredictionInput(
        {
          createdAt: new Date().toISOString(),
          fixtureId: 'fixture_123',
          prediction: validPrediction(),
          revision: 99,
          score: 10_000,
          userId: 'attacker',
        },
        defaultRuleset,
      ),
    ).toThrow(PredictionValidationError);
  });

  it('rejects contradictory predictions using scoring validation', () => {
    expect(() =>
      sanitizeSubmitPredictionInput(
        {
          fixtureId: 'fixture_123',
          prediction: {
            ...validPrediction(),
            matchResult: 'team2',
          },
        },
        defaultRuleset,
      ),
    ).toThrow(/Scoring input is invalid/);
  });

  it('rejects conversion counts above tries if a client bypasses the UI', () => {
    expect(() =>
      sanitizeSubmitPredictionInput(
        {
          fixtureId: 'fixture_123',
          prediction: {
            ...validPrediction(),
            team2: {
              conversions: 3,
              dropGoals: 0,
              penaltyKicks: 1,
              redCards: 0,
              tries: 1,
              yellowCards: 0,
            },
          },
        },
        defaultRuleset,
      ),
    ).toThrow(/Scoring input is invalid/);
  });

  it('accepts valid custom number and choice answers from the frozen ruleset', () => {
    const result = sanitizeSubmitPredictionInput(
      {
        fixtureId: 'fixture_123',
        prediction: validCustomPrediction(),
      },
      customRuleset(),
    );

    expect(result.prediction.customAnswers).toEqual({
      'player-band': 'forwards',
      'scrum-pressure': 4,
    });
  });

  it('accepts custom numeric minimum and maximum bounds', () => {
    const ruleset = customRuleset();

    expect(
      sanitizeSubmitPredictionInput(
        {
          fixtureId: 'fixture_123',
          prediction: {
            ...validCustomPrediction(),
            customAnswers: {
              ...validCustomPrediction().customAnswers,
              'scrum-pressure': 0,
            },
          },
        },
        ruleset,
      ).prediction.customAnswers?.['scrum-pressure'],
    ).toBe(0);
    expect(
      sanitizeSubmitPredictionInput(
        {
          fixtureId: 'fixture_123',
          prediction: {
            ...validCustomPrediction(),
            customAnswers: {
              ...validCustomPrediction().customAnswers,
              'scrum-pressure': 12,
            },
          },
        },
        ruleset,
      ).prediction.customAnswers?.['scrum-pressure'],
    ).toBe(12);
  });

  it('rejects malformed custom numeric answers', () => {
    const ruleset = customRuleset();

    for (const answer of [-1, 13, 2.5, Number.POSITIVE_INFINITY, '4']) {
      expect(() =>
        sanitizeSubmitPredictionInput(
          {
            fixtureId: 'fixture_123',
            prediction: {
              ...validCustomPrediction(),
              customAnswers: {
                ...validCustomPrediction().customAnswers,
                'scrum-pressure': answer,
              },
            },
          },
          ruleset,
        ),
      ).toThrow(/Scoring input is invalid/);
    }
  });

  it('rejects missing, unknown, and invalid custom choice answers', () => {
    const ruleset = customRuleset();

    expect(() =>
      sanitizeSubmitPredictionInput(
        {
          fixtureId: 'fixture_123',
          prediction: {
            ...validCustomPrediction(),
            customAnswers: {
              'player-band': 'forwards',
            },
          },
        },
        ruleset,
      ),
    ).toThrow(/Scoring input is invalid/);

    expect(() =>
      sanitizeSubmitPredictionInput(
        {
          fixtureId: 'fixture_123',
          prediction: {
            ...validCustomPrediction(),
            customAnswers: {
              ...validCustomPrediction().customAnswers,
              'player-band': 'Forward pack',
            },
          },
        },
        ruleset,
      ),
    ).toThrow(/Scoring input is invalid/);

    expect(() =>
      sanitizeSubmitPredictionInput(
        {
          fixtureId: 'fixture_123',
          prediction: {
            ...validCustomPrediction(),
            customAnswers: {
              ...validCustomPrediction().customAnswers,
              unknown: 1,
            },
          },
        },
        ruleset,
      ),
    ).toThrow(/Scoring input is invalid/);
  });

  it('rejects injected custom question definitions and custom answers without matching frozen questions', () => {
    expect(() =>
      sanitizeSubmitPredictionInput(
        {
          fixtureId: 'fixture_123',
          prediction: {
            ...validCustomPrediction(),
            customAnswers: {
              'player-band': {
                incorrectDeduction: 0,
                label: 'Injected label',
                value: 'forwards',
              },
              'scrum-pressure': 4,
            },
          },
        },
        customRuleset(),
      ),
    ).toThrow(/Scoring input is invalid/);

    expect(() =>
      sanitizeSubmitPredictionInput(
        {
          fixtureId: 'fixture_123',
          prediction: validCustomPrediction(),
        },
        defaultRuleset,
      ),
    ).toThrow(/Scoring input is invalid/);
  });
});
