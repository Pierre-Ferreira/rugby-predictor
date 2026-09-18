import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import type { FixtureDocument } from '/imports/shared/fixtures';
import {
  activePredictionSteps,
  customChoiceDeductionText,
  customNumberDeductionText,
  firstPredictionStepId,
  isBuiltInPredictionStep,
  isCustomPredictionStep,
  isFinalPredictionStep,
  isScoreKnownAtStep,
  nextPredictionLocation,
  previousPredictionLocation,
  resolvePredictionStepMessage,
  selectPredictionMessageVariants,
  PREDICTION_METHODS,
  type PredictionEntryDocument,
  type PredictionMessageVariantSelection,
  type PredictionMutationResult,
  type PredictionSequenceLocation,
  type PredictionSequenceStepDefinition,
  type PredictionStepId,
  type ResolvedPredictionStepMessage,
} from '/imports/shared/predictions';
import {
  isBuiltInEnabled,
  type RulesetSnapshot,
  type TeamSide,
} from '/imports/shared/scoring';
import {
  buildPredictionPayload,
  customQuestionById,
  customStepValidationMessage,
  deriveScoresFromForm,
  emptyFormForRuleset,
  enforceFirstTryConsistency,
  formFromPrediction,
  normalizeInitialPredictionForm,
  predictionFormsEqual,
  resultConsistencyIssue,
  setTeamPredictionField,
  type ActiveCustomQuestion,
  type PredictionFormState,
  type ScoreReview,
  type TeamPredictionForm,
} from './standardPredictionState';

export type PredictionChoiceFieldName =
  'firstTry' | 'halfTimeLeader' | 'highestScoringHalf' | 'matchResult';

export interface PredictionEditSession {
  readonly expectedRevision: number | null;
  readonly fixtureId: string;
  readonly userId: string;
}

export interface PredictionSessionIdentity {
  readonly fixtureId: string;
  readonly userId: string;
}

export interface PredictionSessionFeedback {
  readonly code?: string;
  readonly kind: 'error' | 'success';
  readonly message: string;
}

export interface PredictionSessionCurrentStep {
  readonly customQuestion: ActiveCustomQuestion | null;
  readonly message: ResolvedPredictionStepMessage;
  readonly position: { readonly current: number; readonly total: number };
  readonly step: PredictionSequenceStepDefinition;
  readonly validationMessage: string | null;
}

export interface PredictionSessionNavigationState {
  readonly canContinue: boolean;
  readonly canGoBack: boolean;
  readonly canRequestDiscard: boolean;
  readonly canReturnToReview: boolean;
  readonly canSubmit: boolean;
  readonly continueLabel: string;
}

export interface PredictionSessionRendererState {
  readonly activeSteps: readonly PredictionSequenceStepDefinition[];
  readonly consistencyIssue: ReturnType<typeof resultConsistencyIssue>;
  readonly conversionAdjustmentNotice: string | null;
  readonly currentEntry: PredictionEntryDocument | null | undefined;
  readonly currentStep: PredictionSessionCurrentStep | null;
  readonly editSession: PredictionEditSession;
  readonly feedback: PredictionSessionFeedback | null;
  readonly fixture: FixtureDocument;
  readonly form: PredictionFormState;
  readonly hasUnsavedChanges: boolean;
  readonly isDiscardConfirmOpen: boolean;
  readonly isEditingFromReview: boolean;
  readonly isPredictionConflict: boolean;
  readonly isReadOnly: boolean;
  readonly isSubmitting: boolean;
  readonly location: PredictionSequenceLocation;
  readonly messageSelection: PredictionMessageVariantSelection;
  readonly navigation: PredictionSessionNavigationState;
  readonly persistedForm: PredictionFormState;
  readonly ruleset: RulesetSnapshot;
  readonly savedEntryChanged: boolean;
  readonly scoreReview: ScoreReview;
  readonly visibleConsistencyIssue: ReturnType<typeof resultConsistencyIssue>;
}

export interface PredictionSessionActions {
  readonly cancelDiscardChanges: () => void;
  readonly changeCustomAnswer: (questionId: string, value: string) => void;
  readonly changeTeamNumericField: (
    side: TeamSide,
    field: keyof TeamPredictionForm,
    value: string,
  ) => void;
  readonly confirmDiscardChanges: () => void;
  readonly continueForward: () => void;
  readonly editStep: (stepId: PredictionStepId) => void;
  readonly goBack: () => void;
  readonly loadLatestSavedPrediction: () => void;
  readonly requestDiscardChanges: () => void;
  readonly returnToReview: () => void;
  readonly selectBuiltInChoice: (
    field: PredictionChoiceFieldName,
    value: string,
  ) => void;
  readonly startPrediction: () => void;
  readonly submitPrediction: () => Promise<void>;
}

export interface PredictionSessionContract {
  readonly actions: PredictionSessionActions;
  readonly state: PredictionSessionRendererState;
}

export interface PredictionSessionInput {
  readonly currentEntry: PredictionEntryDocument | null | undefined;
  readonly fixture: FixtureDocument;
  readonly fixtureId: string;
  readonly initialExpectedRevision: number | null;
  readonly initialForm: PredictionFormState;
  readonly isReadOnly: boolean;
  readonly ruleset: RulesetSnapshot;
  readonly submitPredictionMethod?: PredictionMethodCaller;
  readonly userId: string;
}

export interface PredictionSessionLocalState {
  readonly conversionAdjustmentNotice: string | null;
  readonly editSession: PredictionEditSession;
  readonly feedback: PredictionSessionFeedback | null;
  readonly form: PredictionFormState;
  readonly isDiscardConfirmOpen: boolean;
  readonly isEditingFromReview: boolean;
  readonly isSubmitting: boolean;
  readonly location: PredictionSequenceLocation;
  readonly messageSelection: PredictionMessageVariantSelection;
  readonly persistedForm: PredictionFormState;
  readonly sessionKey: string;
}

export interface PredictionSessionReducerContext {
  readonly activeSteps: readonly PredictionSequenceStepDefinition[];
  readonly currentEntry: PredictionEntryDocument | null | undefined;
  readonly fixture: FixtureDocument;
  readonly fixtureId: string;
  readonly isReadOnly: boolean;
  readonly ruleset: RulesetSnapshot;
  readonly userId: string;
}

export type PredictionSessionAction =
  | { readonly type: 'adopt-arrived-saved-entry' }
  | { readonly type: 'cancel-discard' }
  | {
      readonly field: PredictionChoiceFieldName;
      readonly type: 'select-built-in-choice';
      readonly value: string;
    }
  | {
      readonly questionId: string;
      readonly type: 'change-custom-answer';
      readonly value: string;
    }
  | {
      readonly field: keyof TeamPredictionForm;
      readonly side: TeamSide;
      readonly type: 'change-team-field';
      readonly value: string;
    }
  | { readonly type: 'continue-forward' }
  | { readonly stepId: PredictionStepId; readonly type: 'edit-step' }
  | { readonly type: 'go-back' }
  | { readonly type: 'load-latest-saved-prediction' }
  | { readonly type: 'request-discard' }
  | { readonly type: 'return-to-review' }
  | { readonly type: 'start-prediction' }
  | { readonly sessionKey: string; readonly type: 'submit-finish' }
  | {
      readonly feedback: PredictionSessionFeedback;
      readonly sessionKey: string;
      readonly type: 'submit-error';
    }
  | { readonly sessionKey: string; readonly type: 'submit-start' }
  | {
      readonly result: PredictionMutationResult;
      readonly sessionKey: string;
      readonly type: 'submit-success';
    };

export type PredictionMethodCaller = <TResult>(
  methodName: string,
  input: unknown,
) => Promise<TResult>;

export const predictionSessionKey = ({
  fixtureId,
  userId,
}: PredictionSessionIdentity): string => `${userId}:${fixtureId}`;

export const persistedPredictionForm = (
  entry: PredictionEntryDocument | null | undefined,
  ruleset: RulesetSnapshot,
): PredictionFormState =>
  normalizeInitialPredictionForm(
    entry
      ? formFromPrediction(entry.prediction, ruleset)
      : emptyFormForRuleset(ruleset),
    ruleset,
  );

const builtInMessageIds = (
  activeSteps: readonly PredictionSequenceStepDefinition[],
) => activeSteps.filter(isBuiltInPredictionStep).map((step) => step.messageId);

export const createInitialPredictionSessionState = ({
  activeSteps,
  fixtureId,
  initialExpectedRevision,
  initialForm,
  random = Math.random,
  userId,
}: {
  readonly activeSteps: readonly PredictionSequenceStepDefinition[];
  readonly fixtureId: string;
  readonly initialExpectedRevision: number | null;
  readonly initialForm: PredictionFormState;
  readonly random?: () => number;
  readonly userId: string;
}): PredictionSessionLocalState => ({
  conversionAdjustmentNotice: null,
  editSession: {
    expectedRevision: initialExpectedRevision,
    fixtureId,
    userId,
  },
  feedback: null,
  form: initialForm,
  isDiscardConfirmOpen: false,
  isEditingFromReview: false,
  isSubmitting: false,
  location:
    initialExpectedRevision === null ? { kind: 'intro' } : { kind: 'review' },
  messageSelection: selectPredictionMessageVariants(
    builtInMessageIds(activeSteps),
    random,
  ),
  persistedForm: initialForm,
  sessionKey: predictionSessionKey({ fixtureId, userId }),
});

const messageForCurrentStep = (
  step: PredictionSequenceStepDefinition,
  selection: PredictionMessageVariantSelection,
  context: PredictionSessionReducerContext,
  customQuestion: ActiveCustomQuestion | null,
): ResolvedPredictionStepMessage => {
  if (isBuiltInPredictionStep(step)) {
    return resolvePredictionStepMessage(step.messageId, selection, {
      ruleset: context.ruleset,
      team1Name: context.fixture.team1DisplayName,
      team2Name: context.fixture.team2DisplayName,
    });
  }

  return {
    body: customQuestion?.banter ?? null,
    deduction:
      customQuestion?.type === 'custom-numeric'
        ? customNumberDeductionText(customQuestion)
        : customQuestion
          ? customChoiceDeductionText(customQuestion)
          : null,
    heading: customQuestion?.prompt ?? '',
    supportingText: [],
  };
};

const currentStepState = (
  state: PredictionSessionLocalState,
  context: PredictionSessionReducerContext,
): PredictionSessionCurrentStep | null => {
  if (state.location.kind !== 'step') {
    return null;
  }

  const stepId = state.location.stepId;
  const index = context.activeSteps.findIndex((step) => step.id === stepId);

  if (index === -1) {
    return null;
  }

  const step = context.activeSteps[index];
  const customQuestion = isCustomPredictionStep(step)
    ? customQuestionById(context.ruleset, step.questionId)
    : null;
  const validationMessage = customQuestion
    ? customStepValidationMessage(
        customQuestion,
        state.form.customAnswers[customQuestion.id] ?? '',
      )
    : null;

  return {
    customQuestion,
    message: messageForCurrentStep(
      step,
      state.messageSelection,
      context,
      customQuestion,
    ),
    position: {
      current: index + 1,
      total: context.activeSteps.length,
    },
    step,
    validationMessage,
  };
};

const goToLocation = (
  state: PredictionSessionLocalState,
  location: PredictionSequenceLocation,
): PredictionSessionLocalState => ({
  ...state,
  isDiscardConfirmOpen: false,
  isEditingFromReview:
    location.kind === 'step' ? state.isEditingFromReview : false,
  location,
});

const loadLatestSavedPredictionState = (
  state: PredictionSessionLocalState,
  context: PredictionSessionReducerContext,
): PredictionSessionLocalState => {
  if (context.isReadOnly || state.isSubmitting) {
    return state;
  }

  const persistedForm = persistedPredictionForm(
    context.currentEntry,
    context.ruleset,
  );

  return {
    ...state,
    conversionAdjustmentNotice: null,
    editSession: {
      expectedRevision: context.currentEntry?.revision ?? null,
      fixtureId: context.fixtureId,
      userId: context.userId,
    },
    feedback: {
      kind: 'success',
      message: context.currentEntry
        ? 'Latest saved prediction loaded. Unsaved values were replaced.'
        : 'Blank prediction form loaded. Unsaved values were replaced.',
    },
    form: persistedForm,
    isDiscardConfirmOpen: false,
    isEditingFromReview: false,
    location: context.currentEntry ? { kind: 'review' } : { kind: 'intro' },
    persistedForm,
  };
};

const adoptArrivedSavedEntryState = (
  state: PredictionSessionLocalState,
  context: PredictionSessionReducerContext,
): PredictionSessionLocalState => {
  const currentEntry = context.currentEntry;
  const hasUntouchedBlankForm =
    predictionFormsEqual(state.form, emptyFormForRuleset(context.ruleset)) ||
    predictionFormsEqual(
      state.form,
      persistedPredictionForm(null, context.ruleset),
    );

  if (!currentEntry || state.editSession.expectedRevision !== null) {
    return state;
  }

  if (
    state.location.kind !== 'intro' ||
    state.isSubmitting ||
    state.isEditingFromReview ||
    state.isDiscardConfirmOpen ||
    state.feedback ||
    !hasUntouchedBlankForm
  ) {
    return state;
  }

  const persistedForm = persistedPredictionForm(currentEntry, context.ruleset);

  return {
    ...state,
    conversionAdjustmentNotice: null,
    editSession: {
      expectedRevision: currentEntry.revision,
      fixtureId: context.fixtureId,
      userId: context.userId,
    },
    form: persistedForm,
    location: { kind: 'review' },
    persistedForm,
  };
};

export const derivePredictionSessionState = (
  state: PredictionSessionLocalState,
  context: PredictionSessionReducerContext,
): PredictionSessionRendererState => {
  const persistedForm = context.currentEntry
    ? persistedPredictionForm(context.currentEntry, context.ruleset)
    : state.persistedForm;
  const hasUnsavedChanges = !predictionFormsEqual(state.form, persistedForm);
  const isPredictionConflict = state.feedback?.code === 'prediction-conflict';
  const savedEntryChanged = Boolean(
    context.currentEntry &&
    state.editSession.expectedRevision !== null &&
    context.currentEntry.revision !== state.editSession.expectedRevision,
  );
  const consistencyIssue = isBuiltInEnabled(context.ruleset, 'match-result')
    ? resultConsistencyIssue(state.form, context.fixture)
    : null;
  const visibleConsistencyIssue =
    consistencyIssue !== null &&
    (state.location.kind === 'review' ||
      (state.location.kind === 'step' &&
        isScoreKnownAtStep(context.activeSteps, state.location.stepId)))
      ? consistencyIssue
      : null;
  const currentStep = currentStepState(state, context);
  const canContinue =
    !context.isReadOnly &&
    (state.location.kind === 'intro'
      ? true
      : state.location.kind === 'step'
        ? visibleConsistencyIssue === null &&
          currentStep?.validationMessage === null
        : false);
  const continueLabel =
    currentStep &&
    isFinalPredictionStep(context.activeSteps, currentStep.step.id)
      ? 'Review predictions'
      : 'Continue';
  const canSubmit =
    !context.isReadOnly &&
    state.location.kind === 'review' &&
    !state.isSubmitting &&
    consistencyIssue === null;

  return {
    activeSteps: context.activeSteps,
    consistencyIssue,
    conversionAdjustmentNotice: state.conversionAdjustmentNotice,
    currentEntry: context.currentEntry,
    currentStep,
    editSession: state.editSession,
    feedback: state.feedback,
    fixture: context.fixture,
    form: state.form,
    hasUnsavedChanges,
    isDiscardConfirmOpen:
      state.isDiscardConfirmOpen &&
      !context.isReadOnly &&
      !state.isSubmitting &&
      hasUnsavedChanges,
    isEditingFromReview: state.isEditingFromReview,
    isPredictionConflict,
    isReadOnly: context.isReadOnly,
    isSubmitting: state.isSubmitting,
    location: state.location,
    messageSelection: state.messageSelection,
    navigation: {
      canContinue,
      canGoBack: !context.isReadOnly && state.location.kind !== 'intro',
      canRequestDiscard:
        !context.isReadOnly &&
        !state.isSubmitting &&
        (isPredictionConflict || hasUnsavedChanges),
      canReturnToReview:
        !context.isReadOnly &&
        state.location.kind === 'step' &&
        state.isEditingFromReview &&
        canContinue,
      canSubmit,
      continueLabel,
    },
    persistedForm,
    ruleset: context.ruleset,
    savedEntryChanged,
    scoreReview: deriveScoresFromForm(state.form, context.fixture),
    visibleConsistencyIssue,
  };
};

export const reducePredictionSessionState = (
  state: PredictionSessionLocalState,
  action: PredictionSessionAction,
  context: PredictionSessionReducerContext,
): PredictionSessionLocalState => {
  if ('sessionKey' in action && action.sessionKey !== state.sessionKey) {
    return state;
  }

  switch (action.type) {
    case 'adopt-arrived-saved-entry':
      return adoptArrivedSavedEntryState(state, context);

    case 'cancel-discard':
      return {
        ...state,
        isDiscardConfirmOpen: false,
      };

    case 'change-custom-answer':
      if (context.isReadOnly) {
        return state;
      }

      if (!customQuestionById(context.ruleset, action.questionId)) {
        return state;
      }

      return {
        ...state,
        form: {
          ...state.form,
          customAnswers: {
            ...state.form.customAnswers,
            [action.questionId]: action.value,
          },
        },
        isDiscardConfirmOpen: false,
      };

    case 'change-team-field': {
      if (context.isReadOnly) {
        return state;
      }

      const result = setTeamPredictionField(
        state.form,
        action.side,
        action.field,
        action.value,
      );

      return {
        ...state,
        conversionAdjustmentNotice: result.conversionsAdjusted
          ? 'Conversions adjusted to match your predicted tries.'
          : null,
        form: result.form,
        isDiscardConfirmOpen: false,
      };
    }

    case 'continue-forward': {
      if (context.isReadOnly) {
        return state;
      }

      const derived = derivePredictionSessionState(state, context);

      if (state.location.kind === 'intro') {
        const firstStepId = firstPredictionStepId(context.activeSteps);

        return {
          ...state,
          isDiscardConfirmOpen: false,
          isEditingFromReview: false,
          location: firstStepId
            ? { kind: 'step', stepId: firstStepId }
            : { kind: 'review' },
        };
      }

      if (state.location.kind !== 'step' || !derived.navigation.canContinue) {
        return state;
      }

      return goToLocation(
        state,
        nextPredictionLocation(context.activeSteps, state.location.stepId),
      );
    }

    case 'edit-step':
      if (context.isReadOnly) {
        return state;
      }

      if (!context.activeSteps.some((step) => step.id === action.stepId)) {
        return state;
      }

      return {
        ...state,
        isDiscardConfirmOpen: false,
        isEditingFromReview:
          state.isEditingFromReview || state.location.kind === 'review',
        location: { kind: 'step', stepId: action.stepId },
      };

    case 'go-back':
      if (context.isReadOnly) {
        return state;
      }

      if (state.location.kind === 'step') {
        return goToLocation(
          state,
          previousPredictionLocation(
            context.activeSteps,
            state.location.stepId,
          ),
        );
      }

      if (state.location.kind === 'review') {
        const finalStep = context.activeSteps[context.activeSteps.length - 1];

        return goToLocation(
          state,
          finalStep
            ? { kind: 'step', stepId: finalStep.id }
            : { kind: 'intro' },
        );
      }

      return state;

    case 'load-latest-saved-prediction':
      return loadLatestSavedPredictionState(state, context);

    case 'request-discard': {
      const derived = derivePredictionSessionState(state, context);

      if (!derived.navigation.canRequestDiscard) {
        return state;
      }

      if (derived.isPredictionConflict) {
        return loadLatestSavedPredictionState(state, context);
      }

      if (!derived.hasUnsavedChanges) {
        return state;
      }

      return {
        ...state,
        isDiscardConfirmOpen: true,
      };
    }

    case 'return-to-review': {
      const derived = derivePredictionSessionState(state, context);

      if (!derived.navigation.canReturnToReview) {
        return state;
      }

      return {
        ...state,
        isDiscardConfirmOpen: false,
        isEditingFromReview: false,
        location: { kind: 'review' },
      };
    }

    case 'select-built-in-choice': {
      if (context.isReadOnly) {
        return state;
      }

      const next = {
        ...state.form,
        [action.field]: action.value,
      };

      return {
        ...state,
        form:
          action.field === 'firstTry'
            ? enforceFirstTryConsistency(next).form
            : next,
        isDiscardConfirmOpen: false,
      };
    }

    case 'start-prediction': {
      if (context.isReadOnly) {
        return state;
      }

      const firstStepId = firstPredictionStepId(context.activeSteps);

      return {
        ...state,
        isDiscardConfirmOpen: false,
        isEditingFromReview: false,
        location: firstStepId
          ? { kind: 'step', stepId: firstStepId }
          : { kind: 'review' },
      };
    }

    case 'submit-error':
      return {
        ...state,
        feedback: action.feedback,
      };

    case 'submit-finish':
      return {
        ...state,
        isSubmitting: false,
      };

    case 'submit-start':
      if (state.isSubmitting) {
        return state;
      }

      return {
        ...state,
        feedback: null,
        isSubmitting: true,
      };

    case 'submit-success':
      return {
        ...state,
        editSession: {
          expectedRevision: action.result.revision,
          fixtureId: context.fixtureId,
          userId: context.userId,
        },
        feedback: {
          kind: 'success',
          message:
            action.result.status === 'created'
              ? 'Prediction saved.'
              : 'Prediction updated.',
        },
        isDiscardConfirmOpen: false,
        location: { kind: 'review' },
        persistedForm: state.form,
      };
  }
};

const messageFromError = (error: unknown): string => {
  if (error && typeof error === 'object') {
    const record = error as {
      readonly message?: unknown;
      readonly reason?: unknown;
    };

    if (typeof record.reason === 'string') {
      return record.reason;
    }

    if (typeof record.message === 'string') {
      return record.message;
    }
  }

  return 'The prediction could not be saved.';
};

const codeFromError = (error: unknown): string | undefined =>
  error && typeof error === 'object'
    ? String((error as { readonly error?: unknown }).error ?? '')
    : undefined;

const callPredictionMethod: PredictionMethodCaller = async <TResult>(
  methodName: string,
  input: unknown,
): Promise<TResult> => {
  const { callMeteorMethod } = await import('../auth/methodCall');

  return callMeteorMethod<TResult>(methodName, input);
};

export const usePredictionSession = (
  input: PredictionSessionInput,
): PredictionSessionContract => {
  const activeSteps = useMemo(
    () => activePredictionSteps(input.ruleset),
    [input.ruleset],
  );
  const context = useMemo<PredictionSessionReducerContext>(
    () => ({
      activeSteps,
      currentEntry: input.currentEntry,
      fixture: input.fixture,
      fixtureId: input.fixtureId,
      isReadOnly: input.isReadOnly,
      ruleset: input.ruleset,
      userId: input.userId,
    }),
    [
      activeSteps,
      input.currentEntry,
      input.fixture,
      input.fixtureId,
      input.isReadOnly,
      input.ruleset,
      input.userId,
    ],
  );
  const contextRef = useRef(context);

  const [localState, dispatch] = useReducer(
    (current: PredictionSessionLocalState, action: PredictionSessionAction) =>
      reducePredictionSessionState(current, action, context),
    undefined,
    () =>
      createInitialPredictionSessionState({
        activeSteps,
        fixtureId: input.fixtureId,
        initialExpectedRevision: input.initialExpectedRevision,
        initialForm: input.initialForm,
        userId: input.userId,
      }),
  );
  const localStateRef = useRef(localState);
  const isMountedRef = useRef(true);
  const methodCallerRef = useRef<PredictionMethodCaller>(
    input.submitPredictionMethod ?? callPredictionMethod,
  );
  const submitInFlightRef = useRef(false);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    localStateRef.current = localState;
  }, [localState]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    methodCallerRef.current =
      input.submitPredictionMethod ?? callPredictionMethod;
  }, [input.submitPredictionMethod]);

  useEffect(() => {
    if (input.currentEntry) {
      dispatch({ type: 'adopt-arrived-saved-entry' });
    }
  }, [input.currentEntry]);

  const state = useMemo(
    () => derivePredictionSessionState(localState, context),
    [context, localState],
  );

  const submitPrediction = useCallback(async () => {
    const latestState = localStateRef.current;
    const latestContext = contextRef.current;
    const latestDerived = derivePredictionSessionState(
      latestState,
      latestContext,
    );

    if (
      latestContext.isReadOnly ||
      latestState.location.kind !== 'review' ||
      submitInFlightRef.current
    ) {
      return;
    }

    if (latestDerived.consistencyIssue) {
      dispatch({
        feedback: {
          kind: 'error',
          message:
            "Your scores don't match your chosen winner. Adjust the result or scoring predictions before submitting.",
        },
        sessionKey: latestState.sessionKey,
        type: 'submit-error',
      });
      return;
    }

    submitInFlightRef.current = true;
    dispatch({
      sessionKey: latestState.sessionKey,
      type: 'submit-start',
    });

    try {
      const prediction = buildPredictionPayload(
        latestState.form,
        latestContext.ruleset,
        latestContext.fixture,
      );
      const result = await methodCallerRef.current<PredictionMutationResult>(
        PREDICTION_METHODS.submit,
        {
          ...(latestState.editSession.expectedRevision === null
            ? {}
            : { expectedRevision: latestState.editSession.expectedRevision }),
          fixtureId: latestContext.fixtureId,
          prediction,
        },
      );

      if (
        isMountedRef.current &&
        localStateRef.current.sessionKey === latestState.sessionKey
      ) {
        dispatch({
          result,
          sessionKey: latestState.sessionKey,
          type: 'submit-success',
        });
      }
    } catch (error) {
      if (
        isMountedRef.current &&
        localStateRef.current.sessionKey === latestState.sessionKey
      ) {
        dispatch({
          feedback: {
            code: codeFromError(error),
            kind: 'error',
            message: messageFromError(error),
          },
          sessionKey: latestState.sessionKey,
          type: 'submit-error',
        });
      }
    } finally {
      submitInFlightRef.current = false;

      if (
        isMountedRef.current &&
        localStateRef.current.sessionKey === latestState.sessionKey
      ) {
        dispatch({
          sessionKey: latestState.sessionKey,
          type: 'submit-finish',
        });
      }
    }
  }, []);

  const actions = useMemo<PredictionSessionActions>(
    () => ({
      cancelDiscardChanges: () => dispatch({ type: 'cancel-discard' }),
      changeCustomAnswer: (questionId, value) =>
        dispatch({
          questionId,
          type: 'change-custom-answer',
          value,
        }),
      changeTeamNumericField: (side, field, value) =>
        dispatch({
          field,
          side,
          type: 'change-team-field',
          value,
        }),
      confirmDiscardChanges: () =>
        dispatch({ type: 'load-latest-saved-prediction' }),
      continueForward: () => dispatch({ type: 'continue-forward' }),
      editStep: (stepId) =>
        dispatch({
          stepId,
          type: 'edit-step',
        }),
      goBack: () => dispatch({ type: 'go-back' }),
      loadLatestSavedPrediction: () =>
        dispatch({ type: 'load-latest-saved-prediction' }),
      requestDiscardChanges: () => dispatch({ type: 'request-discard' }),
      returnToReview: () => dispatch({ type: 'return-to-review' }),
      selectBuiltInChoice: (field, value) =>
        dispatch({
          field,
          type: 'select-built-in-choice',
          value,
        }),
      startPrediction: () => dispatch({ type: 'start-prediction' }),
      submitPrediction,
    }),
    [submitPrediction],
  );

  return {
    actions,
    state,
  };
};
