import { describe, expect, it } from 'vitest';

import {
  MAX_CUSTOM_QUESTIONS_PER_FIXTURE,
  buildConfiguredRulesetSnapshot,
  defaultFixturePredictionQuestionConfig,
  normalizeFixturePredictionQuestionConfig,
} from '../../imports/shared/predictionQuestions';
import { activePredictionSteps } from '../../imports/shared/predictions/sequence';

const validNumberQuestion = (id = 'custom-number-1') => ({
  answerType: 'number',
  banter: 'Bok power!',
  countingDefinition:
    'Scrum penalties awarded against the All Blacks during regulation time.',
  deductionPerUnit: 150,
  id,
  max: 20,
  min: 0,
  order: 99,
  prompt: 'How many scrum penalties will the All Blacks concede?',
});

const validChoiceQuestion = (id = 'custom-choice-1') => ({
  answerType: 'choice',
  countingDefinition: 'The team officially listed as scoring the first points.',
  id,
  incorrectDeduction: 300,
  options: [
    {
      id: `${id}-option-a`,
      label: 'Stormers',
    },
    {
      id: `${id}-option-b`,
      label: 'Bulls',
    },
  ],
  order: 1,
  prompt: 'Who scores first?',
});

const configWithCustomQuestions = (
  customQuestions: readonly Record<string, unknown>[],
) => ({
  ...defaultFixturePredictionQuestionConfig(),
  customQuestions,
});

describe('prediction question configuration validation', () => {
  it('accepts a valid NUMBER custom question and normalizes ordering', () => {
    const normalized = normalizeFixturePredictionQuestionConfig(
      configWithCustomQuestions([validNumberQuestion()]),
    );

    expect(normalized.customQuestions).toHaveLength(1);
    expect(normalized.customQuestions[0]).toMatchObject({
      answerType: 'number',
      deductionPerUnit: 150,
      id: 'custom-number-1',
      max: 20,
      min: 0,
      order: 1,
    });
  });

  it('rejects invalid NUMBER custom question fields', () => {
    expect(() =>
      normalizeFixturePredictionQuestionConfig(
        configWithCustomQuestions([
          {
            ...validNumberQuestion(),
            prompt: '   ',
          },
        ]),
      ),
    ).toThrow(/question is required/i);

    expect(() =>
      normalizeFixturePredictionQuestionConfig(
        configWithCustomQuestions([
          {
            ...validNumberQuestion(),
            countingDefinition: '',
          },
        ]),
      ),
    ).toThrow(/counting definition is required/i);

    expect(() =>
      normalizeFixturePredictionQuestionConfig(
        configWithCustomQuestions([
          {
            ...validNumberQuestion(),
            max: 3,
            min: 4,
          },
        ]),
      ),
    ).toThrow(/maximum must be greater than or equal to minimum/i);

    expect(() =>
      normalizeFixturePredictionQuestionConfig(
        configWithCustomQuestions([
          {
            ...validNumberQuestion(),
            min: 1.5,
          },
        ]),
      ),
    ).toThrow(/minimum answer must be a finite non-negative whole number/i);

    expect(() =>
      normalizeFixturePredictionQuestionConfig(
        configWithCustomQuestions([
          {
            ...validNumberQuestion(),
            deductionPerUnit: -1,
          },
        ]),
      ),
    ).toThrow(/deduction per unit must be a finite non-negative whole number/i);
  });

  it('accepts a valid CHOICE custom question', () => {
    const normalized = normalizeFixturePredictionQuestionConfig(
      configWithCustomQuestions([validChoiceQuestion()]),
    );

    expect(normalized.customQuestions[0]).toMatchObject({
      answerType: 'choice',
      id: 'custom-choice-1',
      incorrectDeduction: 300,
      order: 1,
    });
  });

  it('rejects invalid CHOICE custom question fields', () => {
    expect(() =>
      normalizeFixturePredictionQuestionConfig(
        configWithCustomQuestions([
          {
            ...validChoiceQuestion(),
            options: [validChoiceQuestion().options[0]],
          },
        ]),
      ),
    ).toThrow(/add at least two choices/i);

    expect(() =>
      normalizeFixturePredictionQuestionConfig(
        configWithCustomQuestions([
          {
            ...validChoiceQuestion(),
            options: [
              validChoiceQuestion().options[0],
              {
                id: 'custom-choice-1-option-empty',
                label: '',
              },
            ],
          },
        ]),
      ),
    ).toThrow(/choice label is required/i);

    expect(() =>
      normalizeFixturePredictionQuestionConfig(
        configWithCustomQuestions([
          {
            ...validChoiceQuestion(),
            options: [
              {
                id: 'custom-choice-1-option-a',
                label: ' Stormers ',
              },
              {
                id: 'custom-choice-1-option-b',
                label: 'stormers',
              },
            ],
          },
        ]),
      ),
    ).toThrow(/choice labels must be unique/i);

    expect(() =>
      normalizeFixturePredictionQuestionConfig(
        configWithCustomQuestions([
          {
            ...validChoiceQuestion(),
            options: [
              {
                id: 'duplicate-option',
                label: 'Stormers',
              },
              {
                id: 'duplicate-option',
                label: 'Bulls',
              },
            ],
          },
        ]),
      ),
    ).toThrow(/choice option id 'duplicate-option' is duplicated/i);

    expect(() =>
      normalizeFixturePredictionQuestionConfig(
        configWithCustomQuestions([
          {
            ...validChoiceQuestion(),
            incorrectDeduction: 1.25,
          },
        ]),
      ),
    ).toThrow(
      /incorrect-answer deduction must be a finite non-negative whole number/i,
    );
  });

  it('rejects unsupported types, too many custom questions, and duplicate custom IDs', () => {
    expect(() =>
      normalizeFixturePredictionQuestionConfig(
        configWithCustomQuestions([
          {
            ...validNumberQuestion(),
            answerType: 'text',
          },
        ]),
      ),
    ).toThrow(/answer type is not supported/i);

    expect(() =>
      normalizeFixturePredictionQuestionConfig(
        configWithCustomQuestions([
          validNumberQuestion('custom-number-1'),
          validChoiceQuestion('custom-choice-1'),
          validNumberQuestion('custom-number-2'),
        ]),
      ),
    ).toThrow(`Maximum of ${MAX_CUSTOM_QUESTIONS_PER_FIXTURE}`);

    expect(() =>
      normalizeFixturePredictionQuestionConfig(
        configWithCustomQuestions([
          validNumberQuestion('same-custom-id'),
          validChoiceQuestion('same-custom-id'),
        ]),
      ),
    ).toThrow(/custom question id 'same-custom-id' is duplicated/i);
  });

  it('preserves stable IDs after edits while normalizing order', () => {
    const first = validNumberQuestion('custom-number-stable');
    const saved = normalizeFixturePredictionQuestionConfig(
      configWithCustomQuestions([
        first,
        validChoiceQuestion('custom-choice-stable'),
      ]),
    );
    const edited = normalizeFixturePredictionQuestionConfig({
      ...saved,
      customQuestions: [
        {
          ...saved.customQuestions[1],
          order: 50,
          prompt: 'Who scores the first points?',
        },
        {
          ...saved.customQuestions[0],
          order: 10,
          prompt: 'Updated numeric prompt?',
        },
      ],
    });

    expect(edited.customQuestions.map((question) => question.id)).toEqual([
      'custom-choice-stable',
      'custom-number-stable',
    ]);
    expect(edited.customQuestions.map((question) => question.order)).toEqual([
      1, 2,
    ]);
  });

  it('rejects unknown injected fields and core-question configuration attempts', () => {
    expect(() =>
      normalizeFixturePredictionQuestionConfig({
        ...defaultFixturePredictionQuestionConfig(),
        updatedByAdminId: 'attacker',
      }),
    ).toThrow(/unsupported fields/i);

    expect(() =>
      normalizeFixturePredictionQuestionConfig(
        configWithCustomQuestions([
          {
            ...validNumberQuestion(),
            serverOnly: true,
          },
        ]),
      ),
    ).toThrow(/unsupported fields/i);

    expect(() =>
      normalizeFixturePredictionQuestionConfig({
        ...defaultFixturePredictionQuestionConfig(),
        optionalStandardQuestions: [
          {
            enabled: false,
            id: 'match-result',
            incorrectDeduction: 1,
          },
          ...defaultFixturePredictionQuestionConfig().optionalStandardQuestions,
        ],
      }),
    ).toThrow(/permanent core questions cannot be disabled/i);
  });

  it('projects optional standard configuration into the ruleset snapshot', () => {
    const config = normalizeFixturePredictionQuestionConfig({
      ...defaultFixturePredictionQuestionConfig(),
      optionalStandardQuestions:
        defaultFixturePredictionQuestionConfig().optionalStandardQuestions.map(
          (question) =>
            question.id === 'first-try'
              ? {
                  ...question,
                  enabled: false,
                  incorrectDeduction: 375,
                }
              : question.id === 'half-time-leader'
                ? {
                    ...question,
                    incorrectDeduction: 425,
                  }
                : question,
        ),
    });
    const snapshot = buildConfiguredRulesetSnapshot(config);

    expect(
      snapshot.questions.find((question) => question.id === 'first-try'),
    ).toMatchObject({
      enabled: false,
      incorrectDeduction: 375,
    });
    expect(
      snapshot.questions.find((question) => question.id === 'half-time-leader'),
    ).toMatchObject({
      enabled: true,
      incorrectDeduction: 425,
    });
    expect(
      activePredictionSteps(snapshot).map((step) => step.id),
    ).not.toContain('first-try');
  });
});
