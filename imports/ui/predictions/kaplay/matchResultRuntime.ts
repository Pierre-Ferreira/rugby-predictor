import type { KAPLAYCtx, KAPLAYOpt, KEventController, Vec2 } from 'kaplay';

export const KAPLAY_INITIALIZATION_TIMEOUT_MS = 10_000;

const gameWidth = 920;
const gameHeight = 560;
const choiceWidth = 740;
const choiceHeight = 82;
const choiceGap = 20;
const choiceStartY = 250;

export type MatchResultChoiceValue = 'draw' | 'team1' | 'team2';

export interface MatchResultRuntimeChoice {
  readonly label: string;
  readonly selected: boolean;
  readonly value: MatchResultChoiceValue;
}

export interface MatchResultRuntimeSnapshot {
  readonly canSelect: boolean;
  readonly deduction: string | null;
  readonly helperText: string | null;
  readonly pickedLabel: string | null;
  readonly question: string;
  readonly sessionKey: string;
  readonly supportingText: readonly string[];
  readonly choices: readonly MatchResultRuntimeChoice[];
}

export interface KaplayMatchResultRuntimeHandle {
  readonly dispose: () => void;
  readonly update: (snapshot: MatchResultRuntimeSnapshot) => void;
}

export interface KaplayMatchResultRuntimeInput {
  readonly canvas: HTMLCanvasElement;
  readonly initialSnapshot: MatchResultRuntimeSnapshot;
  readonly isSelectionAllowed: () => boolean;
  readonly onFailure: (error: Error) => void;
  readonly onSelect: (value: MatchResultChoiceValue) => void;
}

export type KaplayFunction = typeof import('kaplay').default;

export interface KaplayMatchResultRuntimeFactoryInput extends KaplayMatchResultRuntimeInput {
  readonly testControlsEnabled?: boolean;
}

export type KaplayMatchResultRuntimeFactory = (
  input: KaplayMatchResultRuntimeFactoryInput,
) => Promise<KaplayMatchResultRuntimeHandle>;

export interface KaplayPreviewTestControls {
  readonly delayInitializationMs?: number;
  readonly failInitialization?: boolean;
  readonly failOnNextPointer?: boolean;
}

declare global {
  interface Window {
    __RUGBY_ROOSTER_KAPLAY_IMPORT_COUNT__?: number;
    __RUGBY_ROOSTER_KAPLAY_PREVIEW_TEST__?: KaplayPreviewTestControls;
  }
}

const wait = (durationMs: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });

const nextAnimationFrame = (): Promise<void> =>
  new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

const errorFromUnknown = (error: unknown, fallback: string): Error => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(fallback);
};

const optionalTestControls = (
  testControlsEnabled: boolean,
): KaplayPreviewTestControls =>
  testControlsEnabled
    ? (window.__RUGBY_ROOSTER_KAPLAY_PREVIEW_TEST__ ?? {})
    : {};

export const createDefaultKaplayMatchResultRuntime = async (
  input: KaplayMatchResultRuntimeFactoryInput,
): Promise<KaplayMatchResultRuntimeHandle> => {
  const controls = optionalTestControls(input.testControlsEnabled === true);

  if (controls.delayInitializationMs) {
    await wait(controls.delayInitializationMs);
  }

  if (controls.failInitialization) {
    throw new Error('Controlled Kaplay preview initialization failure.');
  }

  if (input.testControlsEnabled === true) {
    window.__RUGBY_ROOSTER_KAPLAY_IMPORT_COUNT__ =
      (window.__RUGBY_ROOSTER_KAPLAY_IMPORT_COUNT__ ?? 0) + 1;
  }

  const module = await import('kaplay');

  return createKaplayMatchResultRuntime({
    ...input,
    failOnNextPointer: controls.failOnNextPointer === true,
    kaplay: module.default,
  });
};

export const createKaplayMatchResultRuntime = async ({
  canvas,
  failOnNextPointer = false,
  initialSnapshot,
  isSelectionAllowed,
  kaplay,
  onFailure,
  onSelect,
}: KaplayMatchResultRuntimeInput & {
  readonly failOnNextPointer?: boolean;
  readonly kaplay: KaplayFunction;
}): Promise<KaplayMatchResultRuntimeHandle> => {
  let snapshot = initialSnapshot;
  let disposed = false;
  let failed = false;
  let pulseValue = 0;
  let lastSelectedValue = selectedChoiceValue(snapshot);
  let pointerShouldFail = failOnNextPointer;
  const eventControllers: KEventController[] = [];
  const abortController = new AbortController();

  const k = kaplay({
    background: [246, 244, 237],
    canvas,
    debug: false,
    focus: false,
    font: 'sans-serif',
    global: false,
    height: gameHeight,
    letterbox: true,
    loadingScreen: false,
    maxFPS: 45,
    pixelDensity: conservativePixelDensity(),
    stretch: true,
    touchToMouse: false,
    width: gameWidth,
  } satisfies KAPLAYOpt);

  const dispose = () => {
    if (disposed) {
      return;
    }

    disposed = true;
    abortController.abort();

    for (const controller of eventControllers) {
      controller.cancel();
    }

    try {
      k.quit();
    } catch {
      // Teardown is best-effort after partial initialization or engine failure.
    }
  };

  const fail = (error: Error) => {
    if (disposed || failed) {
      return;
    }

    failed = true;
    onFailure(error);
    dispose();
  };

  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      fail(new Error('Kaplay preview WebGL context lost.'));
    },
    { signal: abortController.signal },
  );

  canvas.addEventListener(
    'pointerup',
    (event) => {
      if (disposed || failed || !isSelectionAllowed()) {
        return;
      }

      try {
        if (pointerShouldFail) {
          pointerShouldFail = false;
          throw new Error('Controlled Kaplay pointer failure.');
        }

        const pointer = pointerPositionInGame(canvas, event);
        const choice = choiceAtPoint(k, snapshot, pointer);

        if (choice) {
          onSelect(choice.value);
        }
      } catch (error) {
        fail(errorFromUnknown(error, 'Kaplay preview input failed.'));
      }
    },
    { signal: abortController.signal },
  );

  document.addEventListener(
    'visibilitychange',
    () => {
      const isHidden = document.visibilityState === 'hidden';

      for (const controller of eventControllers) {
        controller.paused = isHidden;
      }
    },
    { signal: abortController.signal },
  );

  try {
    k.onError((error) => {
      fail(errorFromUnknown(error, 'Kaplay preview runtime failed.'));
    });

    k.onLoadError((name, asset) => {
      const details =
        asset.error instanceof Error
          ? asset.error.message
          : String(asset.error ?? 'unknown asset error');

      fail(new Error(`Kaplay asset "${name}" failed to load: ${details}`));
    });
  } catch (error) {
    fail(errorFromUnknown(error, 'Kaplay preview error hooks failed.'));
  }

  eventControllers.push(
    k.onUpdate(() => {
      if (pulseValue > 0) {
        pulseValue = Math.max(0, pulseValue - k.dt() * 3.5);
      }
    }),
  );

  eventControllers.push(
    k.onDraw(() => {
      try {
        drawScene(k, snapshot, pulseValue);
      } catch (error) {
        fail(errorFromUnknown(error, 'Kaplay preview drawing failed.'));
      }
    }),
  );

  await nextAnimationFrame();

  if (disposed || failed) {
    throw new Error('Kaplay preview was disposed before it became ready.');
  }

  return {
    dispose,
    update: (nextSnapshot) => {
      if (disposed || failed) {
        return;
      }

      const nextSelectedValue = selectedChoiceValue(nextSnapshot);

      if (nextSelectedValue !== lastSelectedValue) {
        pulseValue = 1;
        lastSelectedValue = nextSelectedValue;
      }

      snapshot = nextSnapshot;
    },
  };
};

const conservativePixelDensity = (): number =>
  Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));

const selectedChoiceValue = (
  snapshot: MatchResultRuntimeSnapshot,
): MatchResultChoiceValue | null =>
  snapshot.choices.find((choice) => choice.selected)?.value ?? null;

const pointerPositionInGame = (
  canvas: HTMLCanvasElement,
  event: PointerEvent,
): { readonly x: number; readonly y: number } => {
  const rect = canvas.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / rect.width) * gameWidth,
    y: ((event.clientY - rect.top) / rect.height) * gameHeight,
  };
};

const choiceRect = (index: number) => ({
  height: choiceHeight,
  width: choiceWidth,
  x: (gameWidth - choiceWidth) / 2,
  y: choiceStartY + index * (choiceHeight + choiceGap),
});

const choiceAtPoint = (
  k: KAPLAYCtx,
  snapshot: MatchResultRuntimeSnapshot,
  point: { readonly x: number; readonly y: number },
): MatchResultRuntimeChoice | null => {
  for (const [index, choice] of snapshot.choices.entries()) {
    const rect = choiceRect(index);

    if (
      k.testRectPoint(
        new k.Rect(k.vec2(rect.x, rect.y), rect.width, rect.height),
        k.vec2(point.x, point.y),
      )
    ) {
      return choice;
    }
  }

  return null;
};

const drawScene = (
  k: KAPLAYCtx,
  snapshot: MatchResultRuntimeSnapshot,
  pulseValue: number,
) => {
  k.drawRect({
    color: k.rgb(246, 244, 237),
    height: gameHeight,
    pos: k.vec2(0, 0),
    width: gameWidth,
  });
  drawTextBlock(k, {
    color: k.rgb(204, 49, 42),
    size: 18,
    text: 'Animation preview: Match Result only',
    x: 90,
    y: 42,
  });
  drawTextBlock(k, {
    color: k.rgb(22, 31, 38),
    size: 34,
    text: snapshot.question,
    width: 740,
    x: 90,
    y: 76,
  });

  if (snapshot.helperText) {
    drawTextBlock(k, {
      color: k.rgb(22, 31, 38),
      size: 19,
      text: snapshot.helperText,
      width: 760,
      x: 90,
      y: 132,
    });
  }

  if (snapshot.deduction) {
    drawTextBlock(k, {
      color: k.rgb(85, 96, 105),
      size: 16,
      text: snapshot.deduction,
      width: 760,
      x: 90,
      y: 184,
    });
  }

  snapshot.choices.forEach((choice, index) => {
    drawChoice(k, choice, index, pulseValue);
  });

  if (snapshot.pickedLabel) {
    drawTextBlock(k, {
      color: k.rgb(22, 31, 38),
      size: 20,
      text: `You picked ${snapshot.pickedLabel}`,
      width: 740,
      x: 90,
      y: 510,
    });
  }
};

const drawChoice = (
  k: KAPLAYCtx,
  choice: MatchResultRuntimeChoice,
  index: number,
  pulseValue: number,
) => {
  const rect = choiceRect(index);
  const selectedScale = choice.selected ? 1 + pulseValue * 0.025 : 1;
  const scaledWidth = rect.width * selectedScale;
  const scaledHeight = rect.height * selectedScale;
  const x = rect.x - (scaledWidth - rect.width) / 2;
  const y = rect.y - (scaledHeight - rect.height) / 2;

  k.drawRect({
    color: choice.selected ? k.rgb(204, 49, 42) : k.rgb(255, 255, 255),
    height: scaledHeight,
    outline: {
      color: choice.selected ? k.rgb(204, 49, 42) : k.rgb(217, 216, 207),
      width: 3,
    },
    pos: k.vec2(x, y),
    radius: 8,
    width: scaledWidth,
  });
  drawTextBlock(k, {
    color: choice.selected ? k.rgb(255, 255, 255) : k.rgb(22, 31, 38),
    size: 26,
    text: choice.label,
    width: scaledWidth - 84,
    x: x + 42,
    y: y + 24,
  });

  if (choice.selected) {
    k.drawRect({
      color: k.rgb(249, 196, 64),
      height: 12,
      pos: k.vec2(x + scaledWidth - 58, y + scaledHeight / 2 - 6),
      radius: 6,
      width: 30,
    });
  }
};

const drawTextBlock = (
  k: KAPLAYCtx,
  {
    color,
    size,
    text,
    width,
    x,
    y,
  }: {
    readonly color: ReturnType<KAPLAYCtx['rgb']>;
    readonly size: number;
    readonly text: string;
    readonly width?: number;
    readonly x: number;
    readonly y: number;
  },
) => {
  k.drawText({
    color,
    pos: k.vec2(x, y) as Vec2,
    size,
    text,
    width,
  });
};
