// @vitest-environment jsdom

import {
  StrictMode,
  act,
  createElement,
  useLayoutEffect,
  useRef,
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
  MatchResultRuntimeSnapshot,
} from '../../imports/ui/predictions/kaplay/matchResultRuntime';
import {
  MATCH_RESULT_SCENE_HEIGHT,
  MATCH_RESULT_SCENE_WIDTH,
  projectMatchResultLayout,
} from '../../imports/ui/predictions/kaplay/matchResultMotion';
import {
  animationPreferenceStorageKey,
  type AnimationPreference,
} from '../../imports/ui/predictions/presentationPreference';

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
const restoreGeometryDescriptors: Array<() => void> = [];
const restoreStorageDescriptors: Array<() => void> = [];
const restoreMatchMediaDescriptors: Array<() => void> = [];
let kaplayGeometryInstalled = false;

afterEach(async () => {
  vi.useRealTimers();

  while (restoreStorageDescriptors.length > 0) {
    restoreStorageDescriptors.pop()?.();
  }

  while (restoreGeometryDescriptors.length > 0) {
    restoreGeometryDescriptors.pop()?.();
  }

  while (restoreMatchMediaDescriptors.length > 0) {
    restoreMatchMediaDescriptors.pop()?.();
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

const controlledRuntimeSnapshot = (
  selected: 'draw' | 'team1' | 'team2' | null = null,
): MatchResultRuntimeSnapshot => ({
  canSelect: true,
  choicePresentation: selected ? 'selected' : 'choices',
  choices: [
    {
      label: 'Springboks',
      selected: selected === 'team1',
      value: 'team1',
    },
    {
      label: 'All Blacks',
      selected: selected === 'team2',
      value: 'team2',
    },
    {
      label: 'Draw',
      selected: selected === 'draw',
      value: 'draw',
    },
  ],
  deduction: null,
  focusedValue: null,
  helperText: null,
  pickedLabel:
    selected === 'team1'
      ? 'Springboks'
      : selected === 'team2'
        ? 'All Blacks'
        : selected === 'draw'
          ? 'Draw'
          : null,
  question: 'Who do you think will win?',
  selectionEffectId: selected ? 1 : 0,
  sessionKey: 'controlled-session',
  supportingText: [],
});

const controlledRuntimeInput = (
  canvas: HTMLCanvasElement,
  stage: { readonly height: number; readonly width: number },
  selected: 'draw' | 'team1' | 'team2' | null = null,
): KaplayMatchResultRuntimeFactoryInput => ({
  canvas,
  initialSnapshot: controlledRuntimeSnapshot(selected),
  initialViewport: {
    cssWidth: stage.width,
    stage: {
      height: stage.height,
      width: stage.width,
      x: 0,
      y: 0,
    },
  },
  isSelectionAllowed: () => true,
  onFailure: vi.fn(),
  onSelect: vi.fn(),
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

const replaceMatchMedia = (matches: boolean) => {
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      matches,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });

  restoreMatchMediaDescriptors.push(() => {
    if (original) {
      Object.defineProperty(window, 'matchMedia', original);
    } else {
      delete (window as { matchMedia?: Window['matchMedia'] }).matchMedia;
    }
  });
};

const storeAnimationPreference = (preference: AnimationPreference) => {
  window.localStorage.setItem(animationPreferenceStorageKey, preference);
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
  messageHeading = 'Who do you think will win?',
  stepId = 'match-result',
  team1DisplayName = 'Springboks',
  team2DisplayName = 'All Blacks',
  userId = 'user-1',
}: {
  readonly fixtureId?: string;
  readonly isReadOnly?: boolean;
  readonly matchResult?: string;
  readonly messageHeading?: string;
  readonly stepId?: string;
  readonly team1DisplayName?: string;
  readonly team2DisplayName?: string;
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
              heading: messageHeading,
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
      team1DisplayName,
      team2DisplayName,
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
  if (!kaplayGeometryInstalled) {
    installKaplayMeasurementHarness(MATCH_RESULT_SCENE_WIDTH);
  }

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

const domRectForSize = (width: number, height: number): DOMRect =>
  ({
    bottom: height,
    height,
    left: 0,
    right: width,
    toJSON: () => ({ height, width, x: 0, y: 0 }),
    top: 0,
    width,
    x: 0,
    y: 0,
  }) as DOMRect;

const parseAspectRatio = (value: string) => {
  const [rawWidth, rawHeight] = value.split('/').map((part) => Number(part));

  return Number.isFinite(rawWidth) &&
    Number.isFinite(rawHeight) &&
    rawWidth > 0 &&
    rawHeight > 0
    ? { height: rawHeight, width: rawWidth }
    : { height: MATCH_RESULT_SCENE_HEIGHT, width: MATCH_RESULT_SCENE_WIDTH };
};

const installKaplayMeasurementHarness = (initialWidth: number) => {
  const original = HTMLElement.prototype.getBoundingClientRect;
  let shellWidth = initialWidth;

  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: HTMLElement) {
      const containsKaplayCanvas = Boolean(
        this.querySelector?.('[data-testid="kaplay-match-result-canvas"]'),
      );
      const isKaplayCanvas =
        this.getAttribute?.('data-testid') === 'kaplay-match-result-canvas';

      if (isKaplayCanvas) {
        const aspect = parseAspectRatio(this.style.aspectRatio);

        return domRectForSize(
          shellWidth,
          (shellWidth * aspect.height) / aspect.width,
        );
      }

      if (containsKaplayCanvas) {
        return domRectForSize(shellWidth, shellWidth);
      }

      return original.call(this);
    },
  });

  restoreGeometryDescriptors.push(() => {
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: original,
    });
    kaplayGeometryInstalled = false;
  });
  kaplayGeometryInstalled = true;

  return {
    setWidth: async (nextWidth: number) => {
      shellWidth = nextWidth;

      await act(async () => {
        window.dispatchEvent(new Event('resize'));
        await Promise.resolve();
      });
    },
  };
};

const longTeamNames = {
  team1DisplayName: 'Cape Town Very Long Club Name ccpp009c3a XV',
  team2DisplayName: 'Johannesburg Equally Long Club Name ccpp009c3b XV',
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

  it('defaults to On in memory when storage acquisition throws', async () => {
    replaceLocalStorage({
      get: () => {
        throw new Error('localStorage blocked');
      },
    });

    const host = await renderHost();

    await waitForCondition(
      () => host.controller.requests.length === 1,
      'runtime request after unavailable storage',
    );

    expect(
      buttonByText(host.container, 'On').getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('keeps an in-memory Off choice through rerenders when getItem and setItem fail', async () => {
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

    await waitForCondition(
      () => host.controller.requests.length === 1,
      'default runtime request after failed persistence read',
    );
    await clickButton(host.container, 'Off');

    await host.rerender(rendererState({ matchResult: 'team2' }));

    expect(host.controller.requests).toHaveLength(1);
    expect(
      buttonByText(host.container, 'Off').getAttribute('aria-pressed'),
    ).toBe('true');
    expect(host.container.textContent).toContain('Standard team2 7 revision 3');
  });
});

describe('prediction presentation host default policy', () => {
  it('respects explicit stored Off until the player chooses On', async () => {
    storeAnimationPreference('off');
    const host = await renderHost(rendererState({ matchResult: 'team1' }));

    expect(host.container.textContent).toContain('Standard team1 7 revision 3');
    expect(host.controller.factory).not.toHaveBeenCalled();
    expect(
      buttonByText(host.container, 'Off').getAttribute('aria-pressed'),
    ).toBe('true');

    await clickButton(host.container, 'On');
    await waitForCondition(
      () => host.controller.requests.length === 1,
      'runtime request after explicit On',
    );
    expect(host.container.textContent).not.toContain(
      'Standard team1 7 revision 3',
    );
  });

  it('uses Standard for reduced motion without clearing the On preference', async () => {
    replaceMatchMedia(true);

    const host = await renderHost();

    expect(host.container.textContent).toContain('Standard blank 7 revision 3');
    expect(host.controller.factory).not.toHaveBeenCalled();
    expect(host.container.textContent).toContain(
      'Your device/browser preference keeps animations off.',
    );
    expect(
      buttonByText(host.container, 'On').getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('uses Standard for unsupported and read-only steps without initializing Kaplay', async () => {
    const unsupportedHost = await renderHost(
      rendererState({ stepId: 'tries' }),
    );

    expect(unsupportedHost.container.textContent).toContain(
      'Standard blank 7 revision 3',
    );
    expect(unsupportedHost.container.textContent).toContain(
      'This step uses the standard experience.',
    );
    expect(unsupportedHost.controller.factory).not.toHaveBeenCalled();

    const readOnlyHost = await renderHost(rendererState({ isReadOnly: true }));

    expect(readOnlyHost.container.textContent).toContain(
      'Standard blank 7 revision 3',
    );
    expect(readOnlyHost.controller.factory).not.toHaveBeenCalled();
  });

  it('keeps test controls disabled for ordinary development unless explicitly enabled', async () => {
    const ordinaryHost = await renderHost();

    await waitForCondition(
      () => ordinaryHost.controller.requests.length === 1,
      'ordinary development runtime request',
    );
    expect(ordinaryHost.controller.requests[0].input.testControlsEnabled).toBe(
      false,
    );

    const isolatedHost = await renderHost(
      rendererState({ fixtureId: 'fixture-2' }),
      {
        previewSettings: {
          enabled: true,
          testControls: true,
        },
      },
    );

    await waitForCondition(
      () => isolatedHost.controller.requests.length === 1,
      'isolated test runtime request',
    );
    expect(isolatedHost.controller.requests[0].input.testControlsEnabled).toBe(
      true,
    );
  });
});

describe('prediction presentation host lifecycle', () => {
  it('uses default On for supported Match Result and setup/cleanup/re-setup owns one runtime', async () => {
    const host = await renderHost();

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

  it('keeps one ready runtime across Match Result selection updates until the attempt ends', async () => {
    const host = await renderHost(rendererState());

    await waitForCondition(
      () => host.controller.requests.length === 1,
      'first runtime request',
    );

    const firstRequest = host.controller.requests[0];
    const firstHandle = createRuntimeHandle();

    await act(async () => {
      firstRequest.deferred.resolve(firstHandle);
      await Promise.resolve();
    });

    expect(firstHandle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        choicePresentation: 'choices',
        selectionEffectId: 0,
      }),
    );

    await act(async () => {
      firstRequest.input.onSelect('team2');
      await Promise.resolve();
    });
    expect(host.actions.selectBuiltInChoice).toHaveBeenCalledWith(
      'matchResult',
      'team2',
    );
    expect(host.controller.requests).toHaveLength(1);
    expect(firstHandle.dispose).not.toHaveBeenCalled();

    await host.rerender(rendererState({ matchResult: 'team2' }));
    expect(host.controller.requests).toHaveLength(1);
    expect(firstHandle.dispose).not.toHaveBeenCalled();
    expect(firstHandle.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        choicePresentation: 'selected',
        pickedLabel: 'All Blacks',
        selectionEffectId: 1,
      }),
    );

    const selectedUpdateCount = firstHandle.update.mock.calls.length;

    await host.rerender(rendererState({ matchResult: 'team2' }));
    expect(host.controller.requests).toHaveLength(1);
    expect(firstHandle.dispose).not.toHaveBeenCalled();
    expect(firstHandle.update).toHaveBeenCalledTimes(selectedUpdateCount + 1);
    expect(firstHandle.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        choicePresentation: 'selected',
        pickedLabel: 'All Blacks',
        selectionEffectId: 1,
      }),
    );

    await clickButton(host.container, 'Change my selection');
    expect(host.controller.requests).toHaveLength(1);
    expect(firstHandle.dispose).not.toHaveBeenCalled();
    expect(firstHandle.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        choicePresentation: 'choices',
        selectionEffectId: 1,
      }),
    );

    await act(async () => {
      firstRequest.input.onSelect('draw');
      await Promise.resolve();
    });
    await host.rerender(rendererState({ matchResult: 'draw' }));
    expect(host.controller.requests).toHaveLength(1);
    expect(firstHandle.dispose).not.toHaveBeenCalled();
    expect(firstHandle.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        choicePresentation: 'selected',
        pickedLabel: 'Draw',
        selectionEffectId: 2,
      }),
    );

    await clickButton(host.container, 'Off');
    expect(firstHandle.dispose).toHaveBeenCalledTimes(1);
    expect(host.container.textContent).toContain('Standard draw 7 revision 3');

    await clickButton(host.container, 'On');
    await waitForCondition(
      () => host.controller.requests.length === 2,
      'new runtime request after ending the first attempt',
    );

    const secondHandle = createRuntimeHandle();
    await act(async () => {
      host.controller.requests[1].deferred.resolve(secondHandle);
      await Promise.resolve();
    });

    expect(secondHandle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        choicePresentation: 'selected',
        pickedLabel: 'Draw',
      }),
    );
    expect(firstHandle.dispose).toHaveBeenCalledTimes(1);
  });

  it('replaces only the runtime when measured layout crosses desktop and compact stages', async () => {
    const geometry = installKaplayMeasurementHarness(MATCH_RESULT_SCENE_WIDTH);
    const host = await renderHost(rendererState(longTeamNames));

    await waitForCondition(
      () => host.controller.requests.length === 1,
      'desktop runtime request',
    );

    const firstRequest = host.controller.requests[0];
    const desktopProjection = projectMatchResultLayout(
      firstRequest.input.initialSnapshot,
      MATCH_RESULT_SCENE_WIDTH,
    );

    expect(firstRequest.input.initialViewport.stage).toEqual(
      desktopProjection.stage,
    );

    const firstHandle = createRuntimeHandle();
    await act(async () => {
      firstRequest.deferred.resolve(firstHandle);
      await Promise.resolve();
    });

    await geometry.setWidth(390);
    await waitForCondition(
      () => host.controller.requests.length === 2,
      'compact replacement request',
    );

    const compactRequest = host.controller.requests[1];
    const compactProjection = projectMatchResultLayout(
      compactRequest.input.initialSnapshot,
      390,
    );

    expect(compactProjection.stage.height).toBeGreaterThan(
      desktopProjection.stage.height,
    );
    expect(compactRequest.input.initialViewport.stage).toEqual(
      compactProjection.stage,
    );
    expect(firstHandle.dispose).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstRequest.input.onSelect('team1');
    });
    expect(host.actions.selectBuiltInChoice).not.toHaveBeenCalled();

    const compactHandle = createRuntimeHandle();
    await act(async () => {
      compactRequest.deferred.resolve(compactHandle);
      await Promise.resolve();
    });

    await act(async () => {
      compactRequest.input.onSelect('team2');
      await Promise.resolve();
    });
    expect(host.actions.selectBuiltInChoice).toHaveBeenCalledTimes(1);
    expect(host.actions.selectBuiltInChoice).toHaveBeenCalledWith(
      'matchResult',
      'team2',
    );

    await host.rerender(
      rendererState({
        ...longTeamNames,
        matchResult: 'team2',
      }),
    );
    expect(host.controller.requests).toHaveLength(2);
    expect(compactHandle.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        choicePresentation: 'selected',
        pickedLabel: longTeamNames.team2DisplayName,
        selectionEffectId: 1,
      }),
    );

    await geometry.setWidth(MATCH_RESULT_SCENE_WIDTH);
    await waitForCondition(
      () => host.controller.requests.length === 3,
      'desktop replacement request',
    );

    const finalRequest = host.controller.requests[2];
    const finalDesktopProjection = projectMatchResultLayout(
      finalRequest.input.initialSnapshot,
      MATCH_RESULT_SCENE_WIDTH,
    );

    expect(finalRequest.input.initialViewport.stage).toEqual(
      finalDesktopProjection.stage,
    );
    expect(compactHandle.dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps compact-to-compact width changes on the existing runtime when logical stage dimensions stay equal', async () => {
    const geometry = installKaplayMeasurementHarness(MATCH_RESULT_SCENE_WIDTH);
    const host = await renderHost(rendererState(longTeamNames));

    await waitForCondition(
      () => host.controller.requests.length === 1,
      'desktop runtime request',
    );

    const desktopHandle = createRuntimeHandle();
    await act(async () => {
      host.controller.requests[0].deferred.resolve(desktopHandle);
      await Promise.resolve();
    });

    await geometry.setWidth(390);
    await waitForCondition(
      () => host.controller.requests.length === 2,
      'compact runtime request',
    );

    const compactRequest = host.controller.requests[1];
    const compactHandle = createRuntimeHandle();
    await act(async () => {
      compactRequest.deferred.resolve(compactHandle);
      await Promise.resolve();
    });

    const compactStageAt390 = compactRequest.input.initialViewport.stage;
    const compactStageAt360 = projectMatchResultLayout(
      compactRequest.input.initialSnapshot,
      360,
    ).stage;

    expect(compactStageAt360).toEqual(compactStageAt390);

    await geometry.setWidth(360);
    await flushReact();

    expect(host.controller.requests).toHaveLength(2);
    expect(compactHandle.dispose).not.toHaveBeenCalled();
  });

  it('updates snapshots for focus and message changes without recreating unchanged geometry', async () => {
    const geometry = installKaplayMeasurementHarness(MATCH_RESULT_SCENE_WIDTH);
    const host = await renderHost(rendererState(longTeamNames));

    await waitForCondition(
      () => host.controller.requests.length === 1,
      'runtime request',
    );

    const handle = createRuntimeHandle();
    await act(async () => {
      host.controller.requests[0].deferred.resolve(handle);
      await Promise.resolve();
    });

    const team2Input = host.container.querySelector<HTMLInputElement>(
      'input[value="team2"]',
    );

    await act(async () => {
      team2Input?.focus();
      await Promise.resolve();
    });

    expect(host.controller.requests).toHaveLength(1);
    expect(handle.dispose).not.toHaveBeenCalled();
    expect(handle.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        focusedValue: 'team2',
      }),
    );

    await host.rerender(
      rendererState({
        ...longTeamNames,
        messageHeading: 'Which result survives the final whistle?',
      }),
    );
    await geometry.setWidth(MATCH_RESULT_SCENE_WIDTH);

    expect(host.controller.requests).toHaveLength(1);
    expect(handle.dispose).not.toHaveBeenCalled();
    expect(handle.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        question: 'Which result survives the final whistle?',
      }),
    );
  });

  it('disposes obsolete replacement handles once and treats Off during replacement as safe cancellation', async () => {
    const geometry = installKaplayMeasurementHarness(MATCH_RESULT_SCENE_WIDTH);
    const host = await renderHost(rendererState(longTeamNames));

    await waitForCondition(
      () => host.controller.requests.length === 1,
      'runtime request',
    );

    const firstHandle = createRuntimeHandle();
    await act(async () => {
      host.controller.requests[0].deferred.resolve(firstHandle);
      await Promise.resolve();
    });

    await geometry.setWidth(390);
    await waitForCondition(
      () => host.controller.requests.length === 2,
      'pending compact replacement',
    );

    expect(firstHandle.dispose).toHaveBeenCalledTimes(1);

    await clickButton(host.container, 'Off');
    expect(host.container.textContent).toContain('Standard blank 7 revision 3');

    const lateReplacementHandle = createRuntimeHandle();
    await act(async () => {
      host.controller.requests[1].deferred.resolve(lateReplacementHandle);
      await Promise.resolve();
    });

    expect(lateReplacementHandle.dispose).toHaveBeenCalledTimes(1);
    expect(firstHandle.dispose).toHaveBeenCalledTimes(1);
    expect(host.container.textContent).not.toContain(
      "Animations couldn't continue.",
    );
  });

  it('repairs a late initial measurement and preserves selection while resizing during a shove', async () => {
    const geometry = installKaplayMeasurementHarness(390);
    const host = await renderHost(rendererState(longTeamNames));

    await waitForCondition(
      () => host.controller.requests.length === 1,
      'compact runtime after late measurement',
    );

    const compactRequest = host.controller.requests[0];
    expect(compactRequest.input.initialViewport.stage).toEqual(
      projectMatchResultLayout(compactRequest.input.initialSnapshot, 390).stage,
    );

    const compactHandle = createRuntimeHandle();
    await act(async () => {
      compactRequest.deferred.resolve(compactHandle);
      await Promise.resolve();
    });

    await act(async () => {
      compactRequest.input.onSelect('draw');
      await Promise.resolve();
    });
    await host.rerender(
      rendererState({
        ...longTeamNames,
        matchResult: 'draw',
      }),
    );
    expect(host.actions.selectBuiltInChoice).toHaveBeenCalledTimes(1);
    expect(compactHandle.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        choicePresentation: 'selected',
        pickedLabel: 'Draw',
        selectionEffectId: 1,
      }),
    );

    await geometry.setWidth(MATCH_RESULT_SCENE_WIDTH);
    await waitForCondition(
      () => host.controller.requests.length === 2,
      'desktop replacement after selected compact state',
    );

    const desktopReplacement = host.controller.requests[1];

    expect(desktopReplacement.input.initialSnapshot).toEqual(
      expect.objectContaining({
        choicePresentation: 'selected',
        pickedLabel: 'Draw',
        selectionEffectId: 1,
      }),
    );
    expect(host.actions.selectBuiltInChoice).toHaveBeenCalledTimes(1);
    expect(compactHandle.dispose).toHaveBeenCalledTimes(1);

    const desktopHandle = createRuntimeHandle();
    await act(async () => {
      desktopReplacement.deferred.resolve(desktopHandle);
      await Promise.resolve();
    });

    expect(host.actions.selectBuiltInChoice).toHaveBeenCalledTimes(1);
  });

  it('gives a post-ready replacement a fresh bounded budget long after initial startup', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-19T08:00:00.000Z'));
    const geometry = installKaplayMeasurementHarness(MATCH_RESULT_SCENE_WIDTH);
    const host = await renderHost(rendererState(longTeamNames), {
      initializationTimeoutMs: 100,
    });

    await waitForCondition(
      () => host.controller.requests.length === 1,
      'initial runtime request',
    );

    const firstHandle = createRuntimeHandle();
    await act(async () => {
      host.controller.requests[0].deferred.resolve(firstHandle);
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    await geometry.setWidth(390);
    await waitForCondition(
      () => host.controller.requests.length === 2,
      'replacement runtime request',
    );

    expect(
      host.controller.requests[1].input.remainingInitializationMs,
    ).toBeGreaterThan(0);
    expect(
      host.controller.requests[1].input.remainingInitializationMs,
    ).toBeLessThanOrEqual(100);

    const replacementHandle = createRuntimeHandle();
    await act(async () => {
      host.controller.requests[1].deferred.resolve(replacementHandle);
      await Promise.resolve();
    });

    expect(host.container.textContent).not.toContain(
      "Animations couldn't continue.",
    );
    expect(replacementHandle.update).toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(150);
      await Promise.resolve();
    });

    expect(host.container.textContent).not.toContain(
      "Animations couldn't continue.",
    );
  });

  it('falls back when a replacement stalls and disposes its late handle once', async () => {
    vi.useFakeTimers();
    const geometry = installKaplayMeasurementHarness(MATCH_RESULT_SCENE_WIDTH);
    const host = await renderHost(
      rendererState({
        ...longTeamNames,
        matchResult: 'team2',
      }),
      {
        initializationTimeoutMs: 100,
      },
    );

    await waitForCondition(
      () => host.controller.requests.length === 1,
      'initial runtime request',
    );

    const firstHandle = createRuntimeHandle();
    await act(async () => {
      host.controller.requests[0].deferred.resolve(firstHandle);
      await Promise.resolve();
    });

    await geometry.setWidth(390);
    await waitForCondition(
      () => host.controller.requests.length === 2,
      'pending replacement request',
    );

    await act(async () => {
      vi.advanceTimersByTime(101);
      await Promise.resolve();
    });

    expect(host.container.textContent).toContain(
      "Animations couldn't continue. Your answers have been kept.",
    );
    expect(host.container.textContent).toContain('Standard team2 7 revision 3');

    const lateReplacementHandle = createRuntimeHandle();
    await act(async () => {
      host.controller.requests[1].deferred.resolve(lateReplacementHandle);
      await Promise.resolve();
    });

    expect(lateReplacementHandle.dispose).toHaveBeenCalledTimes(1);
    expect(lateReplacementHandle.update).not.toHaveBeenCalled();
  });

  it('does not allocate an obsolete queued replacement after rapid supersession', async () => {
    const SupersedingPreview = ({ attempt }: KaplayMatchResultPreviewProps) => {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);

      useLayoutEffect(() => {
        const canvas = canvasRef.current;

        if (!canvas) {
          return undefined;
        }

        const stopA = attempt.startRuntime(
          controlledRuntimeInput(canvas, {
            height: MATCH_RESULT_SCENE_HEIGHT + 120,
            width: 390,
          }),
        );
        stopA();
        const stopB = attempt.startRuntime(
          controlledRuntimeInput(canvas, {
            height: MATCH_RESULT_SCENE_HEIGHT,
            width: MATCH_RESULT_SCENE_WIDTH,
          }),
        );

        return () => {
          stopB();
        };
      }, [attempt]);

      return createElement('canvas', {
        'data-testid': 'kaplay-match-result-canvas',
        ref: canvasRef,
        style: {
          aspectRatio: `${MATCH_RESULT_SCENE_WIDTH} / ${MATCH_RESULT_SCENE_HEIGHT}`,
        },
      });
    };

    const host = await renderHost(rendererState(), {
      previewComponent: SupersedingPreview,
    });

    await waitForCondition(
      () => host.controller.requests.length === 1,
      'only current replacement allocation',
    );

    expect(host.controller.requests[0].input.initialViewport.stage).toEqual({
      height: MATCH_RESULT_SCENE_HEIGHT,
      width: MATCH_RESULT_SCENE_WIDTH,
      x: 0,
      y: 0,
    });
  });

  it('cleans an obsolete initializing replacement without damaging the current one', async () => {
    let startReplacementB: (() => void) | null = null;
    const TwoPhasePreview = ({ attempt }: KaplayMatchResultPreviewProps) => {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);

      useLayoutEffect(() => {
        const canvas = canvasRef.current;

        if (!canvas) {
          return undefined;
        }

        const stopA = attempt.startRuntime(
          controlledRuntimeInput(canvas, {
            height: MATCH_RESULT_SCENE_HEIGHT + 120,
            width: 390,
          }),
        );
        let stopB: (() => void) | null = null;

        startReplacementB = () => {
          stopA();
          stopB = attempt.startRuntime(
            controlledRuntimeInput(canvas, {
              height: MATCH_RESULT_SCENE_HEIGHT,
              width: MATCH_RESULT_SCENE_WIDTH,
            }),
          );
        };

        return () => {
          stopB?.();
          stopA();
        };
      }, [attempt]);

      return createElement('canvas', {
        'data-testid': 'kaplay-match-result-canvas',
        ref: canvasRef,
        style: {
          aspectRatio: `${MATCH_RESULT_SCENE_WIDTH} / ${MATCH_RESULT_SCENE_HEIGHT}`,
        },
      });
    };

    const host = await renderHost(rendererState(), {
      previewComponent: TwoPhasePreview,
    });

    await waitForCondition(
      () => host.controller.requests.length === 1,
      'first initializing replacement allocation',
    );

    const firstRequest = host.controller.requests[0];

    await act(async () => {
      startReplacementB?.();
      await Promise.resolve();
    });
    await waitForCondition(
      () => host.controller.requests.length === 2,
      'current replacement allocation',
    );

    expect(firstRequest.input.abortSignal?.aborted).toBe(true);

    const currentHandle = createRuntimeHandle();
    await act(async () => {
      host.controller.requests[1].deferred.resolve(currentHandle);
      await Promise.resolve();
    });

    const obsoleteHandle = createRuntimeHandle();
    await act(async () => {
      firstRequest.deferred.resolve(obsoleteHandle);
      await Promise.resolve();
    });

    expect(obsoleteHandle.dispose).toHaveBeenCalledTimes(1);
    expect(currentHandle.dispose).not.toHaveBeenCalled();
    expect(host.container.textContent).not.toContain(
      "Animations couldn't continue.",
    );
  });

  it('does not extend one stalled replacement cycle across repeated measurements', async () => {
    vi.useFakeTimers();
    const geometry = installKaplayMeasurementHarness(MATCH_RESULT_SCENE_WIDTH);
    const host = await renderHost(rendererState(longTeamNames), {
      initializationTimeoutMs: 100,
    });

    await waitForCondition(
      () => host.controller.requests.length === 1,
      'initial runtime request',
    );

    const firstHandle = createRuntimeHandle();
    await act(async () => {
      host.controller.requests[0].deferred.resolve(firstHandle);
      await Promise.resolve();
    });

    await geometry.setWidth(390);
    await waitForCondition(
      () => host.controller.requests.length === 2,
      'pending compact replacement',
    );

    await act(async () => {
      vi.advanceTimersByTime(60);
      await Promise.resolve();
    });
    await geometry.setWidth(360);
    expect(host.controller.requests).toHaveLength(2);

    await act(async () => {
      vi.advanceTimersByTime(41);
      await Promise.resolve();
    });

    expect(host.container.textContent).toContain(
      "Animations couldn't continue. Your answers have been kept.",
    );
  });

  it('ignores late initialization and stale callbacks after switching Off', async () => {
    const host = await renderHost();

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

  it('keeps the measured StrictMode runtime setup healthy', async () => {
    const host = await renderHost(rendererState(), {
      strictMode: true,
    });

    await waitForCondition(
      () => host.controller.requests.length === 1,
      'measured StrictMode runtime request',
    );

    const handle = createRuntimeHandle();
    await act(async () => {
      host.controller.requests[0].deferred.resolve(handle);
      await Promise.resolve();
    });

    expect(handle.dispose).not.toHaveBeenCalled();
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
