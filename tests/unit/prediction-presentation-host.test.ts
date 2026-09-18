// @vitest-environment jsdom

import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PredictionPresentationHost } from '../../imports/ui/predictions/PredictionPresentationHost';
import { KaplayMatchResultPreview } from '../../imports/ui/predictions/kaplay/KaplayMatchResultPreview';
import type {
  PredictionSessionActions,
  PredictionSessionRendererState,
} from '../../imports/ui/predictions/predictionSession';
import type {
  KaplayMatchResultRuntimeFactory,
  KaplayMatchResultRuntimeHandle,
  KaplayMatchResultRuntimeInput,
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
  readonly input: KaplayMatchResultRuntimeInput;
}

interface RuntimeController {
  readonly factory: KaplayMatchResultRuntimeFactory;
  readonly requests: RuntimeRequest[];
}

interface MountedHost {
  readonly actions: PredictionSessionActions;
  readonly container: HTMLDivElement;
  readonly controller: RuntimeController;
  readonly rerender: (state: PredictionSessionRendererState) => Promise<void>;
  readonly unmount: () => Promise<void>;
}

const mountedHosts: MountedHost[] = [];

afterEach(async () => {
  vi.useRealTimers();
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

const createRuntimeHandle = () => ({
  dispose: vi.fn(),
  update: vi.fn(),
});

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
): Promise<MountedHost> => {
  const actions = createActions();
  const container = document.createElement('div');
  const controller = createRuntimeController();
  const root = createRoot(container);
  let currentState = state;

  document.body.append(container);

  const paint = async () => {
    await act(async () => {
      root.render(
        createElement(PredictionPresentationHost, {
          actions,
          initializationTimeoutMs: 25,
          previewComponent: KaplayMatchResultPreview,
          previewSettings: {
            enabled: true,
            testControls: false,
          },
          renderStandard: () => renderStandard(currentState),
          runtimeFactory: controller.factory,
          state: currentState,
        }),
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
  });
});
