import { describe, expect, it } from 'vitest';

import {
  MatchResultValidationError,
  normalizeResultObservations,
} from '../../imports/shared/matchResults';
import {
  createRulesetSnapshot,
  defaultRuleset,
  type FixtureObservations,
  type ObservedValue,
  type QuestionDefinition,
  type RulesetSnapshot,
} from '../../imports/shared/scoring';

const observed = <T>(
  value: T,
  status: 'provisional' | 'confirmed' = 'provisional',
): ObservedValue<T> => ({ status, value });

const completeObservations = (
  overrides: Partial<FixtureObservations> = {},
): FixtureObservations => ({
  firstTry: observed('team1'),
  halfTimeLeader: observed('team1'),
  highestScoringHalf: observed('second'),
  matchStatus: 'provisional',
  team1: {
    conversions: observed(2),
    dropGoals: observed(0),
    penaltyKicks: observed(1),
    redCards: observed(0),
    tries: observed(3),
    yellowCards: observed(1),
  },
  team2: {
    conversions: observed(1),
    dropGoals: observed(0),
    penaltyKicks: observed(2),
    redCards: observed(0),
    tries: observed(1),
    yellowCards: observed(0),
  },
  ...overrides,
});

const customRuleset = (): RulesetSnapshot =>
  createRulesetSnapshot({
    ...defaultRuleset,
    version: 'match-result-raw-validation',
    questions: [
      ...defaultRuleset.questions,
      {
        countingDefinition: 'Final confirmed winning margin.',
        enabled: true,
        id: 'winning-margin',
        label: 'Winning margin',
        max: 10,
        min: 0,
        order: 1,
        prompt: 'Winning margin',
        rate: 30,
        type: 'custom-numeric',
      },
      {
        countingDefinition: 'Official weather at kickoff.',
        enabled: true,
        id: 'weather',
        incorrectDeduction: 75,
        label: 'Weather',
        options: [
          { id: 'dry', label: 'Dry' },
          { id: 'wet', label: 'Wet' },
        ],
        order: 2,
        prompt: 'Weather',
        type: 'custom-categorical',
      },
    ] satisfies readonly QuestionDefinition[],
  });

const captureResultError = (
  action: () => unknown,
): MatchResultValidationError => {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(MatchResultValidationError);
    return error as MatchResultValidationError;
  }

  throw new Error('Expected match result validation error');
};

describe('match result raw observation validation', () => {
  it('rejects malformed raw statuses before lifecycle normalization', () => {
    const ruleset = customRuleset();
    const cases: readonly {
      readonly observations: unknown;
      readonly ruleset: RulesetSnapshot;
      readonly message: RegExp;
    }[] = [
      {
        message: /unsupported observation status/i,
        observations: completeObservations({
          team1: {
            ...completeObservations().team1,
            tries: { status: 'garbage', value: 3 } as never,
          },
        }),
        ruleset: defaultRuleset,
      },
      {
        message: /unsupported observation status/i,
        observations: completeObservations({
          team1: {
            ...completeObservations().team1,
            tries: { status: 'void', value: 3 } as never,
          },
        }),
        ruleset: defaultRuleset,
      },
      {
        message: /unsupported observation status/i,
        observations: completeObservations({
          customAnswers: {
            weather: observed('dry'),
            'winning-margin': { status: 'garbage', value: 3 },
          } as never,
        }),
        ruleset,
      },
      {
        message: /must not include a value/i,
        observations: completeObservations({
          customAnswers: {
            weather: observed('dry'),
            'winning-margin': { status: 'void', value: 3 },
          } as never,
        }),
        ruleset,
      },
    ];

    for (const testCase of cases) {
      const error = captureResultError(() =>
        normalizeResultObservations(
          testCase.observations,
          testCase.ruleset,
          'provisional',
        ),
      );

      expect(error.message).toMatch(testCase.message);
    }
  });

  it('accepts custom void without value and preserves it through normalization', () => {
    const normalized = normalizeResultObservations(
      completeObservations({
        customAnswers: {
          weather: { status: 'void' },
          'winning-margin': observed(11),
        },
      }),
      customRuleset(),
      'provisional',
    );

    expect(normalized.customAnswers?.weather?.status).toBe('void');
    expect('value' in (normalized.customAnswers?.weather ?? {})).toBe(false);
    expect(normalized.customAnswers?.['winning-margin']?.status).toBe(
      'provisional',
    );
  });

  it('rejects unknown nested fields on every observation input family', () => {
    const ruleset = customRuleset();
    const cases: readonly {
      readonly observations: unknown;
      readonly ruleset: RulesetSnapshot;
    }[] = [
      {
        observations: completeObservations({
          team1: {
            ...completeObservations().team1,
            tries: {
              injectedThing: 'x',
              status: 'provisional',
              value: 3,
            } as never,
          },
        }),
        ruleset: defaultRuleset,
      },
      {
        observations: completeObservations({
          firstTry: {
            injectedThing: 'x',
            status: 'provisional',
            value: 'team1',
          } as never,
        }),
        ruleset: defaultRuleset,
      },
      {
        observations: completeObservations({
          customAnswers: {
            weather: observed('dry'),
            'winning-margin': {
              injectedThing: 'x',
              status: 'provisional',
              value: 3,
            },
          } as never,
        }),
        ruleset,
      },
      {
        observations: completeObservations({
          customAnswers: {
            weather: {
              injectedThing: 'x',
              status: 'provisional',
              value: 'dry',
            },
            'winning-margin': observed(3),
          } as never,
        }),
        ruleset,
      },
    ];

    for (const testCase of cases) {
      const error = captureResultError(() =>
        normalizeResultObservations(
          testCase.observations,
          testCase.ruleset,
          'provisional',
        ),
      );

      expect(error.message).toMatch(/unsupported fields: injectedThing/i);
    }
  });

  it('keeps legitimate provisional and final lifecycle normalization server-owned', () => {
    const ruleset = customRuleset();
    const provisional = normalizeResultObservations(
      completeObservations({
        customAnswers: {
          weather: observed('dry', 'confirmed'),
          'winning-margin': observed(11, 'confirmed'),
        },
        team1: {
          ...completeObservations().team1,
          tries: observed(3, 'confirmed'),
        },
        team2: {
          ...completeObservations().team2,
          yellowCards: { status: 'pending' },
        },
      }),
      ruleset,
      'provisional',
    );

    expect(provisional.matchStatus).toBe('provisional');
    expect(provisional.team1.tries?.status).toBe('provisional');
    expect(provisional.customAnswers?.['winning-margin']?.status).toBe(
      'provisional',
    );
    expect(provisional.customAnswers?.weather?.status).toBe('provisional');
    expect(provisional.team2.yellowCards?.status).toBe('pending');

    const final = normalizeResultObservations(
      completeObservations({
        customAnswers: {
          weather: { status: 'void' },
          'winning-margin': observed(11),
        },
      }),
      ruleset,
      'final',
    );

    expect(final.matchStatus).toBe('confirmed');
    expect(final.team1.tries?.status).toBe('confirmed');
    expect(final.customAnswers?.['winning-margin']?.status).toBe('confirmed');
    expect(final.customAnswers?.weather?.status).toBe('void');
  });
});
