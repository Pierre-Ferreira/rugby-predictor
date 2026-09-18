import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
} from 'react';

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
): MatchResultRuntimeSnapshot => {
  const message = state.currentStep?.message;
  const selectedLabel = state.form.matchResult
    ? matchResultLabel(state.fixture, state.form.matchResult)
    : null;

  return {
    canSelect: supportsKaplayPredictionStep(state),
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
    helperText: message?.body ?? null,
    pickedLabel: selectedLabel,
    question: message?.heading ?? 'Who do you think will win?',
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
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
    attempt.updateSnapshot(snapshotFromState(state));
  }, [attempt, state]);

  const selectChoice = useCallback(
    (value: MatchResultChoiceValue) => {
      const latestState = stateRef.current;

      if (!attempt.isCurrent() || !supportsKaplayPredictionStep(latestState)) {
        return;
      }

      actions.selectBuiltInChoice('matchResult', value);
    },
    [actions, attempt],
  );

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    let isRuntimeMountActive = true;
    const initialSnapshot = snapshotFromState(stateRef.current);

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

  const snapshot = useMemo(() => snapshotFromState(state), [state]);
  const questionId = 'kaplay-match-result-question';
  const helperId = 'kaplay-match-result-helper';
  const selectedValue = state.form.matchResult;

  const onChoiceKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    value: MatchResultChoiceValue,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    selectChoice(value);
  };

  return (
    <section
      className="grid gap-5 rounded-md border border-rooster-line bg-white p-5 sm:p-6"
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
        <p className="mt-3 text-sm font-semibold leading-6 text-rooster-muted">
          Animation preview: Match Result only. Other prediction steps use the
          standard experience.
        </p>
      </div>

      <div className="overflow-hidden rounded-md border border-rooster-line bg-rooster-paper">
        <canvas
          aria-describedby={snapshot.helperText ? helperId : undefined}
          aria-labelledby={questionId}
          className="block aspect-[23/14] w-full touch-manipulation"
          data-testid="kaplay-match-result-canvas"
          ref={canvasRef}
        />
      </div>

      <fieldset aria-labelledby={questionId}>
        <legend className="sr-only">Match Result animation choices</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {snapshot.choices.map((choice) => {
            const selected = selectedValue === choice.value;

            return (
              <button
                aria-checked={selected}
                className={[
                  'focus-ring min-h-14 rounded-md border px-4 text-left text-sm font-black transition',
                  selected
                    ? 'border-rooster-red bg-rooster-red text-white'
                    : 'border-rooster-line bg-white text-rooster-ink hover:bg-rooster-paper',
                ].join(' ')}
                key={choice.value}
                role="radio"
                type="button"
                onClick={() => selectChoice(choice.value)}
                onKeyDown={(event) => onChoiceKeyDown(event, choice.value)}
              >
                {choice.label}
              </button>
            );
          })}
        </div>
        {snapshot.pickedLabel ? (
          <p
            className="mt-3 text-sm font-black text-rooster-ink"
            data-testid="kaplay-match-result-picked"
          >
            You picked {snapshot.pickedLabel}
          </p>
        ) : null}
      </fieldset>

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
