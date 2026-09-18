import { describe, expect, it } from 'vitest';

import type { FixtureDocument } from '../../imports/shared/fixtures';
import {
  activePredictionSteps,
  type PredictionStepId,
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
import {
  formFromPrediction,
  emptyFormForRuleset,
} from '../../imports/ui/predictions/standardPredictionState';
import {
  createInitialPredictionSessionState,
  derivePredictionSessionState,
  predictionSessionKey,
  reducePredictionSessionState,
  type PredictionSessionLocalState,
  type PredictionSessionReducerContext,
} from '../../imports/ui/predictions/predictionSession';

const now = new Date('2026-09-17T10:00:00.000Z');

const customQuestionConfig = () => ({
  ...defaultFixturePredictionQuestionConfig(),
  customQuestions: [
    {
      answerType: 'number' as const,
      countingDefinition: 'Scrum penalties against Team 2.',
      deductionPerUnit: 25,
      id: 'scrum-pressure',
      max: 12,
      min: 0,
      order: 1,
      prompt: 'How many scrum penalties against Team 2?',
    },
    {
      answerType: 'choice' as const,
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

const fixtureForRuleset = (
  ruleset: RulesetSnapshot,
  fixtureId = 'fixture-1',
): FixtureDocument => ({
  _id: fixtureId,
  competitionDisplayName: 'Session Cup',
  createdAt: now,
  createdByAdminId: 'admin-1',
  isCancelled: false,
  publishedAt: now,
  publishedByAdminId: 'admin-1',
  revision: 1,
  rulesetSnapshot: ruleset,
  scheduledKickoffAt: new Date('2098-06-01T12:00:00.000Z'),
  team1DisplayName: 'Springboks',
  team2DisplayName: 'All Blacks',
  updatedAt: now,
  updatedByAdminId: 'admin-1',
  visibility: 'published',
});

const contextForRuleset = (
  ruleset: RulesetSnapshot,
  options: {
    readonly currentEntry?: PredictionSessionReducerContext['currentEntry'];
    readonly fixtureId?: string;
    readonly isReadOnly?: boolean;
    readonly userId?: string;
  } = {},
): PredictionSessionReducerContext => {
  const fixtureId = options.fixtureId ?? 'fixture-1';

  return {
    activeSteps: activePredictionSteps(ruleset),
    currentEntry: options.currentEntry ?? null,
    fixture: fixtureForRuleset(ruleset, fixtureId),
    fixtureId,
    isReadOnly: options.isReadOnly ?? false,
    ruleset,
    userId: options.userId ?? 'user-1',
  };
};

const initialSession = (
  context: PredictionSessionReducerContext,
  options: {
    readonly expectedRevision?: number | null;
    readonly form?: PredictionSessionLocalState['form'];
  } = {},
): PredictionSessionLocalState =>
  createInitialPredictionSessionState({
    activeSteps: context.activeSteps,
    fixtureId: context.fixtureId,
    initialExpectedRevision: options.expectedRevision ?? null,
    initialForm: options.form ?? emptyFormForRuleset(context.ruleset),
    random: () => 0.7,
    userId: context.userId,
  });

const reduce = (
  state: PredictionSessionLocalState,
  context: PredictionSessionReducerContext,
  action: Parameters<typeof reducePredictionSessionState>[1],
) => reducePredictionSessionState(state, action, context);

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

const predictionEntry = ({
  fixtureId = 'fixture-1',
  prediction,
  revision,
  ruleset,
  userId = 'user-1',
}: {
  readonly fixtureId?: string;
  readonly prediction: FixturePrediction;
  readonly revision: number;
  readonly ruleset: RulesetSnapshot;
  readonly userId?: string;
}) => ({
  _id: `prediction-${revision}`,
  createdAt: now,
  fixtureId,
  prediction,
  revision,
  ruleset: {
    id: ruleset.id,
    schemaVersion: ruleset.schemaVersion,
    version: ruleset.version,
  },
  updatedAt: now,
  userId,
});

describe('prediction session contract', () => {
  it('updates one shared answer state and preserves values through Back and Continue', () => {
    const context = contextForRuleset(defaultRuleset);
    let state = initialSession(context);
    const selectedVariants = state.messageSelection;

    state = reduce(state, context, { type: 'start-prediction' });
    expect(derivePredictionSessionState(state, context).location).toEqual({
      kind: 'step',
      stepId: 'match-result',
    });

    state = reduce(state, context, {
      field: 'matchResult',
      type: 'select-built-in-choice',
      value: 'team1',
    });
    state = reduce(state, context, { type: 'continue-forward' });
    state = reduce(state, context, {
      field: 'tries',
      side: 'team1',
      type: 'change-team-field',
      value: '4',
    });
    state = reduce(state, context, { type: 'continue-forward' });
    expect(state.location).toEqual({
      kind: 'step',
      stepId: 'conversions',
    });

    state = reduce(state, context, { type: 'go-back' });

    expect(state.location).toEqual({ kind: 'step', stepId: 'tries' });
    expect(state.form.matchResult).toBe('team1');
    expect(state.form.team1.tries).toBe('4');
    expect(state.messageSelection).toBe(selectedVariants);
  });

  it('keeps custom answers keyed by stable IDs and blocks blank Number answers without coercing them to zero', () => {
    const ruleset = buildConfiguredRulesetSnapshot(customQuestionConfig());
    const context = contextForRuleset(ruleset);
    let state = initialSession(context);
    const customStepId = 'custom:scrum-pressure' satisfies PredictionStepId;

    state = reduce(state, context, {
      stepId: customStepId,
      type: 'edit-step',
    });

    const blankView = derivePredictionSessionState(state, context);

    expect(blankView.currentStep?.validationMessage).toBe(
      'Enter a whole number from 0 to 12 to continue.',
    );
    expect(blankView.navigation.canContinue).toBe(false);
    expect(state.form.customAnswers['scrum-pressure']).toBe('');

    const blockedState = reduce(state, context, { type: 'continue-forward' });
    expect(blockedState.location).toEqual({
      kind: 'step',
      stepId: customStepId,
    });

    state = reduce(state, context, {
      questionId: 'scrum-pressure',
      type: 'change-custom-answer',
      value: '0',
    });
    state = reduce(state, context, {
      questionId: 'player-band',
      type: 'change-custom-answer',
      value: 'forwards',
    });

    const zeroView = derivePredictionSessionState(state, context);

    expect(zeroView.currentStep?.validationMessage).toBeNull();
    expect(zeroView.navigation.canContinue).toBe(true);
    expect(state.form.customAnswers).toMatchObject({
      'player-band': 'forwards',
      'scrum-pressure': '0',
    });
  });

  it('keeps command guards aligned with result consistency navigation', () => {
    const context = contextForRuleset(defaultRuleset);
    let state = initialSession(context);

    state = reduce(state, context, {
      field: 'matchResult',
      type: 'select-built-in-choice',
      value: 'team1',
    });
    state = reduce(state, context, {
      field: 'tries',
      side: 'team1',
      type: 'change-team-field',
      value: '1',
    });
    state = reduce(state, context, {
      field: 'conversions',
      side: 'team1',
      type: 'change-team-field',
      value: '1',
    });
    state = reduce(state, context, {
      field: 'tries',
      side: 'team2',
      type: 'change-team-field',
      value: '2',
    });
    state = reduce(state, context, {
      field: 'conversions',
      side: 'team2',
      type: 'change-team-field',
      value: '2',
    });
    state = reduce(state, context, {
      stepId: 'drop-goals',
      type: 'edit-step',
    });

    const inconsistentView = derivePredictionSessionState(state, context);
    const blocked = reduce(state, context, { type: 'continue-forward' });

    expect(inconsistentView.visibleConsistencyIssue?.selectedResult).toBe(
      'team1',
    );
    expect(inconsistentView.navigation.canContinue).toBe(false);
    expect(blocked.location).toEqual({
      kind: 'step',
      stepId: 'drop-goals',
    });

    state = reduce(state, context, {
      stepId: 'match-result',
      type: 'edit-step',
    });
    state = reduce(state, context, {
      field: 'matchResult',
      type: 'select-built-in-choice',
      value: 'team2',
    });

    expect(
      derivePredictionSessionState(state, context).consistencyIssue,
    ).toBeNull();
  });

  it('preserves answers, location, variants, and captured revision when the consumer is replaced', () => {
    const ruleset = buildConfiguredRulesetSnapshot(customQuestionConfig());
    const savedPrediction: FixturePrediction = {
      ...validPrediction(),
      customAnswers: {
        'player-band': 'backs',
        'scrum-pressure': 4,
      },
    };
    const entry = predictionEntry({
      prediction: savedPrediction,
      revision: 7,
      ruleset,
    });
    const context = contextForRuleset(ruleset, { currentEntry: entry });
    let state = initialSession(context, {
      expectedRevision: entry.revision,
      form: formFromPrediction(savedPrediction, ruleset),
    });
    const firstConsumer = derivePredictionSessionState(state, context);
    const selectedVariants = state.messageSelection;

    state = reduce(state, context, {
      stepId: 'custom:scrum-pressure',
      type: 'edit-step',
    });
    state = reduce(state, context, {
      questionId: 'scrum-pressure',
      type: 'change-custom-answer',
      value: '6',
    });
    state = reduce(state, context, { type: 'return-to-review' });

    const replacementConsumer = derivePredictionSessionState(state, context);

    expect(firstConsumer.location).toEqual({ kind: 'review' });
    expect(replacementConsumer.location).toEqual({ kind: 'review' });
    expect(replacementConsumer.form.customAnswers['scrum-pressure']).toBe('6');
    expect(replacementConsumer.form.customAnswers['player-band']).toBe('backs');
    expect(replacementConsumer.messageSelection).toBe(selectedVariants);
    expect(replacementConsumer.editSession.expectedRevision).toBe(7);
  });

  it('does not let reactive revision changes overwrite dirty answers or captured revision until explicit reload', () => {
    const originalPrediction = validPrediction();
    const latestPrediction: FixturePrediction = {
      ...validPrediction(),
      halfTimeLeader: 'draw',
      team1: {
        ...validPrediction().team1,
        tries: 1,
      },
    };
    const originalEntry = predictionEntry({
      prediction: originalPrediction,
      revision: 1,
      ruleset: defaultRuleset,
    });
    const latestEntry = predictionEntry({
      prediction: latestPrediction,
      revision: 2,
      ruleset: defaultRuleset,
    });
    const originalContext = contextForRuleset(defaultRuleset, {
      currentEntry: originalEntry,
    });
    const latestContext = contextForRuleset(defaultRuleset, {
      currentEntry: latestEntry,
    });
    let state = initialSession(originalContext, {
      expectedRevision: 1,
      form: formFromPrediction(originalPrediction, defaultRuleset),
    });

    state = reduce(state, originalContext, {
      stepId: 'tries',
      type: 'edit-step',
    });
    state = reduce(state, originalContext, {
      field: 'tries',
      side: 'team1',
      type: 'change-team-field',
      value: '5',
    });

    const reactiveView = derivePredictionSessionState(state, latestContext);

    expect(reactiveView.form.team1.tries).toBe('5');
    expect(reactiveView.editSession.expectedRevision).toBe(1);
    expect(reactiveView.savedEntryChanged).toBe(true);

    state = reduce(state, latestContext, {
      type: 'load-latest-saved-prediction',
    });

    expect(state.form.team1.tries).toBe('1');
    expect(state.editSession.expectedRevision).toBe(2);
  });

  it('guards duplicate submit state and ignores stale async responses for another session key', () => {
    const context = contextForRuleset(defaultRuleset);
    let state = initialSession(context);
    const currentKey = predictionSessionKey({
      fixtureId: context.fixtureId,
      userId: context.userId,
    });

    state = reduce(state, context, {
      sessionKey: currentKey,
      type: 'submit-start',
    });
    state = reduce(state, context, {
      sessionKey: currentKey,
      type: 'submit-start',
    });

    expect(state.isSubmitting).toBe(true);

    const stale = reduce(state, context, {
      result: {
        fixtureId: 'fixture-old',
        predictionId: 'prediction-old',
        revision: 99,
        status: 'updated',
      },
      sessionKey: 'user-old:fixture-old',
      type: 'submit-success',
    });

    expect(stale.editSession.expectedRevision).toBeNull();
    expect(stale.isSubmitting).toBe(true);

    const accepted = reduce(stale, context, {
      result: {
        fixtureId: context.fixtureId,
        predictionId: 'prediction-1',
        revision: 1,
        status: 'created',
      },
      sessionKey: currentKey,
      type: 'submit-success',
    });

    expect(accepted.editSession.expectedRevision).toBe(1);
    expect(accepted.feedback?.message).toBe('Prediction saved.');
  });

  it('keeps read-only availability and direct edit commands aligned', () => {
    const ruleset = buildConfiguredRulesetSnapshot(customQuestionConfig());
    const savedPrediction: FixturePrediction = {
      ...validPrediction(),
      customAnswers: {
        'player-band': 'backs',
        'scrum-pressure': 4,
      },
    };
    const entry = predictionEntry({
      prediction: savedPrediction,
      revision: 3,
      ruleset,
    });
    const context = contextForRuleset(ruleset, {
      currentEntry: entry,
      isReadOnly: true,
    });
    const state = initialSession(context, {
      expectedRevision: entry.revision,
      form: formFromPrediction(savedPrediction, ruleset),
    });
    const view = derivePredictionSessionState(state, context);

    expect(view.navigation.canContinue).toBe(false);
    expect(view.navigation.canGoBack).toBe(false);
    expect(view.navigation.canRequestDiscard).toBe(false);
    expect(view.navigation.canReturnToReview).toBe(false);
    expect(view.navigation.canSubmit).toBe(false);

    expect(
      reduce(state, context, {
        field: 'matchResult',
        type: 'select-built-in-choice',
        value: 'team2',
      }),
    ).toEqual(state);
    expect(
      reduce(state, context, {
        field: 'tries',
        side: 'team1',
        type: 'change-team-field',
        value: '8',
      }),
    ).toEqual(state);
    expect(
      reduce(state, context, {
        questionId: 'scrum-pressure',
        type: 'change-custom-answer',
        value: '9',
      }),
    ).toEqual(state);
    expect(
      reduce(state, context, {
        stepId: 'match-result',
        type: 'edit-step',
      }),
    ).toEqual(state);
    expect(reduce(state, context, { type: 'go-back' })).toEqual(state);
    expect(reduce(state, context, { type: 'request-discard' })).toEqual(state);
    expect(
      reduce(state, context, { type: 'load-latest-saved-prediction' }),
    ).toEqual(state);

    const introState = initialSession(context, {
      expectedRevision: null,
    });

    expect(
      derivePredictionSessionState(introState, context).navigation.canContinue,
    ).toBe(false);
    expect(reduce(introState, context, { type: 'start-prediction' })).toEqual(
      introState,
    );
    expect(reduce(introState, context, { type: 'continue-forward' })).toEqual(
      introState,
    );
  });

  it('blocks discard and latest-load replacement while a save is in flight', () => {
    const originalPrediction = validPrediction();
    const latestPrediction: FixturePrediction = {
      ...validPrediction(),
      halfTimeLeader: 'draw',
      team1: {
        ...validPrediction().team1,
        tries: 1,
      },
    };
    const originalEntry = predictionEntry({
      prediction: originalPrediction,
      revision: 1,
      ruleset: defaultRuleset,
    });
    const latestEntry = predictionEntry({
      prediction: latestPrediction,
      revision: 2,
      ruleset: defaultRuleset,
    });
    const originalContext = contextForRuleset(defaultRuleset, {
      currentEntry: originalEntry,
    });
    const latestContext = contextForRuleset(defaultRuleset, {
      currentEntry: latestEntry,
    });
    let state = initialSession(originalContext, {
      expectedRevision: 1,
      form: formFromPrediction(originalPrediction, defaultRuleset),
    });

    state = reduce(state, originalContext, {
      stepId: 'tries',
      type: 'edit-step',
    });
    state = reduce(state, originalContext, {
      field: 'tries',
      side: 'team1',
      type: 'change-team-field',
      value: '5',
    });
    state = {
      ...state,
      feedback: {
        code: 'prediction-conflict',
        kind: 'error',
        message: 'Conflict.',
      },
      isDiscardConfirmOpen: true,
      isSubmitting: true,
    };

    const pendingView = derivePredictionSessionState(state, latestContext);

    expect(pendingView.navigation.canRequestDiscard).toBe(false);
    expect(pendingView.isDiscardConfirmOpen).toBe(false);
    expect(reduce(state, latestContext, { type: 'request-discard' })).toEqual(
      state,
    );
    expect(
      reduce(state, latestContext, { type: 'load-latest-saved-prediction' }),
    ).toEqual(state);

    const cancelled = reduce(state, latestContext, { type: 'cancel-discard' });

    expect(cancelled.isDiscardConfirmOpen).toBe(false);
    expect(cancelled.form.team1.tries).toBe('5');
    expect(cancelled.editSession.expectedRevision).toBe(1);

    state = {
      ...state,
      isDiscardConfirmOpen: false,
      isSubmitting: false,
    };

    const conflictRecovered = reduce(state, latestContext, {
      type: 'request-discard',
    });

    expect(conflictRecovered.form.team1.tries).toBe('1');
    expect(conflictRecovered.editSession.expectedRevision).toBe(2);
    expect(conflictRecovered.feedback?.message).toBe(
      'Latest saved prediction loaded. Unsaved values were replaced.',
    );

    state = {
      ...state,
      feedback: null,
    };

    const requested = reduce(state, latestContext, { type: 'request-discard' });
    expect(requested.isDiscardConfirmOpen).toBe(true);

    const confirmed = reduce(requested, latestContext, {
      type: 'load-latest-saved-prediction',
    });

    expect(confirmed.form.team1.tries).toBe('1');
    expect(confirmed.editSession.expectedRevision).toBe(2);
  });

  it('allows internal submit completion for the same session after context becomes read-only', () => {
    const editableContext = contextForRuleset(defaultRuleset);
    const readOnlyContext = {
      ...editableContext,
      isReadOnly: true,
    };
    const sessionKey = predictionSessionKey({
      fixtureId: editableContext.fixtureId,
      userId: editableContext.userId,
    });
    let state = initialSession(editableContext, {
      form: formFromPrediction(validPrediction(), defaultRuleset),
    });

    state = {
      ...state,
      location: { kind: 'review' },
    };
    state = reduce(state, editableContext, {
      sessionKey,
      type: 'submit-start',
    });

    expect(state.isSubmitting).toBe(true);

    state = reduce(state, readOnlyContext, {
      result: {
        fixtureId: editableContext.fixtureId,
        predictionId: 'prediction-1',
        revision: 4,
        status: 'created',
      },
      sessionKey,
      type: 'submit-success',
    });
    state = reduce(state, readOnlyContext, {
      sessionKey,
      type: 'submit-finish',
    });

    expect(state.editSession.expectedRevision).toBe(4);
    expect(state.feedback?.message).toBe('Prediction saved.');
    expect(state.isSubmitting).toBe(false);
    expect(
      derivePredictionSessionState(state, readOnlyContext).isReadOnly,
    ).toBe(true);
  });
});
