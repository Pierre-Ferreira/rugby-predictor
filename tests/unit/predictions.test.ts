import { describe, expect, it } from 'vitest';

import {
  PredictionValidationError,
  sanitizeSubmitPredictionInput,
} from '../../imports/shared/predictions';
import {
  defaultRuleset,
  type FixturePrediction,
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
});
