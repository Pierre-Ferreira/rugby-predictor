import {
  isBuiltInEnabled,
  type BuiltInQuestionId,
  type RulesetSnapshot,
} from '/imports/shared/scoring';

export const predictionStepIds = [
  'match-result',
  'tries',
  'conversions',
  'penalty-kicks',
  'drop-goals',
  'cards',
  'first-try',
  'highest-scoring-half',
  'half-time-leader',
] as const;

export type PredictionStepId = (typeof predictionStepIds)[number];

export type PredictionStepKind = 'cards' | 'choice' | 'team-score-component';

export type PredictionReviewSectionId =
  | 'cards'
  | 'first-try'
  | 'half-time-leader'
  | 'highest-scoring-half'
  | 'match-result'
  | 'predicted-score'
  | 'scoring-detail';

export type PredictionSequenceLocation =
  | { readonly kind: 'intro' }
  | { readonly kind: 'review' }
  | { readonly kind: 'step'; readonly stepId: PredictionStepId };

export interface PredictionSequenceStepDefinition {
  readonly id: PredictionStepId;
  readonly kind: PredictionStepKind;
  readonly messageId: PredictionStepId;
  readonly reviewSectionId: PredictionReviewSectionId;
  readonly requiredQuestionIds?: readonly BuiltInQuestionId[];
  readonly requiredAnyQuestionIds?: readonly BuiltInQuestionId[];
}

export const scoreProducingPredictionStepIds = [
  'tries',
  'conversions',
  'penalty-kicks',
  'drop-goals',
] as const satisfies readonly PredictionStepId[];

export const standardPredictionStepDefinitions: readonly PredictionSequenceStepDefinition[] =
  [
    {
      id: 'match-result',
      kind: 'choice',
      messageId: 'match-result',
      requiredQuestionIds: ['match-result'],
      reviewSectionId: 'match-result',
    },
    {
      id: 'tries',
      kind: 'team-score-component',
      messageId: 'tries',
      reviewSectionId: 'scoring-detail',
    },
    {
      id: 'conversions',
      kind: 'team-score-component',
      messageId: 'conversions',
      reviewSectionId: 'scoring-detail',
    },
    {
      id: 'penalty-kicks',
      kind: 'team-score-component',
      messageId: 'penalty-kicks',
      reviewSectionId: 'scoring-detail',
    },
    {
      id: 'drop-goals',
      kind: 'team-score-component',
      messageId: 'drop-goals',
      reviewSectionId: 'predicted-score',
    },
    {
      id: 'cards',
      kind: 'cards',
      messageId: 'cards',
      requiredAnyQuestionIds: ['yellow-cards', 'red-cards'],
      reviewSectionId: 'cards',
    },
    {
      id: 'first-try',
      kind: 'choice',
      messageId: 'first-try',
      requiredQuestionIds: ['first-try'],
      reviewSectionId: 'first-try',
    },
    {
      id: 'highest-scoring-half',
      kind: 'choice',
      messageId: 'highest-scoring-half',
      requiredQuestionIds: ['highest-scoring-half'],
      reviewSectionId: 'highest-scoring-half',
    },
    {
      id: 'half-time-leader',
      kind: 'choice',
      messageId: 'half-time-leader',
      requiredQuestionIds: ['half-time-leader'],
      reviewSectionId: 'half-time-leader',
    },
  ];

export const activePredictionSteps = (
  ruleset: RulesetSnapshot,
): readonly PredictionSequenceStepDefinition[] =>
  standardPredictionStepDefinitions.filter((step) => {
    const allRequiredEnabled =
      step.requiredQuestionIds?.every((questionId) =>
        isBuiltInEnabled(ruleset, questionId),
      ) ?? true;
    const anyRequiredEnabled =
      step.requiredAnyQuestionIds === undefined ||
      step.requiredAnyQuestionIds.some((questionId) =>
        isBuiltInEnabled(ruleset, questionId),
      );

    return allRequiredEnabled && anyRequiredEnabled;
  });

export const predictionStepPosition = (
  activeSteps: readonly PredictionSequenceStepDefinition[],
  stepId: PredictionStepId,
): { readonly current: number; readonly total: number } | null => {
  const index = activeSteps.findIndex((step) => step.id === stepId);

  if (index === -1) {
    return null;
  }

  return {
    current: index + 1,
    total: activeSteps.length,
  };
};

export const firstPredictionStepId = (
  activeSteps: readonly PredictionSequenceStepDefinition[],
): PredictionStepId | null => activeSteps[0]?.id ?? null;

export const previousPredictionLocation = (
  activeSteps: readonly PredictionSequenceStepDefinition[],
  stepId: PredictionStepId,
): PredictionSequenceLocation => {
  const index = activeSteps.findIndex((step) => step.id === stepId);

  if (index <= 0) {
    return { kind: 'intro' };
  }

  return { kind: 'step', stepId: activeSteps[index - 1].id };
};

export const nextPredictionLocation = (
  activeSteps: readonly PredictionSequenceStepDefinition[],
  stepId: PredictionStepId,
): PredictionSequenceLocation => {
  const index = activeSteps.findIndex((step) => step.id === stepId);

  if (index === -1 || index === activeSteps.length - 1) {
    return { kind: 'review' };
  }

  return { kind: 'step', stepId: activeSteps[index + 1].id };
};

export const isFinalPredictionStep = (
  activeSteps: readonly PredictionSequenceStepDefinition[],
  stepId: PredictionStepId,
): boolean => nextPredictionLocation(activeSteps, stepId).kind === 'review';

export const isScoreKnownAtStep = (
  activeSteps: readonly PredictionSequenceStepDefinition[],
  stepId: PredictionStepId,
): boolean => {
  const currentIndex = activeSteps.findIndex((step) => step.id === stepId);
  const finalScoreStepIndex = Math.max(
    ...scoreProducingPredictionStepIds.map((scoreStepId) =>
      activeSteps.findIndex((step) => step.id === scoreStepId),
    ),
  );

  return currentIndex !== -1 && finalScoreStepIndex !== -1
    ? currentIndex >= finalScoreStepIndex
    : false;
};

export const editStepIdForReviewSection = (
  activeSteps: readonly PredictionSequenceStepDefinition[],
  reviewSectionId: PredictionReviewSectionId,
): PredictionStepId | null => {
  if (
    reviewSectionId === 'predicted-score' ||
    reviewSectionId === 'scoring-detail'
  ) {
    return (
      activeSteps.find((step) => step.id === 'tries')?.id ??
      activeSteps.find((step) =>
        scoreProducingPredictionStepIds.some(
          (scoreStepId) => scoreStepId === step.id,
        ),
      )?.id ??
      null
    );
  }

  return (
    activeSteps.find((step) => step.reviewSectionId === reviewSectionId)?.id ??
    null
  );
};
