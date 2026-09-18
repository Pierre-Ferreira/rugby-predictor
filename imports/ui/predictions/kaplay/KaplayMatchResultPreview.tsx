import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { matchResultLabel, teamDisplayName } from '../standardPredictionState';
import { supportsKaplayPredictionStep } from '../presentationMode';
import type {
  PredictionSessionActions,
  PredictionSessionRendererState,
} from '../predictionSession';
import type {
  MatchResultChoiceValue,
  MatchResultRuntimeSnapshot,
} from './matchResultRuntime';
import {
  MATCH_RESULT_SCENE_WIDTH,
  projectMatchResultLayout,
} from './matchResultMotion';
import type { KaplayPreviewAttemptController } from './previewAttempt';

export interface KaplayMatchResultPreviewProps {
  readonly actions: PredictionSessionActions;
  readonly attempt: KaplayPreviewAttemptController;
  readonly state: PredictionSessionRendererState;
  readonly testControlsEnabled?: boolean;
}

const isMatchResultChoiceValue = (
  value: string,
): value is MatchResultChoiceValue =>
  value === 'team1' || value === 'team2' || value === 'draw';

const sessionKeyForState = (state: PredictionSessionRendererState): string =>
  `${state.editSession.userId}:${state.editSession.fixtureId}`;

const snapshotFromState = (
  state: PredictionSessionRendererState,
  {
    choicesVisible,
    focusedValue,
    selectionEffectId,
  }: {
    readonly choicesVisible: boolean;
    readonly focusedValue: MatchResultChoiceValue | null;
    readonly selectionEffectId: number;
  },
): MatchResultRuntimeSnapshot => {
  const message = state.currentStep?.message;
  const selectedLabel = state.form.matchResult
    ? matchResultLabel(state.fixture, state.form.matchResult)
    : null;
  const selectedValue = isMatchResultChoiceValue(state.form.matchResult)
    ? state.form.matchResult
    : null;

  return {
    canSelect: choicesVisible && supportsKaplayPredictionStep(state),
    choicePresentation:
      selectedValue && !choicesVisible ? 'selected' : 'choices',
    choices: [
      {
        label: teamDisplayName(state.fixture, 'team1'),
        selected: state.form.matchResult === 'team1',
        value: 'team1',
      },
      {
        label: teamDisplayName(state.fixture, 'team2'),
        selected: state.form.matchResult === 'team2',
        value: 'team2',
      },
      {
        label: 'Draw',
        selected: state.form.matchResult === 'draw',
        value: 'draw',
      },
    ],
    deduction: message?.deduction ?? null,
    focusedValue,
    helperText: message?.body ?? null,
    pickedLabel: selectedLabel,
    question: message?.heading ?? 'Who do you think will win?',
    selectionEffectId,
    sessionKey: sessionKeyForState(state),
    supportingText: message?.supportingText ?? [],
  };
};

export const KaplayMatchResultPreview = ({
  actions,
  attempt,
  state,
  testControlsEnabled = false,
}: KaplayMatchResultPreviewProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasShellRef = useRef<HTMLDivElement | null>(null);
  const radioRefs = useRef<
    Partial<Record<MatchResultChoiceValue, HTMLInputElement | null>>
  >({});
  const actionsRef = useRef(actions);
  const stateRef = useRef(state);
  const sessionKey = sessionKeyForState(state);
  const selectedValue = isMatchResultChoiceValue(state.form.matchResult)
    ? state.form.matchResult
    : null;
  const [choicesVisible, setChoicesVisible] = useState(() => !selectedValue);
  const [focusedValue, setFocusedValue] =
    useState<MatchResultChoiceValue | null>(null);
  const [selectionEffectId, setSelectionEffectId] = useState(0);
  const [canvasCssWidth, setCanvasCssWidth] = useState(
    MATCH_RESULT_SCENE_WIDTH,
  );
  const choicesAreVisible = !selectedValue || choicesVisible;
  const snapshot = useMemo(
    () =>
      snapshotFromState(state, {
        choicesVisible: choicesAreVisible,
        focusedValue,
        selectionEffectId,
      }),
    [choicesAreVisible, focusedValue, selectionEffectId, state],
  );
  const runtimeSnapshotRef = useRef(snapshot);
  const previousSessionKeyRef = useRef(sessionKey);
  const projectedLayout = useMemo(
    () => projectMatchResultLayout(snapshot, canvasCssWidth),
    [canvasCssWidth, snapshot],
  );
  const canvasStyle = useMemo(
    () => ({
      aspectRatio: `${projectedLayout.stage.width} / ${projectedLayout.stage.height}`,
    }),
    [projectedLayout.stage.height, projectedLayout.stage.width],
  );

  useEffect(() => {
    if (previousSessionKeyRef.current === sessionKey) {
      return;
    }

    previousSessionKeyRef.current = sessionKey;
    setChoicesVisible(!selectedValue);
    setFocusedValue(null);
    setSelectionEffectId(0);
  }, [selectedValue, sessionKey]);

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    runtimeSnapshotRef.current = snapshot;
    attempt.updateSnapshot(snapshot);
  }, [attempt, snapshot]);

  useEffect(() => {
    const shell = canvasShellRef.current;

    if (!shell) {
      return undefined;
    }

    const updateWidth = () => {
      const nextWidth = shell.getBoundingClientRect().width;

      if (nextWidth <= 0) {
        return;
      }

      setCanvasCssWidth((currentWidth) =>
        Math.abs(currentWidth - nextWidth) >= 1 ? nextWidth : currentWidth,
      );
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);

      return () => {
        window.removeEventListener('resize', updateWidth);
      };
    }

    const observer = new ResizeObserver(() => updateWidth());

    observer.observe(shell);

    return () => {
      observer.disconnect();
    };
  }, []);

  const selectChoice = useCallback(
    (value: MatchResultChoiceValue) => {
      const latestState = stateRef.current;

      if (!attempt.isCurrent() || !supportsKaplayPredictionStep(latestState)) {
        return;
      }

      if (latestState.form.matchResult === value) {
        setChoicesVisible(false);
        return;
      }

      actionsRef.current.selectBuiltInChoice('matchResult', value);
      setChoicesVisible(false);
      setSelectionEffectId((current) => current + 1);
    },
    [attempt],
  );

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    let isRuntimeMountActive = true;
    const initialSnapshot = runtimeSnapshotRef.current;

    attempt.updateSnapshot(initialSnapshot);
    const stopRuntime = attempt.startRuntime({
      canvas,
      initialSnapshot,
      isSelectionAllowed: () =>
        isRuntimeMountActive &&
        attempt.isCurrent() &&
        supportsKaplayPredictionStep(stateRef.current),
      onFailure: (error) => {
        if (!isRuntimeMountActive || !attempt.isCurrent()) {
          return;
        }

        attempt.fail(error);
      },
      onSelect: (value) => {
        if (
          !isRuntimeMountActive ||
          !attempt.isCurrent() ||
          !isMatchResultChoiceValue(value)
        ) {
          return;
        }

        selectChoice(value);
      },
      testControlsEnabled,
    });

    return () => {
      isRuntimeMountActive = false;
      stopRuntime();
    };
  }, [attempt, selectChoice, testControlsEnabled]);

  const questionId = 'kaplay-match-result-question';
  const helperId = 'kaplay-match-result-helper';
  const visibleChoices = choicesAreVisible
    ? snapshot.choices
    : snapshot.choices.filter((choice) => choice.selected);
  const showChangeSelection = Boolean(selectedValue && !choicesAreVisible);
  const showPickedStatus = Boolean(snapshot.pickedLabel && !choicesAreVisible);

  const restoreChoices = () => {
    setChoicesVisible(true);
    window.setTimeout(() => {
      if (selectedValue) {
        radioRefs.current[selectedValue]?.focus();
      }
    }, 0);
  };

  return (
    <section
      className="grid gap-5 rounded-md border border-rooster-line bg-white p-5 shadow-sm sm:p-6"
      data-testid="kaplay-match-result-stage"
    >
      <PredictionProgress
        current={state.currentStep?.position.current ?? 1}
        total={state.currentStep?.position.total ?? state.activeSteps.length}
      />
      <div>
        <p className="text-sm font-black uppercase text-rooster-red">
          Step {state.currentStep?.position.current ?? 1} of{' '}
          {state.currentStep?.position.total ?? state.activeSteps.length}
        </p>
        <h2
          className="mt-2 text-2xl font-black text-rooster-ink sm:text-3xl"
          id={questionId}
        >
          {snapshot.question}
        </h2>
        {snapshot.helperText ? (
          <p
            className="mt-2 max-w-3xl text-base font-semibold leading-7 text-rooster-ink"
            id={helperId}
          >
            {snapshot.helperText}
          </p>
        ) : null}
        {snapshot.deduction ? (
          <p className="mt-3 max-w-3xl text-sm leading-6 text-rooster-muted">
            {snapshot.deduction}
          </p>
        ) : null}
      </div>

      <div
        className="overflow-hidden rounded-md border border-rooster-line bg-rooster-paper"
        ref={canvasShellRef}
      >
        <canvas
          aria-describedby={snapshot.helperText ? helperId : undefined}
          aria-labelledby={questionId}
          className="block w-full touch-manipulation"
          data-testid="kaplay-match-result-canvas"
          ref={canvasRef}
          style={canvasStyle}
        />
      </div>

      <fieldset
        aria-labelledby={questionId}
        className="sr-only"
        data-testid="kaplay-match-result-choice-bridge"
      >
        <legend>Match Result animation choices</legend>
        {visibleChoices.map((choice) => {
          const selected = selectedValue === choice.value;

          return (
            <label key={choice.value}>
              <input
                aria-checked={selected}
                checked={selected}
                name="kaplay-match-result-choice"
                ref={(input) => {
                  radioRefs.current[choice.value] = input;
                }}
                type="radio"
                value={choice.value}
                onBlur={() => setFocusedValue(null)}
                onChange={() => selectChoice(choice.value)}
                onFocus={() => setFocusedValue(choice.value)}
              />
              {choice.label}
            </label>
          );
        })}
      </fieldset>
      {showPickedStatus ? (
        <p
          className="sr-only"
          data-testid="kaplay-match-result-picked"
          role="status"
        >
          You picked {snapshot.pickedLabel}
        </p>
      ) : null}
      {showChangeSelection ? (
        <div className="flex justify-start">
          <button
            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md border border-rooster-line bg-white px-4 text-sm font-black text-rooster-ink transition hover:bg-rooster-paper"
            type="button"
            onClick={restoreChoices}
          >
            Change my selection
          </button>
        </div>
      ) : null}

      <KaplayStepNavigation
        canGoBack={state.navigation.canGoBack}
        continueDisabled={!state.navigation.canContinue}
        continueLabel={state.navigation.continueLabel}
        returnToReviewAvailable={
          state.location.kind === 'step' && state.isEditingFromReview
        }
        returnToReviewDisabled={!state.navigation.canReturnToReview}
        onBack={actions.goBack}
        onContinue={actions.continueForward}
        onReturnToReview={actions.returnToReview}
      />
    </section>
  );
};

const PredictionProgress = ({
  current,
  total,
}: {
  readonly current: number;
  readonly total: number;
}) => (
  <div aria-label={`Step ${current} of ${total}`} role="group">
    <div className="flex gap-1.5" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span
          className={[
            'h-2 flex-1 rounded-full',
            index < current ? 'bg-rooster-red' : 'bg-rooster-line',
          ].join(' ')}
          key={index}
        />
      ))}
    </div>
  </div>
);

const KaplayStepNavigation = ({
  canGoBack,
  continueDisabled,
  continueLabel,
  onBack,
  onContinue,
  onReturnToReview,
  returnToReviewAvailable,
  returnToReviewDisabled,
}: {
  readonly canGoBack: boolean;
  readonly continueDisabled: boolean;
  readonly continueLabel: string;
  readonly onBack: () => void;
  readonly onContinue: () => void;
  readonly onReturnToReview: () => void;
  readonly returnToReviewAvailable: boolean;
  readonly returnToReviewDisabled: boolean;
}) => (
  <div className="mt-2 flex flex-col-reverse gap-3 border-t border-rooster-line pt-5 sm:flex-row sm:items-center sm:justify-between">
    <button
      className="focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-md border border-rooster-line bg-white px-5 text-base font-black text-rooster-ink transition hover:bg-rooster-paper disabled:cursor-not-allowed disabled:text-rooster-muted sm:w-auto"
      disabled={!canGoBack}
      type="button"
      onClick={onBack}
    >
      Back
    </button>
    <div className="flex flex-col gap-3 sm:flex-row">
      {returnToReviewAvailable ? (
        <button
          className="focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-md border border-rooster-line bg-white px-5 text-base font-black text-rooster-ink transition hover:bg-rooster-paper disabled:cursor-not-allowed disabled:text-rooster-muted sm:w-auto"
          disabled={returnToReviewDisabled}
          type="button"
          onClick={onReturnToReview}
        >
          Return to Review
        </button>
      ) : null}
      <button
        className="focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-md bg-rooster-red px-5 text-base font-black text-white transition hover:bg-rooster-ink disabled:cursor-not-allowed disabled:bg-rooster-muted sm:w-auto"
        disabled={continueDisabled}
        type="button"
        onClick={onContinue}
      >
        {continueLabel}
      </button>
    </div>
  </div>
);

export default KaplayMatchResultPreview;
