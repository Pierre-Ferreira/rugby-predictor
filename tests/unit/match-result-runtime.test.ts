// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createKaplayMatchResultRuntime,
  type KaplayFunction,
  type KaplayMatchResultRuntimeHandle,
  type MatchResultRuntimeSnapshot,
} from '../../imports/ui/predictions/kaplay/matchResultRuntime';
import {
  MATCH_RESULT_SCENE_HEIGHT,
  MATCH_RESULT_SCENE_WIDTH,
} from '../../imports/ui/predictions/kaplay/matchResultMotion';

interface ControlledKaplay {
  readonly cleanupCallbacks: Array<() => void>;
  readonly controllers: Array<{
    readonly cancel: ReturnType<typeof vi.fn>;
    paused: boolean;
  }>;
  readonly kaplay: KaplayFunction;
  readonly quit: ReturnType<typeof vi.fn>;
  readonly triggerCleanup: () => void;
}

const snapshot = (): MatchResultRuntimeSnapshot => ({
  canSelect: true,
  choicePresentation: 'choices',
  choices: [
    {
      label: 'Springboks',
      selected: false,
      value: 'team1',
    },
    {
      label: 'All Blacks',
      selected: false,
      value: 'team2',
    },
    {
      label: 'Draw',
      selected: false,
      value: 'draw',
    },
  ],
  deduction: null,
  focusedValue: null,
  helperText: null,
  pickedLabel: null,
  question: 'Who do you think will win?',
  selectionEffectId: 0,
  sessionKey: 'runtime-test',
  supportingText: [],
});

const installAnimationFrameHarness = () => {
  const callbacks: FrameRequestCallback[] = [];
  const original = window.requestAnimationFrame;

  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callbacks.push(callback);

    return callbacks.length;
  }) as typeof window.requestAnimationFrame;

  return {
    restore: () => {
      window.requestAnimationFrame = original;
    },
    run: () => {
      const queued = callbacks.splice(0);

      queued.forEach((callback, index) => callback(index + 1));
    },
  };
};

const createLoadedAsset = () => ({
  data: {},
  error: null,
  loaded: true,
  onError: vi.fn(),
  onLoad: vi.fn(),
});

const createPendingAsset = () => ({
  data: null,
  error: null,
  loaded: false,
  onError: vi.fn(),
  onLoad: vi.fn(),
});

const createController = () => ({
  cancel: vi.fn(),
  paused: false,
});

const createControlledKaplay = ({
  includeCleanup = true,
  pendingAsset = false,
  quitError = null,
}: {
  readonly includeCleanup?: boolean;
  readonly pendingAsset?: boolean;
  readonly quitError?: Error | null;
} = {}): ControlledKaplay => {
  const cleanupCallbacks: Array<() => void> = [];
  const controllers: ControlledKaplay['controllers'] = [];
  const quit = vi.fn(() => {
    if (quitError) {
      throw quitError;
    }
  });
  const context = {
    dt: () => 0.016,
    height: () => MATCH_RESULT_SCENE_HEIGHT,
    loadSpriteAtlas: vi.fn(() =>
      pendingAsset ? createPendingAsset() : createLoadedAsset(),
    ),
    onCleanup: includeCleanup
      ? vi.fn((callback: () => void) => {
          cleanupCallbacks.push(callback);
        })
      : undefined,
    onDraw: vi.fn(() => {
      const controller = createController();

      controllers.push(controller);

      return controller;
    }),
    onError: vi.fn(),
    onLoadError: vi.fn(),
    onUpdate: vi.fn(() => {
      const controller = createController();

      controllers.push(controller);

      return controller;
    }),
    quit,
    width: () => MATCH_RESULT_SCENE_WIDTH,
  };
  const kaplay = vi.fn(() => context) as unknown as KaplayFunction;

  return {
    cleanupCallbacks,
    controllers,
    kaplay,
    quit,
    triggerCleanup: () => {
      cleanupCallbacks.forEach((callback) => callback());
    },
  };
};

const createCanvas = () => {
  const canvas = document.createElement('canvas');

  document.body.append(canvas);

  return canvas;
};

const requireDisposalComplete = (
  handle: KaplayMatchResultRuntimeHandle,
): Promise<void> => {
  if (!handle.disposalComplete) {
    throw new Error('Expected runtime handle disposalComplete.');
  }

  return handle.disposalComplete;
};

const createRuntime = async ({
  abortSignal,
  engine,
  onDisposalComplete,
}: {
  readonly abortSignal?: AbortSignal;
  readonly engine: ControlledKaplay;
  readonly onDisposalComplete?: (disposalComplete: Promise<void>) => void;
}) => {
  const frameHarness = installAnimationFrameHarness();
  const runtimePromise = createKaplayMatchResultRuntime({
    abortSignal,
    canvas: createCanvas(),
    initialSnapshot: snapshot(),
    initialViewport: {
      cssWidth: MATCH_RESULT_SCENE_WIDTH,
      stage: {
        height: MATCH_RESULT_SCENE_HEIGHT,
        width: MATCH_RESULT_SCENE_WIDTH,
        x: 0,
        y: 0,
      },
    },
    isSelectionAllowed: () => true,
    kaplay: engine.kaplay,
    onDisposalComplete,
    onFailure: vi.fn(),
    onSelect: vi.fn(),
  });

  await Promise.resolve();
  await Promise.resolve();
  frameHarness.run();
  await Promise.resolve();

  try {
    return await runtimePromise;
  } finally {
    frameHarness.restore();
  }
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('Kaplay Match Result runtime disposal confirmation', () => {
  it('does not settle disposalComplete from quit or browser frame callbacks', async () => {
    const engine = createControlledKaplay();
    const frameHarness = installAnimationFrameHarness();
    const handle = await createRuntime({ engine });
    const disposalComplete = requireDisposalComplete(handle);
    let completed = false;

    void disposalComplete.then(() => {
      completed = true;
    });

    handle.dispose();
    frameHarness.run();
    await Promise.resolve();

    expect(engine.quit).toHaveBeenCalledTimes(1);
    expect(completed).toBe(false);

    engine.triggerCleanup();
    await expect(disposalComplete).resolves.toBeUndefined();
    expect(completed).toBe(true);
    frameHarness.restore();
  });

  it('settles once after the controlled engine cleanup notification', async () => {
    const engine = createControlledKaplay();
    const handle = await createRuntime({ engine });
    const disposalComplete = requireDisposalComplete(handle);
    let completionCount = 0;

    void disposalComplete.then(() => {
      completionCount += 1;
    });

    handle.dispose();
    handle.dispose();
    engine.triggerCleanup();
    engine.triggerCleanup();
    await expect(disposalComplete).resolves.toBeUndefined();
    await Promise.resolve();

    expect(engine.quit).toHaveBeenCalledTimes(1);
    expect(completionCount).toBe(1);
  });

  it('rejects cleanup completion when quit throws', async () => {
    const engine = createControlledKaplay({
      quitError: new Error('controlled quit failure'),
    });
    const handle = await createRuntime({ engine });
    const disposalComplete = requireDisposalComplete(handle);

    handle.dispose();
    engine.triggerCleanup();

    await expect(disposalComplete).rejects.toThrow('controlled quit failure');
    expect(engine.quit).toHaveBeenCalledTimes(1);
  });

  it('rejects cleanup completion when the native notification is unavailable', async () => {
    const engine = createControlledKaplay({ includeCleanup: false });
    const handle = await createRuntime({ engine });
    const disposalComplete = requireDisposalComplete(handle);

    handle.dispose();

    await expect(disposalComplete).rejects.toThrow(
      'cleanup notification is unavailable',
    );
    expect(engine.quit).toHaveBeenCalledTimes(1);
  });

  it('keeps the real cleanup gate for cancellation during required asset loading', async () => {
    const engine = createControlledKaplay({ pendingAsset: true });
    const abortController = new AbortController();
    const disposalComplete: {
      current?: Promise<void>;
    } = {};
    const frameHarness = installAnimationFrameHarness();
    const runtimePromise = createKaplayMatchResultRuntime({
      abortSignal: abortController.signal,
      canvas: createCanvas(),
      initialSnapshot: snapshot(),
      initialViewport: {
        cssWidth: MATCH_RESULT_SCENE_WIDTH,
        stage: {
          height: MATCH_RESULT_SCENE_HEIGHT,
          width: MATCH_RESULT_SCENE_WIDTH,
          x: 0,
          y: 0,
        },
      },
      isSelectionAllowed: () => true,
      kaplay: engine.kaplay,
      onDisposalComplete: (nextDisposalComplete) => {
        disposalComplete.current = nextDisposalComplete;
      },
      onFailure: vi.fn(),
      onSelect: vi.fn(),
    });

    await Promise.resolve();
    abortController.abort();

    await expect(runtimePromise).rejects.toThrow('cancelled');
    expect(engine.quit).toHaveBeenCalledTimes(1);

    const observedDisposalComplete = disposalComplete.current;

    if (!observedDisposalComplete) {
      throw new Error('Expected partial-startup disposalComplete.');
    }

    let completed = false;

    void observedDisposalComplete.then(() => {
      completed = true;
    });
    frameHarness.run();
    await Promise.resolve();

    expect(completed).toBe(false);
    engine.triggerCleanup();
    await expect(observedDisposalComplete).resolves.toBeUndefined();
    expect(completed).toBe(true);
    frameHarness.restore();
  });

  it('has no engine-cleanup debt when cancellation happens before allocation', async () => {
    const engine = createControlledKaplay();
    const abortController = new AbortController();

    abortController.abort();

    await expect(
      createKaplayMatchResultRuntime({
        abortSignal: abortController.signal,
        canvas: createCanvas(),
        initialSnapshot: snapshot(),
        initialViewport: {
          cssWidth: MATCH_RESULT_SCENE_WIDTH,
          stage: {
            height: MATCH_RESULT_SCENE_HEIGHT,
            width: MATCH_RESULT_SCENE_WIDTH,
            x: 0,
            y: 0,
          },
        },
        isSelectionAllowed: () => true,
        kaplay: engine.kaplay,
        onFailure: vi.fn(),
        onSelect: vi.fn(),
      }),
    ).rejects.toThrow('cancelled');

    expect(engine.kaplay).not.toHaveBeenCalled();
    expect(engine.quit).not.toHaveBeenCalled();
  });
});
