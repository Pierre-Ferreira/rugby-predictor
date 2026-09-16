import { describe, expect, it } from 'vitest';

import {
  activePredictionSteps,
  categoricalIncorrectDeduction,
  editStepIdForReviewSection,
  firstPredictionStepId,
  isFinalPredictionStep,
  nextPredictionLocation,
  predictionMessageCatalog,
  predictionStepPosition,
  previousPredictionLocation,
  resolvePredictionStepMessage,
  selectPredictionMessageVariants,
  standardPredictionStepDefinitions,
  teamNumericDeductionRate,
} from '../../imports/shared/predictions';
import {
  defaultRuleset,
  type BuiltInQuestionId,
  type RulesetSnapshot,
} from '../../imports/shared/scoring';
import {
  emptyFormForRuleset,
  firstTryConstraintForForm,
  resultConsistencyIssue,
  setTeamPredictionField,
  teamDisplayName,
} from '../../imports/ui/predictions/standardPredictionState';

const rulesetWithDisabledQuestions = (
  disabledIds: readonly BuiltInQuestionId[],
): RulesetSnapshot => ({
  ...defaultRuleset,
  questions: defaultRuleset.questions.map((question) =>
    disabledIds.includes(question.id as BuiltInQuestionId)
      ? { ...question, enabled: false }
      : question,
  ),
});

const fixtureNames = {
  team1DisplayName: 'Springboks',
  team2DisplayName: 'All Blacks',
};

const messageContext = {
  ruleset: defaultRuleset,
  team1Name: fixtureNames.team1DisplayName,
  team2Name: fixtureNames.team2DisplayName,
};

describe('prediction sequence definition', () => {
  it('keeps Intro and Review outside numbered standard progress', () => {
    const activeSteps = activePredictionSteps(defaultRuleset);

    expect(activeSteps).toHaveLength(9);
    expect(firstPredictionStepId(activeSteps)).toBe('match-result');
    expect(predictionStepPosition(activeSteps, 'match-result')).toEqual({
      current: 1,
      total: 9,
    });
    expect(predictionStepPosition(activeSteps, 'half-time-leader')).toEqual({
      current: 9,
      total: 9,
    });
  });

  it('derives progress totals from the active sequence definition', () => {
    const activeSteps = activePredictionSteps(
      rulesetWithDisabledQuestions(['highest-scoring-half']),
    );

    expect(activeSteps.map((step) => step.id)).not.toContain(
      'highest-scoring-half',
    );
    expect(activeSteps).toHaveLength(
      standardPredictionStepDefinitions.length - 1,
    );
    expect(predictionStepPosition(activeSteps, 'half-time-leader')).toEqual({
      current: activeSteps.length,
      total: activeSteps.length,
    });
  });

  it('calculates previous, next, Review, and edit destinations', () => {
    const activeSteps = activePredictionSteps(defaultRuleset);

    expect(previousPredictionLocation(activeSteps, 'match-result')).toEqual({
      kind: 'intro',
    });
    expect(nextPredictionLocation(activeSteps, 'match-result')).toEqual({
      kind: 'step',
      stepId: 'tries',
    });
    expect(nextPredictionLocation(activeSteps, 'half-time-leader')).toEqual({
      kind: 'review',
    });
    expect(isFinalPredictionStep(activeSteps, 'half-time-leader')).toBe(true);
    expect(editStepIdForReviewSection(activeSteps, 'cards')).toBe('cards');
    expect(editStepIdForReviewSection(activeSteps, 'predicted-score')).toBe(
      'tries',
    );
  });
});

describe('prediction message catalog', () => {
  it('provides shared variants for every built-in step', () => {
    for (const step of standardPredictionStepDefinitions) {
      expect(predictionMessageCatalog[step.messageId].variants.length).toBe(3);
    }
  });

  it('keeps selected variants stable when the same selection is reused', () => {
    const activeSteps = activePredictionSteps(defaultRuleset);
    const selection = selectPredictionMessageVariants(
      activeSteps.map((step) => step.messageId),
      () => 0.7,
    );

    expect(
      resolvePredictionStepMessage('tries', selection, messageContext),
    ).toStrictEqual(
      resolvePredictionStepMessage('tries', selection, messageContext),
    );
  });

  it('interpolates team names and ruleset deduction values', () => {
    const selection = { 'match-result': 0, tries: 0 };
    const matchResultMessage = resolvePredictionStepMessage(
      'match-result',
      selection,
      messageContext,
    );
    const triesMessage = resolvePredictionStepMessage(
      'tries',
      selection,
      messageContext,
    );

    expect(matchResultMessage.supportingText.join(' ')).toContain(
      teamDisplayName(fixtureNames, 'team1'),
    );
    expect(matchResultMessage.supportingText.join(' ')).toContain(
      teamDisplayName(fixtureNames, 'team2'),
    );
    expect(matchResultMessage.deduction).toContain(
      categoricalIncorrectDeduction(
        defaultRuleset,
        'match-result',
      )?.toLocaleString('en-US'),
    );
    expect(triesMessage.deduction).toContain(
      teamNumericDeductionRate(defaultRuleset, 'tries')?.toLocaleString(
        'en-US',
      ),
    );
  });
});

describe('standard prediction state helpers', () => {
  it('clamps conversions and re-evaluates first-try constraints from tries', () => {
    let form = emptyFormForRuleset(defaultRuleset);

    form = setTeamPredictionField(form, 'team1', 'tries', '3').form;
    form = setTeamPredictionField(form, 'team1', 'conversions', '3').form;
    form = setTeamPredictionField(form, 'team1', 'tries', '1').form;

    expect(form.team1.conversions).toBe('1');
    expect(form.firstTry).toBe('team1');
    expect(firstTryConstraintForForm(form)).toMatchObject({
      allowedAnswers: ['team1'],
      forcedAnswer: 'team1',
    });

    form = setTeamPredictionField(form, 'team2', 'tries', '2').form;
    expect(firstTryConstraintForForm(form).allowedAnswers).toEqual([
      'team1',
      'team2',
    ]);
  });

  it('detects score/result inconsistencies without changing answers', () => {
    let form = emptyFormForRuleset(defaultRuleset);

    form = { ...form, matchResult: 'team1' };
    form = setTeamPredictionField(form, 'team1', 'tries', '1').form;
    form = setTeamPredictionField(form, 'team1', 'conversions', '1').form;
    form = setTeamPredictionField(form, 'team2', 'tries', '2').form;
    form = setTeamPredictionField(form, 'team2', 'conversions', '2').form;

    const issue = resultConsistencyIssue(form, fixtureNames);

    expect(issue?.selectedResult).toBe('team1');
    expect(issue?.derivedResult).toBe('team2');
    expect(form.matchResult).toBe('team1');
  });
});
