import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useState,
  type ReactNode,
  type ComponentType,
} from 'react';

import {
  projectPredictionPresentation,
  type KaplayPreviewSettings,
  type KaplayRuntimeStatus,
} from './presentationMode';
import {
  useAnimationPreference,
  type AnimationPreference,
} from './presentationPreference';
import { usePrefersReducedMotion } from './reducedMotion';
import type {
  PredictionSessionActions,
  PredictionSessionRendererState,
} from './predictionSession';
import type { KaplayMatchResultRuntimeFactory } from './kaplay/matchResultRuntime';
import type { KaplayMatchResultPreviewProps } from './kaplay/KaplayMatchResultPreview';

const LazyKaplayMatchResultPreview = lazy(
  () => import('./kaplay/KaplayMatchResultPreview'),
);

export interface PredictionPresentationHostProps {
  readonly actions: PredictionSessionActions;
  readonly initializationTimeoutMs?: number;
  readonly previewComponent?: ComponentType<KaplayMatchResultPreviewProps>;
  readonly previewSettings: KaplayPreviewSettings;
  readonly renderStandard: () => ReactNode;
  readonly runtimeFactory?: KaplayMatchResultRuntimeFactory;
  readonly state: PredictionSessionRendererState;
}

interface RendererBoundaryState {
  readonly error: Error | null;
}

interface RuntimePresentationState {
  readonly failure: Error | null;
  readonly retryVersion: number;
  readonly sessionKey: string;
  readonly status: KaplayRuntimeStatus;
}

class PredictionRendererErrorBoundary extends Component<
  {
    readonly children: ReactNode;
    readonly onError: (error: Error) => void;
    readonly resetKey: string;
  },
  RendererBoundaryState
> {
  override state: RendererBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RendererBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    this.props.onError(error);
  }

  override componentDidUpdate(
    previousProps: Readonly<{
      readonly children: ReactNode;
      readonly onError: (error: Error) => void;
      readonly resetKey: string;
    }>,
  ): void {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  override render(): ReactNode {
    if (this.state.error) {
      return null;
    }

    return this.props.children;
  }
}

const sessionKeyForState = (state: PredictionSessionRendererState): string =>
  `${state.editSession.userId}:${state.editSession.fixtureId}`;

export const PredictionPresentationHost = ({
  actions,
  initializationTimeoutMs,
  previewComponent,
  previewSettings,
  renderStandard,
  runtimeFactory,
  state,
}: PredictionPresentationHostProps) => {
  const sessionKey = sessionKeyForState(state);
  const [preference, setPreference] = useAnimationPreference();
  const reducedMotion = usePrefersReducedMotion();
  const [storedRuntimeState, setStoredRuntimeState] =
    useState<RuntimePresentationState>(() => ({
      failure: null,
      retryVersion: 0,
      sessionKey,
      status: 'idle',
    }));

  const runtimeState =
    storedRuntimeState.sessionKey === sessionKey
      ? storedRuntimeState
      : {
          failure: null,
          retryVersion: 0,
          sessionKey,
          status: 'idle' as const,
        };
  const runtimeFailure = runtimeState.failure;
  const runtimeStatus = runtimeState.status;
  const retryVersion = runtimeState.retryVersion;

  const projectedRuntimeStatus: KaplayRuntimeStatus = runtimeFailure
    ? 'failed'
    : runtimeStatus;
  const projection = projectPredictionPresentation({
    preference,
    previewEnabled: previewSettings.enabled,
    reducedMotion,
    runtimeStatus: projectedRuntimeStatus,
    state,
  });

  const selectPreference = useCallback(
    (nextPreference: AnimationPreference) => {
      if (nextPreference === 'on') {
        setStoredRuntimeState((current) => ({
          failure: null,
          retryVersion:
            current.sessionKey === sessionKey ? current.retryVersion + 1 : 1,
          sessionKey,
          status: 'idle',
        }));
      }

      setPreference(nextPreference);
    },
    [sessionKey, setPreference],
  );

  const onRuntimeStatusChange = useCallback(
    (status: KaplayRuntimeStatus) => {
      setStoredRuntimeState((current) => ({
        failure: current.sessionKey === sessionKey ? current.failure : null,
        retryVersion:
          current.sessionKey === sessionKey ? current.retryVersion : 0,
        sessionKey,
        status,
      }));
    },
    [sessionKey],
  );

  const onRuntimeFailure = useCallback(
    (error: Error) => {
      setStoredRuntimeState((current) => ({
        failure: error,
        retryVersion:
          current.sessionKey === sessionKey ? current.retryVersion : 0,
        sessionKey,
        status: 'failed',
      }));
    },
    [sessionKey],
  );

  const retryAnimations = useCallback(() => {
    setStoredRuntimeState((current) => ({
      failure: null,
      retryVersion:
        current.sessionKey === sessionKey ? current.retryVersion + 1 : 1,
      sessionKey,
      status: 'idle',
    }));
    setPreference('on');
  }, [sessionKey, setPreference]);

  const continueWithoutAnimations = useCallback(() => {
    setPreference('off');
    setStoredRuntimeState((current) => ({
      failure: current.sessionKey === sessionKey ? current.failure : null,
      retryVersion:
        current.sessionKey === sessionKey ? current.retryVersion : 0,
      sessionKey,
      status: 'idle',
    }));
  }, [sessionKey, setPreference]);

  const resetKey = `${sessionKey}:${retryVersion}`;
  const PreviewComponent = previewComponent ?? LazyKaplayMatchResultPreview;
  const control = previewSettings.enabled ? (
    <AnimationPreviewControl
      failure={runtimeFailure}
      isLoading={projection.mode === 'kaplay-loading'}
      preference={preference}
      reducedMotion={reducedMotion}
      supportsKaplayStep={projection.supportsKaplayStep}
      onContinueWithoutAnimations={continueWithoutAnimations}
      onRetry={retryAnimations}
      onSelectPreference={selectPreference}
    />
  ) : null;

  const content =
    !projection.shouldAttemptKaplay || runtimeFailure ? (
      renderStandard()
    ) : (
      <PredictionRendererErrorBoundary
        key={resetKey}
        resetKey={resetKey}
        onError={onRuntimeFailure}
      >
        <Suspense
          fallback={
            <KaplayLoadingFallback
              onContinueWithoutAnimations={continueWithoutAnimations}
            />
          }
        >
          <PreviewComponent
            actions={actions}
            initializationTimeoutMs={initializationTimeoutMs}
            runtimeFactory={runtimeFactory}
            state={state}
            testControlsEnabled={previewSettings.testControls}
            onRuntimeFailure={onRuntimeFailure}
            onRuntimeStatusChange={onRuntimeStatusChange}
          />
        </Suspense>
      </PredictionRendererErrorBoundary>
    );

  return (
    <div className="grid gap-5">
      {control}
      {content}
    </div>
  );
};

const AnimationPreviewControl = ({
  failure,
  isLoading,
  onContinueWithoutAnimations,
  onRetry,
  onSelectPreference,
  preference,
  reducedMotion,
  supportsKaplayStep,
}: {
  readonly failure: Error | null;
  readonly isLoading: boolean;
  readonly onContinueWithoutAnimations: () => void;
  readonly onRetry: () => void;
  readonly onSelectPreference: (preference: AnimationPreference) => void;
  readonly preference: AnimationPreference;
  readonly reducedMotion: boolean;
  readonly supportsKaplayStep: boolean;
}) => (
  <section className="rounded-md border border-rooster-line bg-white p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-black text-rooster-ink">Animations</p>
        <p className="mt-1 text-sm leading-6 text-rooster-muted">
          Match Result preview only. Other prediction steps use the standard
          experience.
        </p>
      </div>
      <div
        aria-label="Animations"
        className="grid grid-cols-2 overflow-hidden rounded-md border border-rooster-line"
        role="group"
      >
        <button
          aria-pressed={preference === 'off'}
          className={[
            'focus-ring min-h-11 px-4 text-sm font-black transition',
            preference === 'off'
              ? 'bg-rooster-ink text-white'
              : 'bg-white text-rooster-ink hover:bg-rooster-paper',
          ].join(' ')}
          type="button"
          onClick={() => onSelectPreference('off')}
        >
          Off
        </button>
        <button
          aria-pressed={preference === 'on'}
          className={[
            'focus-ring min-h-11 border-l border-rooster-line px-4 text-sm font-black transition',
            preference === 'on'
              ? 'bg-rooster-red text-white'
              : 'bg-white text-rooster-ink hover:bg-rooster-paper',
          ].join(' ')}
          type="button"
          onClick={() => onSelectPreference('on')}
        >
          On
        </button>
      </div>
    </div>

    {reducedMotion && preference === 'on' ? (
      <p
        className="mt-3 rounded-md border border-rooster-sun/50 bg-rooster-sun/10 p-3 text-sm font-bold text-rooster-ink"
        role="status"
      >
        Your device/browser preference keeps animations off.
      </p>
    ) : null}

    {!supportsKaplayStep && preference === 'on' && !reducedMotion ? (
      <p className="mt-3 text-sm font-semibold leading-6 text-rooster-muted">
        This step uses the standard experience.
      </p>
    ) : null}

    {isLoading ? (
      <div
        className="mt-3 flex flex-col gap-3 rounded-md border border-rooster-line bg-rooster-paper p-3 sm:flex-row sm:items-center sm:justify-between"
        role="status"
      >
        <p className="text-sm font-bold text-rooster-ink">
          Loading animation preview.
        </p>
        <button
          className="focus-ring min-h-10 rounded-md border border-rooster-line bg-white px-3 text-sm font-black text-rooster-ink transition hover:bg-rooster-paper"
          type="button"
          onClick={onContinueWithoutAnimations}
        >
          Continue without animations
        </button>
      </div>
    ) : null}

    {failure ? (
      <div
        className="mt-3 rounded-md border border-rooster-red/30 bg-rooster-red/10 p-3"
        role="alert"
      >
        <p className="text-sm font-bold text-rooster-ink">
          Animations couldn&apos;t continue. Your answers have been kept.
        </p>
        <button
          className="focus-ring mt-3 min-h-10 rounded-md border border-rooster-line bg-white px-3 text-sm font-black text-rooster-ink transition hover:bg-rooster-paper"
          type="button"
          onClick={onRetry}
        >
          Retry animations
        </button>
      </div>
    ) : null}
  </section>
);

const KaplayLoadingFallback = ({
  onContinueWithoutAnimations,
}: {
  readonly onContinueWithoutAnimations: () => void;
}) => (
  <section
    className="rounded-md border border-rooster-line bg-white p-5 sm:p-6"
    role="status"
  >
    <p className="text-sm font-bold text-rooster-ink">
      Loading animation preview.
    </p>
    <button
      className="focus-ring mt-3 min-h-10 rounded-md border border-rooster-line bg-white px-3 text-sm font-black text-rooster-ink transition hover:bg-rooster-paper"
      type="button"
      onClick={onContinueWithoutAnimations}
    >
      Continue without animations
    </button>
  </section>
);
