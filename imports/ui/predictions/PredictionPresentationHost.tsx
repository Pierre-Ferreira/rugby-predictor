import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import {
  createDefaultKaplayMatchResultRuntime,
  KAPLAY_INITIALIZATION_TIMEOUT_MS,
  type KaplayMatchResultRuntimeFactory,
  type KaplayMatchResultRuntimeFactoryInput,
  type KaplayMatchResultRuntimeHandle,
  type KaplayMatchResultRuntimeViewport,
  type MatchResultRuntimeSnapshot,
} from './kaplay/matchResultRuntime';
import type { KaplayMatchResultPreviewProps } from './kaplay/KaplayMatchResultPreview';
import type { KaplayPreviewAttemptController } from './kaplay/previewAttempt';

export type KaplayMatchResultPreviewLoader = () => Promise<
  ComponentType<KaplayMatchResultPreviewProps>
>;

export const loadKaplayMatchResultPreview = async (): Promise<
  ComponentType<KaplayMatchResultPreviewProps>
> => {
  const module = await import('./kaplay/KaplayMatchResultPreview');

  return module.default;
};

export interface PredictionPresentationHostProps {
  readonly actions: PredictionSessionActions;
  readonly initializationTimeoutMs?: number;
  readonly previewComponent?: ComponentType<KaplayMatchResultPreviewProps>;
  readonly previewLoader?: KaplayMatchResultPreviewLoader;
  readonly previewSettings: KaplayPreviewSettings;
  readonly renderStandard: () => ReactNode;
  readonly runtimeFactory?: KaplayMatchResultRuntimeFactory;
  readonly state: PredictionSessionRendererState;
}

interface RendererBoundaryState {
  readonly error: Error | null;
}

interface RuntimePresentationState {
  readonly attemptId: number | null;
  readonly controller: KaplayPreviewAttemptController | null;
  readonly failure: Error | null;
  readonly retryVersion: number;
  readonly sessionKey: string;
  readonly status: KaplayRuntimeStatus;
}

interface LoadedPreviewState {
  readonly attemptId: number;
  readonly Component: ComponentType<KaplayMatchResultPreviewProps>;
}

type HostAttemptStatus = 'cancelled' | 'failed' | 'loading' | 'ready';
type PreviewAttemptCycleKind = 'replacement' | 'startup';

interface PreviewAttemptCycle {
  readonly deadlineAt: number;
  readonly id: number;
  readonly kind: PreviewAttemptCycleKind;
  readonly timer: number;
}

interface RuntimeGeneration {
  readonly abortController: AbortController;
  readonly canvas: HTMLCanvasElement;
  disposalComplete: Promise<void> | null;
  readonly id: number;
  readonly key: string;
  readonly viewport: KaplayMatchResultRuntimeViewport;
  stopped: boolean;
}

interface HostPreviewAttempt {
  readonly cancel: (resetStatus: boolean) => void;
  readonly controller: KaplayPreviewAttemptController;
  readonly fail: (error: Error) => void;
  readonly id: number;
  readonly retryVersion: number;
  readonly sessionKey: string;
  status: HostAttemptStatus;
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

const errorFromUnknown = (error: unknown, fallback: string): Error => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(fallback);
};

const viewportKey = (viewport: KaplayMatchResultRuntimeViewport): string =>
  `${viewport.stage.width}:${viewport.stage.height}`;

export const PredictionPresentationHost = ({
  actions,
  initializationTimeoutMs,
  previewComponent,
  previewLoader,
  previewSettings,
  renderStandard,
  runtimeFactory,
  state,
}: PredictionPresentationHostProps) => {
  const sessionKey = sessionKeyForState(state);
  const [preference, setPreference] = useAnimationPreference();
  const reducedMotion = usePrefersReducedMotion();
  const activeAttemptRef = useRef<HostPreviewAttempt | null>(null);
  const pendingRuntimeTeardownRef = useRef<Promise<void> | null>(null);
  const nextAttemptIdRef = useRef(0);
  const runtimeFactoryRef = useRef<KaplayMatchResultRuntimeFactory>(
    runtimeFactory ?? createDefaultKaplayMatchResultRuntime,
  );
  const initializationTimeoutRef = useRef(
    initializationTimeoutMs ?? KAPLAY_INITIALIZATION_TIMEOUT_MS,
  );
  const resolvedPreviewLoader = useMemo<KaplayMatchResultPreviewLoader>(
    () =>
      previewComponent
        ? () => Promise.resolve(previewComponent)
        : (previewLoader ?? loadKaplayMatchResultPreview),
    [previewComponent, previewLoader],
  );
  const previewLoaderRef = useRef(resolvedPreviewLoader);
  const [storedRuntimeState, setStoredRuntimeState] =
    useState<RuntimePresentationState>(() => ({
      attemptId: null,
      controller: null,
      failure: null,
      retryVersion: 0,
      sessionKey,
      status: 'idle',
    }));

  const runtimeState =
    storedRuntimeState.sessionKey === sessionKey
      ? storedRuntimeState
      : {
          attemptId: null,
          controller: null,
          failure: null,
          retryVersion: 0,
          sessionKey,
          status: 'idle' as const,
        };
  const runtimeFailure = runtimeState.failure;
  const runtimeStatus = runtimeState.status;
  const retryVersion = runtimeState.retryVersion;
  const [loadedPreviewState, setLoadedPreviewState] =
    useState<LoadedPreviewState | null>(null);

  useEffect(() => {
    runtimeFactoryRef.current =
      runtimeFactory ?? createDefaultKaplayMatchResultRuntime;
  }, [runtimeFactory]);

  useEffect(() => {
    initializationTimeoutRef.current =
      initializationTimeoutMs ?? KAPLAY_INITIALIZATION_TIMEOUT_MS;
  }, [initializationTimeoutMs]);

  useEffect(() => {
    previewLoaderRef.current = resolvedPreviewLoader;
  }, [resolvedPreviewLoader]);

  const cancelActiveAttempt = useCallback((resetStatus: boolean) => {
    activeAttemptRef.current?.cancel(resetStatus);
  }, []);

  const startAttempt = useCallback(
    (attemptSessionKey: string, attemptRetryVersion: number) => {
      const id = nextAttemptIdRef.current + 1;
      nextAttemptIdRef.current = id;

      const durationMs = initializationTimeoutRef.current;
      let nextCycleId = 0;
      let currentCycle: PreviewAttemptCycle | null = null;
      let latestSnapshot: MatchResultRuntimeSnapshot | null = null;
      let runtimeHandle: KaplayMatchResultRuntimeHandle | null = null;
      let runtimeHandleDisposed = false;
      let runtimeStartCounter = 0;
      let activeGeneration: RuntimeGeneration | null = null;
      let pendingRuntimeTeardown: Promise<void> | null = null;
      let hasReadyRuntime = false;
      let attempt!: HostPreviewAttempt;

      const clearCycle = (cycleId?: number) => {
        if (!currentCycle || (cycleId && currentCycle.id !== cycleId)) {
          return;
        }

        window.clearTimeout(currentCycle.timer);
        currentCycle = null;
      };

      const beginCycle = (kind: PreviewAttemptCycleKind) => {
        if (currentCycle?.kind === kind) {
          return currentCycle;
        }

        clearCycle();

        const cycleId = nextCycleId + 1;
        nextCycleId = cycleId;

        const cycle: PreviewAttemptCycle = {
          deadlineAt: Date.now() + durationMs,
          id: cycleId,
          kind,
          timer: window.setTimeout(() => {
            if (currentCycle?.id !== cycleId) {
              return;
            }

            fail(
              new Error(
                kind === 'startup'
                  ? 'Kaplay preview initialization timed out.'
                  : 'Kaplay preview replacement timed out.',
              ),
            );
          }, durationMs),
        };

        currentCycle = cycle;

        return cycle;
      };

      const rememberRuntimeTeardown = (
        disposalComplete: Promise<void> | undefined,
      ): Promise<void> => {
        if (!disposalComplete) {
          return (
            pendingRuntimeTeardown ??
            pendingRuntimeTeardownRef.current ??
            Promise.resolve()
          );
        }

        const teardown = disposalComplete.then(() => undefined);

        pendingRuntimeTeardown = teardown;
        pendingRuntimeTeardownRef.current = teardown;
        void teardown.catch(() => undefined);
        teardown.then(
          () => {
            if (pendingRuntimeTeardown === teardown) {
              pendingRuntimeTeardown = null;
            }
            if (pendingRuntimeTeardownRef.current === teardown) {
              pendingRuntimeTeardownRef.current = null;
            }
          },
          () => undefined,
        );

        return teardown;
      };

      const disposeAdoptedRuntime = (): Promise<void> => {
        if (!runtimeHandle || runtimeHandleDisposed) {
          runtimeHandle = null;
          return pendingRuntimeTeardown ?? Promise.resolve();
        }

        const handle = runtimeHandle;
        runtimeHandleDisposed = true;
        runtimeHandle = null;

        try {
          handle.dispose();
        } catch {
          // Runtime teardown is best-effort once a generation is obsolete.
        }

        return rememberRuntimeTeardown(handle.disposalComplete);
      };

      const updateStateForAttempt = (
        nextStatus: KaplayRuntimeStatus,
        failure: Error | null,
      ) => {
        setStoredRuntimeState((current) => {
          if (
            current.sessionKey !== attemptSessionKey ||
            current.retryVersion !== attemptRetryVersion ||
            current.attemptId !== id
          ) {
            return current;
          }

          return {
            attemptId: id,
            controller: nextStatus === 'failed' ? null : attempt.controller,
            failure,
            retryVersion: attemptRetryVersion,
            sessionKey: attemptSessionKey,
            status: nextStatus,
          };
        });
      };

      const isCurrent = () =>
        activeAttemptRef.current === attempt && attempt.status === 'loading';

      const stopGeneration = (
        generation: RuntimeGeneration | null,
      ): Promise<void> => {
        if (!generation) {
          return pendingRuntimeTeardown ?? Promise.resolve();
        }

        if (activeGeneration === generation) {
          activeGeneration = null;
        }

        if (generation.stopped) {
          return rememberRuntimeTeardown(
            generation.disposalComplete ?? undefined,
          );
        }

        generation.stopped = true;
        generation.abortController.abort();

        return rememberRuntimeTeardown(
          generation.disposalComplete ?? undefined,
        );
      };

      const stopActiveGeneration = () => {
        if (!activeGeneration || activeGeneration.stopped) {
          activeGeneration = null;
          return;
        }

        stopGeneration(activeGeneration);
      };

      const fail = (error: Error) => {
        if (attempt.status === 'cancelled' || attempt.status === 'failed') {
          return;
        }

        attempt.status = 'failed';
        clearCycle();
        stopActiveGeneration();
        disposeAdoptedRuntime();

        if (activeAttemptRef.current === attempt) {
          activeAttemptRef.current = null;
        }

        setLoadedPreviewState((current) =>
          current?.attemptId === id ? null : current,
        );
        updateStateForAttempt('failed', error);
      };

      const cancel = (resetStatus: boolean) => {
        if (attempt.status === 'cancelled') {
          return;
        }

        attempt.status = 'cancelled';
        clearCycle();
        stopActiveGeneration();
        disposeAdoptedRuntime();

        if (activeAttemptRef.current === attempt) {
          activeAttemptRef.current = null;
        }

        setLoadedPreviewState((current) =>
          current?.attemptId === id ? null : current,
        );

        if (!resetStatus) {
          return;
        }

        setStoredRuntimeState((current) => {
          if (
            current.sessionKey !== attemptSessionKey ||
            current.retryVersion !== attemptRetryVersion ||
            current.attemptId !== id
          ) {
            return current;
          }

          return {
            attemptId: null,
            controller: null,
            failure: current.failure,
            retryVersion: attemptRetryVersion,
            sessionKey: attemptSessionKey,
            status: 'idle',
          };
        });
      };

      const remainingTimeMs = () =>
        currentCycle ? Math.max(0, currentCycle.deadlineAt - Date.now()) : 0;

      const isRuntimeGenerationCurrent = (generation: RuntimeGeneration) =>
        activeAttemptRef.current === attempt &&
        attempt.status === 'loading' &&
        activeGeneration === generation &&
        !generation.stopped &&
        !generation.abortController.signal.aborted &&
        generation.canvas.isConnected &&
        generation.canvas.getBoundingClientRect().width > 0 &&
        generation.key === viewportKey(generation.viewport) &&
        generation.viewport.stage.width > 0 &&
        generation.viewport.stage.height > 0;

      const updateSnapshot = (snapshot: MatchResultRuntimeSnapshot) => {
        latestSnapshot = snapshot;

        if (!runtimeHandle || runtimeHandleDisposed) {
          return;
        }

        try {
          runtimeHandle.update(snapshot);
        } catch (error) {
          fail(errorFromUnknown(error, 'Kaplay preview runtime failed.'));
        }
      };

      const startRuntime = (input: KaplayMatchResultRuntimeFactoryInput) => {
        if (attempt.status === 'cancelled' || attempt.status === 'failed') {
          return () => undefined;
        }

        const runtimeStartId = runtimeStartCounter + 1;
        runtimeStartCounter = runtimeStartId;
        const supersededGenerationTeardown = stopGeneration(activeGeneration);

        if (hasReadyRuntime && !currentCycle) {
          beginCycle('replacement');
        }

        const generation: RuntimeGeneration = {
          abortController: new AbortController(),
          canvas: input.canvas,
          disposalComplete: null,
          id: runtimeStartId,
          key: viewportKey(input.initialViewport),
          viewport: input.initialViewport,
          stopped: false,
        };
        activeGeneration = generation;
        const adoptedRuntimeTeardown = disposeAdoptedRuntime();
        const teardownBeforeStart = Promise.all([
          pendingRuntimeTeardownRef.current ?? Promise.resolve(),
          supersededGenerationTeardown,
          adoptedRuntimeTeardown,
        ]).then(() => undefined);
        attempt.status = 'loading';
        updateStateForAttempt('loading', null);

        let localHandleDisposed = false;
        const disposeLocalHandle = (handle: KaplayMatchResultRuntimeHandle) => {
          if (localHandleDisposed) {
            return;
          }

          localHandleDisposed = true;
          try {
            handle.dispose();
          } catch {
            // Obsolete runtime handles should not be able to damage recovery.
          }
          void rememberRuntimeTeardown(handle.disposalComplete);
        };

        const runtimeWork = Promise.resolve().then(async () => {
          await teardownBeforeStart;

          if (!isRuntimeGenerationCurrent(generation)) {
            throw new Error(
              'Kaplay preview attempt was cancelled before runtime initialization.',
            );
          }

          return runtimeFactoryRef.current({
            ...input,
            abortSignal: generation.abortController.signal,
            onDisposalComplete: (disposalComplete) => {
              generation.disposalComplete = disposalComplete;
            },
            remainingInitializationMs: remainingTimeMs(),
          });
        });

        runtimeWork
          .then((handle) => {
            if (!isRuntimeGenerationCurrent(generation)) {
              disposeLocalHandle(handle);
              return;
            }

            try {
              handle.update(latestSnapshot ?? input.initialSnapshot);
            } catch (error) {
              disposeLocalHandle(handle);
              fail(
                errorFromUnknown(
                  error,
                  'Kaplay preview initialization failed.',
                ),
              );
              return;
            }

            if (!isRuntimeGenerationCurrent(generation)) {
              disposeLocalHandle(handle);
              return;
            }

            runtimeHandle = handle;
            runtimeHandleDisposed = false;
            activeGeneration = generation;
            hasReadyRuntime = true;
            attempt.status = 'ready';
            clearCycle();
            updateStateForAttempt('ready', null);
          })
          .catch((error) => {
            if (!isRuntimeGenerationCurrent(generation)) {
              return;
            }

            fail(
              errorFromUnknown(error, 'Kaplay preview initialization failed.'),
            );
          });

        return () => {
          if (activeGeneration !== generation) {
            return;
          }

          stopGeneration(generation);
          disposeAdoptedRuntime();

          if (attempt.status === 'ready') {
            attempt.status = 'loading';
            updateStateForAttempt('loading', null);
          }
        };
      };

      attempt = {
        cancel,
        controller: {
          get deadlineAt() {
            return currentCycle?.deadlineAt ?? 0;
          },
          fail,
          id,
          isCurrent: () =>
            activeAttemptRef.current === attempt &&
            (attempt.status === 'loading' || attempt.status === 'ready'),
          remainingTimeMs,
          startRuntime,
          updateSnapshot,
        },
        fail,
        id,
        retryVersion: attemptRetryVersion,
        sessionKey: attemptSessionKey,
        status: 'loading',
      };

      beginCycle('startup');
      activeAttemptRef.current = attempt;
      setLoadedPreviewState((current) =>
        current?.attemptId === id ? current : null,
      );
      setStoredRuntimeState({
        attemptId: id,
        controller: attempt.controller,
        failure: null,
        retryVersion: attemptRetryVersion,
        sessionKey: attemptSessionKey,
        status: 'loading',
      });

      const loaderWork = Promise.resolve().then(() =>
        previewLoaderRef.current(),
      );

      loaderWork
        .then((Component) => {
          if (!isCurrent()) {
            return;
          }

          setLoadedPreviewState({
            attemptId: id,
            Component,
          });
        })
        .catch((error) => {
          if (!isCurrent()) {
            return;
          }

          fail(
            errorFromUnknown(error, 'Kaplay preview component failed to load.'),
          );
        });
    },
    [],
  );

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

  useEffect(() => {
    if (!projection.shouldAttemptKaplay || runtimeFailure) {
      cancelActiveAttempt(true);
      return;
    }

    const activeAttempt = activeAttemptRef.current;

    if (
      activeAttempt &&
      activeAttempt.sessionKey === sessionKey &&
      activeAttempt.retryVersion === retryVersion &&
      (activeAttempt.status === 'loading' || activeAttempt.status === 'ready')
    ) {
      return;
    }

    startAttempt(sessionKey, retryVersion);
  }, [
    cancelActiveAttempt,
    projection.shouldAttemptKaplay,
    retryVersion,
    runtimeFailure,
    sessionKey,
    startAttempt,
  ]);

  useEffect(
    () => () => {
      cancelActiveAttempt(false);
    },
    [cancelActiveAttempt],
  );

  const selectPreference = useCallback(
    (nextPreference: AnimationPreference) => {
      if (nextPreference === 'on') {
        cancelActiveAttempt(false);
        setStoredRuntimeState((current) => ({
          attemptId: null,
          controller: null,
          failure: null,
          retryVersion:
            current.sessionKey === sessionKey ? current.retryVersion + 1 : 1,
          sessionKey,
          status: 'idle',
        }));
      } else {
        cancelActiveAttempt(true);
        setStoredRuntimeState((current) => ({
          attemptId: null,
          controller: null,
          failure: current.sessionKey === sessionKey ? current.failure : null,
          retryVersion:
            current.sessionKey === sessionKey ? current.retryVersion : 0,
          sessionKey,
          status: 'idle',
        }));
      }

      setPreference(nextPreference);
    },
    [cancelActiveAttempt, sessionKey, setPreference],
  );

  const onRendererError = useCallback((error: Error) => {
    activeAttemptRef.current?.fail(error);
  }, []);

  const retryAnimations = useCallback(() => {
    cancelActiveAttempt(false);
    setStoredRuntimeState((current) => ({
      attemptId: null,
      controller: null,
      failure: null,
      retryVersion:
        current.sessionKey === sessionKey ? current.retryVersion + 1 : 1,
      sessionKey,
      status: 'idle',
    }));
    setPreference('on');
  }, [cancelActiveAttempt, sessionKey, setPreference]);

  const continueWithoutAnimations = useCallback(() => {
    cancelActiveAttempt(true);
    setPreference('off');
    setStoredRuntimeState((current) => ({
      attemptId: null,
      controller: null,
      failure: current.sessionKey === sessionKey ? current.failure : null,
      retryVersion:
        current.sessionKey === sessionKey ? current.retryVersion : 0,
      sessionKey,
      status: 'idle',
    }));
  }, [cancelActiveAttempt, sessionKey, setPreference]);

  const resetKey = `${sessionKey}:${retryVersion}:${runtimeState.attemptId ?? 0}`;
  const PreviewComponent =
    loadedPreviewState?.attemptId === runtimeState.attemptId
      ? loadedPreviewState.Component
      : null;
  const activeAttemptController = runtimeState.controller;
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
    ) : !PreviewComponent || !activeAttemptController ? (
      <KaplayLoadingFallback
        onContinueWithoutAnimations={continueWithoutAnimations}
      />
    ) : (
      <PredictionRendererErrorBoundary
        key={resetKey}
        resetKey={resetKey}
        onError={onRendererError}
      >
        <PreviewComponent
          actions={actions}
          attempt={activeAttemptController}
          state={state}
          testControlsEnabled={previewSettings.testControls}
        />
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
          Animated Match Result is available. Other prediction steps currently
          use the standard experience.
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
