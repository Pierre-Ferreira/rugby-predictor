// @vitest-environment jsdom

import {
  StrictMode,
  act,
  createElement,
  type ComponentType,
  type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PredictionPresentationHost,
  type KaplayMatchResultPreviewLoader,
} from '../../imports/ui/predictions/PredictionPresentationHost';
import { KaplayMatchResultPreview } from '../../imports/ui/predictions/kaplay/KaplayMatchResultPreview';
import type { KaplayMatchResultPreviewProps } from '../../imports/ui/predictions/kaplay/KaplayMatchResultPreview';
import type {
  PredictionSessionActions,
  PredictionSessionRendererState,
} from '../../imports/ui/predictions/predictionSession';
import type {
  KaplayMatchResultRuntimeFactory,
  KaplayMatchResultRuntimeHandle,
  KaplayMatchResultRuntimeFactoryInput,
} from '../../imports/ui/predictions/kaplay/matchResultRuntime';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

interface Deferred<TValue> {
  readonly promise: Promise<TValue>;
  readonly reject: (reason?: unknown) => void;
  readonly resolve: (value: TValue) => void;
}

interface RuntimeRequest {
  readonly deferred: Deferred<KaplayMatchResultRuntimeHandle>;
  readonly input: KaplayMatchResultRuntimeFactoryInput;
}

interface RuntimeController {
  readonly factory: KaplayMatchResultRuntimeFactory;
  readonly requests: RuntimeRequest[];
}

interface LoaderRequest {
  readonly deferred: Deferred<ComponentType<KaplayMatchResultPreviewProps>>;
}

interface LoaderController {
  readonly loader: KaplayMatchResultPreviewLoader;
  readonly requests: LoaderRequest[];
}

interface MountedHost {
  readonly actions: PredictionSessionActions;
  readonly container: HTMLDivElement;
  readonly controller: RuntimeController;
  readonly rerender: (state: PredictionSessionRendererState) => Promise<void>;
  readonly unmount: () => Promise<void>;
}

const mountedHosts: MountedHost[] = [];
const restoreStorageDescriptors: Array<() => void> = [];

afterEach(async () => {
  vi.useRealTimers();

  while (restoreStorageDescriptors.length > 0) {
    restoreStorageDescriptors.pop()?.();
  }

  window.localStorage.clear();

  while (mountedHosts.length > 0) {
    const host = mountedHosts.pop();

    if (host) {
      await host.unmount();
    }
  }
});

const createDeferred = <TValue>(): Deferred<TValue> => {
  let resolve!: (value: TValue) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<TValue>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    promise,
    reject,
    resolve,
  };
};

const createRuntimeController = (): RuntimeController => {
  const requests: RuntimeRequest[] = [];
  const factory: KaplayMatchResultRuntimeFactory = (input) => {
    const deferred = createDeferred<KaplayMatchResultRuntimeHandle>();

    requests.push({
      deferred,
      input,
    });

    return deferred.promise;
  };

  return {
    factory: vi.fn(factory),
    requests,
  };
};

const createLoaderController = (): LoaderController => {
  const requests: LoaderRequest[] = [];
  const loader: KaplayMatchResultPreviewLoader = () => {
    const deferred =
      createDeferred<ComponentType<KaplayMatchResultPreviewProps>>();

    requests.push({
      deferred,
    });

    return deferred.promise;
  };

  return {
    loader: vi.fn(loader),
    requests,
  };
};

const createRuntimeHandle = () => ({
  dispose: vi.fn(),
  update: vi.fn(),
});

const replaceLocalStorage = (descriptor: PropertyDescriptor) => {
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage');

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    ...descriptor,
  });

  restoreStorageDescriptors.push(() => {
    if (original) {
      Object.defineProperty(window, 'localStorage', original);
    }
  });
};

const emptyTeam = () => ({
  conversions: '0',
  dropGoals: '0',
  penaltyKicks: '0',
  redCards: '0',
  tries: '0',
  yellowCards: '0',
});

const rendererState = ({
  fixtureId = 'fixture-1',
  isReadOnly = false,
  matchResult = '',
  stepId = 'match-result',
  userId = 'user-1',
}: {
  readonly fixtureId?: string;
  readonly isReadOnly?: boolean;
  readonly matchResult?: string;
  readonly stepId?: string;
  readonly userId?: string;
} = {}): PredictionSessionRendererState =>
  ({
    activeSteps: [{ id: 'match-result' }, { id: 'tries' }],
    currentStep:
      stepId === 'match-result'
        ? {
            customQuestion: null,
            message: {
              body: 'Choose the result your rugby score will agree with.',
              deduction: 'Wrong result deducts 500 points.',
              heading: 'Who do you think will win?',
              supportingText: [],
            },
            position: { current: 1, total: 2 },
            step: { id: 'match-result' },
            validationMessage: null,
          }
        : {
            customQuestion: null,
            message: {
              body: null,
              deduction: null,
              heading: 'How many tries?',
              supportingText: [],
            },
            position: { current: 2, total: 2 },
            step: { id: stepId },
            validationMessage: null,
          },
    editSession: {
      expectedRevision: 3,
      fixtureId,
      userId,
    },
    fixture: {
      _id: fixtureId,
      team1DisplayName: 'Springboks',
      team2DisplayName: 'All Blacks',
    },
    form: {
      customAnswers: {
        scrum: '7',
      },
      firstTry: '',
      halfTimeLeader: '',
      highestScoringHalf: '',
      matchResult,
      team1: emptyTeam(),
      team2: emptyTeam(),
    },
    isReadOnly,
    isEditingFromReview: false,
    location: { kind: 'step', stepId },
    navigation: {
      canContinue: true,
      canGoBack: true,
      canRequestDiscard: false,
      canReturnToReview: false,
      canSubmit: false,
      continueLabel: 'Continue',
    },
  }) as unknown as PredictionSessionRendererState;

const createActions = (): PredictionSessionActions => ({
  cancelDiscardChanges: vi.fn(),
  changeCustomAnswer: vi.fn(),
  changeTeamNumericField: vi.fn(),
  confirmDiscardChanges: vi.fn(),
  continueForward: vi.fn(),
  editStep: vi.fn(),
  goBack: vi.fn(),
  loadLatestSavedPrediction: vi.fn(),
  requestDiscardChanges: vi.fn(),
  returnToReview: vi.fn(),
  selectBuiltInChoice: vi.fn(),
  startPrediction: vi.fn(),
  submitPrediction: vi.fn(),
});

const renderStandard = (state: PredictionSessionRendererState): ReactNode =>
  createElement(
    'div',
    {
      'data-testid': 'standard-renderer',
    },
    `Standard ${state.form.matchResult || 'blank'} ${
      state.form.customAnswers.scrum ?? ''
    } revision ${state.editSession.expectedRevision ?? 'new'}`,
  );

const renderHost = async (
  state: PredictionSessionRendererState = rendererState(),
  options: {
    readonly initializationTimeoutMs?: number;
    readonly previewComponent?: ComponentType<KaplayMatchResultPreviewProps> | null;
    readonly previewLoader?: KaplayMatchResultPreviewLoader;
    readonly previewSettings?: {
      readonly enabled: boolean;
      readonly testControls: boolean;
    };
    readonly strictMode?: boolean;
  } = {},
): Promise<MountedHost> => {
  const actions = createActions();
  const container = document.createElement('div');
  const controller = createRuntimeController();
  const root = createRoot(container);
  let currentState = state;

  document.body.append(container);

  const paint = async () => {
    await act(async () => {
      const host = createElement(PredictionPresentationHost, {
        actions,
        initializationTimeoutMs: options.initializationTimeoutMs ?? 25,
        previewComponent:
          options.previewComponent === undefined
            ? KaplayMatchResultPreview
            : (options.previewComponent ?? undefined),
        previewLoader: options.previewLoader,
        previewSettings: options.previewSettings ?? {
          enabled: true,
          testControls: false,
        },
        renderStandard: () => renderStandard(currentState),
        runtimeFactory: controller.factory,
        state: currentState,
      });

      root.render(
        options.strictMode ? createElement(StrictMode, null, host) : host,
      );
    });
  };

  await paint();

  const host: MountedHost = {
    actions,
    container,
    controller,
    rerender: async (nextState) => {
      currentState = nextState;
      await paint();
    },
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };

  mountedHosts.push(host);

  return host;
};

const flushReact = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const waitForCondition = async (condition: () => boolean, label: string) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await flushReact();

    if (condition()) {
      return;
    }
  }

  throw new Error(`Timed out waiting for ${label}`);
};

const buttonByText = (container: HTMLElement, text: string) => {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent === text,
  );

  if (!button) {
    throw new Error(`Button "${text}" not found.`);
  }

  return button;
};

const clickButton = async (container: HTMLElement, text: string) => {
  await act(async () => {
    buttonByText(container, text).click();
  });
};

describe('prediction animation preference storage safety', () => {
  it('renders Standard with the preview disabled when localStorage getter throws', async () => {
    replaceLocalStorage({
      get: () => {
        throw new Error('localStorage blocked');
      },
    });

    const host = await renderHost(rendererState(), {
      previewSettings: {
        enabled: false,
        testControls: false,
      },
    });

    expect(host.container.textContent).toContain('Standard blank 7 revision 3');
    expect(host.controller.factory).not.toHaveBeenCalled();
  });

  it('keeps enabled preview interaction safe when storage acquisition throws', async () => {
    replaceLocalStorage({
      get: () => {
        throw new Error('localStorage blocked');
      },
    });

    const host = await renderHost();

    expect(host.container.textContent).toContain('Standard blank 7 revision 3');

    await clickButton(host.container, 'On');
    await waitForCondition(
      () => host.controller.requests.length === 1,
      'runtime request after unavailable storage',
    );

    expect(
      buttonByText(host.container, 'On').getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('keeps an in-memory choice through rerenders when getItem and setItem fail', async () => {
    replaceLocalStorage({
      value: {
        getItem: () => {
          throw new Error('blocked read');
        },
        setItem: () => {
          throw new Error('blocked write');
        },
      },
    });

    const host = await renderHost();

    await clickButton(host.container, 'On');
    await waitForCondition(
      () => host.controller.requests.length === 1,
      'runtime request after failed persistence',
    );

    await host.rerender(rendererState({ matchResult: 'team2' }));

    expect(host.controller.requests).toHaveLength(1);
    expect(
      buttonByText(host.container, 'On').getAttribute('aria-pressed'),
    ).toBe('true');
  });
});

describe('prediction presentation host lifecycle', () => {
  it('defaults to Standard and setup/cleanup/re-setup owns one runtime', async () => {
    const host = await renderHost();

    expect(host.container.textContent).toContain('Standard blank 7 revision 3');
    expect(host.controller.factory).not.toHaveBeenCalled();

    await clickButton(host.container, 'On');
    await waitForCondition(
      () => host.controller.requests.length === 1,
      'first runtime request',
    );
    expect(
      host.container.querySelector('[data-testid="standard-renderer"]'),
    ).toBeNull();

    const firstHandle = createRuntimeHandle();
    await act(async () => {
      host.controller.requests[0].deferred.resolve(firstHandle);
      await Promise.resolve();
    });
    expect(firstHandle.update).toHaveBeenCalled();

    await host.rerender(rendererState({ matchResult: 'team2' }));
    expect(firstHandle.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pickedLabel: 'All Blacks',
      }),
    );

    await clickButton(host.container, 'Off');
    expect(firstHandle.dispose).toHaveBeenCalledTimes(1);
    expect(host.container.textContent).toContain('Standard team2 7 revision 3');

    await clickButton(host.container, 'On');
    await waitForCondition(
      () => host.controller.requests.length === 2,
      'second runtime request',
    );
  });

  it('ignores late initialization and stale callbacks after switching Off', async () => {
    const host = await renderHost();

    await clickButton(host.container, 'On');
    await waitForCondition(
      () => host.controller.requests.length === 1,
      'runtime request',
    );
    const request = host.controller.requests[0];

    await clickButton(host.container, 'Off');
    expect(host.container.textContent).toContain('Standard blank 7 revision 3');

    const lateHandle = createRuntimeHandle();
    await act(async () => {
      request.deferred.resolve(lateHandle);
      await Promise.resolve();
    });

    expect(lateHandle.dispose).toHaveBeenCalledTimes(1);

    await act(async () => {
      request.input.onSelect('team2');
    });

    expect(host.actions.selectBuiltInChoice).not.toHaveBeenCalled();
  });

  it('falls back after runtime failure and retries only after explicit action', async () => {
    const host = await renderHost();

    await clickButton(host.container, 'On');
    await waitForCondition(
      () => host.controller.requests.length === 1,
      'runtime request',
    );
    const handle = createRuntimeHandle();
    await act(async () => {
      host.controller.requests[0].deferred.resolve(handle);
      await Promise.resolve();
    });

    await act(async () => {
      host.controller.requests[0].input.onFailure(new Error('boom'));
    });

    expect(host.container.textContent).toContain(
      "Animations couldn't continue. Your answers have been kept.",
    );
    expect(host.container.textContent).toContain('Standard blank 7 revision 3');

    await host.rerender(rendererState({ matchResult: 'team1' }));
    expect(host.controller.requests).toHaveLength(1);
    expect(host.container.textContent).toContain('Standard team1 7 revision 3');

    await clickButton(host.container, 'Retry animations');
    await waitForCondition(
      () => host.controller.requests.length === 2,
      'retry runtime request',
    );
  });

  it('times out pending initialization through the bounded fallback path', async () => {
    vi.useFakeTimers();
    const host = await renderHost();

    await clickButton(host.container, 'On');
    await waitForCondition(
      () => host.controller.requests.length === 1,
      'runtime request',
    );

    await act(async () => {
      vi.advanceTimersByTime(26);
      await Promise.resolve();
    });

    expect(host.container.textContent).toContain(
      "Animations couldn't continue. Your answers have been kept.",
    );
    expect(host.container.textContent).toContain('Standard blank 7 revision 3');

    const lateHandle = createRuntimeHandle();
    await act(async () => {
      host.controller.requests[0].deferred.resolve(lateHandle);
      await Promise.resolve();
    });

    expect(lateHandle.dispose).toHaveBeenCalledTimes(1);
    expect(lateHandle.update).not.toHaveBeenCalled();
  });

  it('falls back and disposes when the initial runtime update fails during adoption', async () => {
    const host = await renderHost();

    await clickButton(host.container, 'On');
    await waitForCondition(
      () => host.controller.requests.length === 1,
      'runtime request',
    );

    const handle = createRuntimeHandle();
    handle.update.mockImplementationOnce(() => {
      throw new Error('adoption update failed');
    });

    await act(async () => {
      host.controller.requests[0].deferred.resolve(handle);
      await Promise.resolve();
    });
    await waitForCondition(
      () =>
        host.container.textContent?.includes(
          "Animations couldn't continue. Your answers have been kept.",
        ) === true,
      'fallback after failed adoption update',
    );

    expect(handle.dispose).toHaveBeenCalledTimes(1);
    expect(host.container.textContent).toContain('Standard blank 7 revision 3');

    await host.rerender(rendererState({ matchResult: 'team1' }));

    expect(host.controller.requests).toHaveLength(1);
    expect(host.container.textContent).toContain('Standard team1 7 revision 3');
  });

  it('falls back and disposes when a ready runtime snapshot update fails', async () => {
    const host = await renderHost();

    await clickButton(host.container, 'On');
    await waitForCondition(
      () => host.controller.requests.length === 1,
      'runtime request',
    );

    const handle = createRuntimeHandle();
    await act(async () => {
      host.controller.requests[0].deferred.resolve(handle);
      await Promise.resolve();
    });
    expect(handle.update).toHaveBeenCalledTimes(1);

    handle.update.mockImplementationOnce(() => {
      throw new Error('snapshot update failed');
    });

    await host.rerender(rendererState({ matchResult: 'team2' }));
    await waitForCondition(
      () =>
        host.container.textContent?.includes(
          "Animations couldn't continue. Your answers have been kept.",
        ) === true,
      'fallback after ready snapshot update failure',
    );

    expect(handle.dispose).toHaveBeenCalledTimes(1);
    expect(host.container.textContent).toContain('Standard team2 7 revision 3');
  });

  it('does not revive a timeout after switching Off before readiness', async () => {
    vi.useFakeTimers();
    const host = await renderHost();

    await clickButton(host.container, 'On');
    await waitForCondition(
      () => host.controller.requests.length === 1,
      'runtime request',
    );
    const request = host.controller.requests[0];

    await clickButton(host.container, 'Off');

    await act(async () => {
      vi.advanceTimersByTime(30);
      await Promise.resolve();
    });

    expect(host.container.textContent).not.toContain(
      "Animations couldn't continue.",
    );
    expect(host.container.textContent).toContain('Standard blank 7 revision 3');

    const lateHandle = createRuntimeHandle();
    await act(async () => {
      request.deferred.resolve(lateHandle);
      await Promise.resolve();
    });

    expect(lateHandle.dispose).toHaveBeenCalledTimes(1);
  });

  it('handles late rejection after cancellation without stale failure UI', async () => {
    const host = await renderHost();

    await clickButton(host.container, 'On');
    await waitForCondition(
      () => host.controller.requests.length === 1,
      'runtime request',
    );
    const request = host.controller.requests[0];

    await clickButton(host.container, 'Off');

    await act(async () => {
      request.deferred.reject(new Error('late rejection'));
      await Promise.resolve();
    });

    expect(host.container.textContent).not.toContain(
      "Animations couldn't continue.",
    );
    expect(host.container.textContent).toContain('Standard blank 7 revision 3');
  });

  it('keeps a retry attempt healthy when an older timed-out handle resolves', async () => {
    vi.useFakeTimers();
    const host = await renderHost();

    await clickButton(host.container, 'On');
    await waitForCondition(
      () => host.controller.requests.length === 1,
      'first runtime request',
    );
    const firstRequest = host.controller.requests[0];

    await act(async () => {
      vi.advanceTimersByTime(26);
      await Promise.resolve();
    });

    await clickButton(host.container, 'Retry animations');
    await waitForCondition(
      () => host.controller.requests.length === 2,
      'retry runtime request',
    );

    const secondHandle = createRuntimeHandle();
    await act(async () => {
      host.controller.requests[1].deferred.resolve(secondHandle);
      await Promise.resolve();
    });

    const lateFirstHandle = createRuntimeHandle();
    await act(async () => {
      firstRequest.deferred.resolve(lateFirstHandle);
      await Promise.resolve();
    });

    expect(lateFirstHandle.dispose).toHaveBeenCalledTimes(1);
    expect(secondHandle.dispose).not.toHaveBeenCalled();

    await act(async () => {
      host.controller.requests[1].input.onSelect('team2');
      firstRequest.input.onSelect('team1');
    });

    expect(host.actions.selectBuiltInChoice).toHaveBeenCalledTimes(1);
    expect(host.actions.selectBuiltInChoice).toHaveBeenCalledWith(
      'matchResult',
      'team2',
    );
  });

  it('disposes a ready runtime once on unmount and clears its deadline', async () => {
    vi.useFakeTimers();
    const host = await renderHost();

    await clickButton(host.container, 'On');
    await waitForCondition(
      () => host.controller.requests.length === 1,
      'runtime request',
    );

    const handle = createRuntimeHandle();
    await act(async () => {
      host.controller.requests[0].deferred.resolve(handle);
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(30);
      await Promise.resolve();
    });

    expect(host.container.textContent).not.toContain(
      "Animations couldn't continue.",
    );
    expect(handle.dispose).not.toHaveBeenCalled();

    await host.unmount();

    await act(async () => {
      vi.advanceTimersByTime(30);
      await Promise.resolve();
    });

    expect(handle.dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps the surviving StrictMode setup healthy and disposes obsolete resources', async () => {
    const host = await renderHost(rendererState(), {
      strictMode: true,
    });

    await clickButton(host.container, 'On');
    await waitForCondition(
      () => host.controller.requests.length === 2,
      'StrictMode runtime replay',
    );

    const survivingHandle = createRuntimeHandle();
    await act(async () => {
      host.controller.requests[1].deferred.resolve(survivingHandle);
      await Promise.resolve();
    });

    const obsoleteHandle = createRuntimeHandle();
    await act(async () => {
      host.controller.requests[0].deferred.resolve(obsoleteHandle);
      await Promise.resolve();
    });

    expect(obsoleteHandle.dispose).toHaveBeenCalledTimes(1);
    expect(survivingHandle.dispose).not.toHaveBeenCalled();
    expect(
      host.container.querySelector('[data-testid="kaplay-match-result-stage"]'),
    ).not.toBeNull();
  });
});

describe('prediction presentation outer loader ownership', () => {
  it('times out a never-resolving outer loader before preview mount', async () => {
    vi.useFakeTimers();
    const loader = createLoaderController();
    const host = await renderHost(rendererState(), {
      previewComponent: null,
      previewLoader: loader.loader,
    });

    await clickButton(host.container, 'On');
    await waitForCondition(
      () => loader.requests.length === 1,
      'outer loader request',
    );

    expect(host.controller.requests).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(26);
      await Promise.resolve();
    });

    expect(host.container.textContent).toContain(
      "Animations couldn't continue. Your answers have been kept.",
    );
    expect(host.container.textContent).toContain('Standard blank 7 revision 3');

    await act(async () => {
      loader.requests[0].deferred.resolve(KaplayMatchResultPreview);
      await Promise.resolve();
    });

    expect(host.controller.requests).toHaveLength(0);
    expect(host.container.textContent).toContain('Standard blank 7 revision 3');
  });

  it('invokes the outer loader again on explicit retry and can recover', async () => {
    const loader = createLoaderController();
    const host = await renderHost(rendererState(), {
      previewComponent: null,
      previewLoader: loader.loader,
    });

    await clickButton(host.container, 'On');
    await waitForCondition(
      () => loader.requests.length === 1,
      'first loader request',
    );

    await act(async () => {
      loader.requests[0].deferred.reject(new Error('recoverable load failure'));
      await Promise.resolve();
    });

    expect(host.container.textContent).toContain(
      "Animations couldn't continue. Your answers have been kept.",
    );

    await clickButton(host.container, 'Retry animations');
    await waitForCondition(
      () => loader.requests.length === 2,
      'retry loader request',
    );

    await act(async () => {
      loader.requests[1].deferred.resolve(KaplayMatchResultPreview);
      await Promise.resolve();
    });
    await waitForCondition(
      () => host.controller.requests.length === 1,
      'runtime request after recovered load',
    );

    const handle = createRuntimeHandle();
    await act(async () => {
      host.controller.requests[0].deferred.resolve(handle);
      await Promise.resolve();
    });

    expect(
      host.container.querySelector('[data-testid="kaplay-match-result-stage"]'),
    ).not.toBeNull();
    expect(loader.loader).toHaveBeenCalledTimes(2);
  });

  it('spends outer load time from the same end-to-end deadline', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T08:00:00.000Z'));
    const loader = createLoaderController();
    const host = await renderHost(rendererState(), {
      initializationTimeoutMs: 100,
      previewComponent: null,
      previewLoader: loader.loader,
    });

    await clickButton(host.container, 'On');
    await waitForCondition(
      () => loader.requests.length === 1,
      'outer loader request',
    );

    await act(async () => {
      vi.advanceTimersByTime(40);
      loader.requests[0].deferred.resolve(KaplayMatchResultPreview);
      await Promise.resolve();
    });
    await waitForCondition(
      () => host.controller.requests.length === 1,
      'runtime request after delayed load',
    );

    expect(host.controller.requests[0].input.remainingInitializationMs).toBe(
      60,
    );

    await host.rerender(rendererState({ matchResult: 'team2' }));
    await act(async () => {
      vi.advanceTimersByTime(20);
      await Promise.resolve();
    });

    expect(loader.loader).toHaveBeenCalledTimes(1);
    expect(host.controller.requests).toHaveLength(1);
  });
});
