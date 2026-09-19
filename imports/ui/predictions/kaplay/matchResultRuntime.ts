import type {
  Asset,
  KAPLAYCtx,
  KAPLAYOpt,
  KEventController,
  Vec2,
} from 'kaplay';

import {
  choiceAtPoint,
  createShoveEffect,
  advanceShoveEffect,
  MATCH_RESULT_SCENE_WIDTH,
  projectMatchResultLayout,
  projectShoveMotion,
  ROOSTER_SHOVE_ATLAS_DATA,
  ROOSTER_SHOVE_ATLAS_URL,
  ROOSTER_SHOVE_SPRITE_NAME,
  type MatchResultChoiceValue,
  type ShoveEffect,
  type ShoveProjection,
  type MotionRect,
  type ProjectedTextBlock,
} from './matchResultMotion';

export const KAPLAY_INITIALIZATION_TIMEOUT_MS = 10_000;
export type { MatchResultChoiceValue } from './matchResultMotion';

export interface MatchResultRuntimeChoice {
  readonly label: string;
  readonly selected: boolean;
  readonly value: MatchResultChoiceValue;
}

export interface MatchResultRuntimeSnapshot {
  readonly canSelect: boolean;
  readonly choicePresentation: 'choices' | 'selected';
  readonly deduction: string | null;
  readonly focusedValue: MatchResultChoiceValue | null;
  readonly helperText: string | null;
  readonly pickedLabel: string | null;
  readonly question: string;
  readonly selectionEffectId: number;
  readonly sessionKey: string;
  readonly supportingText: readonly string[];
  readonly choices: readonly MatchResultRuntimeChoice[];
}

export interface KaplayMatchResultRuntimeViewport {
  readonly cssWidth: number;
  readonly stage: MotionRect;
}

export interface KaplayMatchResultRuntimeHandle {
  readonly disposalComplete?: Promise<void>;
  readonly dispose: () => void;
  readonly update: (snapshot: MatchResultRuntimeSnapshot) => void;
}

export interface KaplayMatchResultRuntimeInput {
  readonly canvas: HTMLCanvasElement;
  readonly initialSnapshot: MatchResultRuntimeSnapshot;
  readonly initialViewport: KaplayMatchResultRuntimeViewport;
  readonly isSelectionAllowed: () => boolean;
  readonly onFailure: (error: Error) => void;
  readonly onSelect: (value: MatchResultChoiceValue) => void;
}

export type KaplayFunction = typeof import('kaplay').default;

export interface KaplayMatchResultRuntimeFactoryInput extends KaplayMatchResultRuntimeInput {
  readonly abortSignal?: AbortSignal;
  readonly onDisposalComplete?: (disposalComplete: Promise<void>) => void;
  readonly remainingInitializationMs?: number;
  readonly testControlsEnabled?: boolean;
}

export type KaplayMatchResultRuntimeFactory = (
  input: KaplayMatchResultRuntimeFactoryInput,
) => Promise<KaplayMatchResultRuntimeHandle>;

export interface KaplayPreviewTestControls {
  readonly delayInitializationMs?: number;
  readonly failRequiredSpriteLoad?: boolean;
  readonly failInitialization?: boolean;
  readonly failOnNextPointer?: boolean;
  readonly motionTimeScale?: number;
}

export interface KaplayMatchResultDebugLayout {
  readonly choices: readonly {
    readonly hitTestable: boolean;
    readonly isRejected: boolean;
    readonly isSelected: boolean;
    readonly label: string;
    readonly labelCssFontSize: number;
    readonly labelLines: readonly string[];
    readonly rect: MotionRect;
    readonly targetCssHeight: number;
    readonly value: MatchResultChoiceValue;
  }[];
  readonly contentBounds: MotionRect | null;
  readonly displayScale: number;
  readonly isCompact: boolean;
  readonly rejectedGroup: MotionRect | null;
  readonly selectedChoice: MotionRect | null;
  readonly stage: MotionRect;
  readonly synchronized: boolean;
  readonly viewport: {
    readonly canvasCssBounds: MotionRect;
    readonly drawingBuffer: {
      readonly height: number;
      readonly width: number;
    };
    readonly engine: {
      readonly height: number;
      readonly width: number;
    };
    readonly renderedContentBounds: MotionRect | null;
  };
}

declare global {
  interface Window {
    __RUGBY_ROOSTER_KAPLAY_IMPORT_COUNT__?: number;
    __RUGBY_ROOSTER_KAPLAY_LAST_LAYOUT__?: KaplayMatchResultDebugLayout;
    __RUGBY_ROOSTER_KAPLAY_PREVIEW_TEST__?: KaplayPreviewTestControls;
  }
}

const errorIfAborted = (signal: AbortSignal | undefined): Error | null =>
  signal?.aborted
    ? new Error('Kaplay preview runtime generation was cancelled.')
    : null;

const throwIfAborted = (signal: AbortSignal | undefined) => {
  const error = errorIfAborted(signal);

  if (error) {
    throw error;
  }
};

const wait = (durationMs: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const aborted = errorIfAborted(signal);

    if (aborted) {
      reject(aborted);
      return;
    }

    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, durationMs);

    const abort = () => {
      window.clearTimeout(timer);
      reject(new Error('Kaplay preview runtime generation was cancelled.'));
    };

    signal?.addEventListener('abort', abort, { once: true });
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
    await wait(controls.delayInitializationMs, input.abortSignal);
  }

  throwIfAborted(input.abortSignal);

  if (controls.failInitialization) {
    throw new Error('Controlled Kaplay preview initialization failure.');
  }

  if (input.testControlsEnabled === true) {
    window.__RUGBY_ROOSTER_KAPLAY_IMPORT_COUNT__ =
      (window.__RUGBY_ROOSTER_KAPLAY_IMPORT_COUNT__ ?? 0) + 1;
  }

  const module = await import('kaplay');

  throwIfAborted(input.abortSignal);

  return createKaplayMatchResultRuntime({
    ...input,
    failRequiredSpriteLoad: controls.failRequiredSpriteLoad === true,
    failOnNextPointer: controls.failOnNextPointer === true,
    kaplay: module.default,
    motionTimeScale:
      typeof controls.motionTimeScale === 'number'
        ? controls.motionTimeScale
        : 1,
  });
};

export const createKaplayMatchResultRuntime = async ({
  abortSignal,
  canvas,
  failOnNextPointer = false,
  failRequiredSpriteLoad = false,
  initialSnapshot,
  initialViewport,
  isSelectionAllowed,
  kaplay,
  motionTimeScale = 1,
  onFailure,
  onDisposalComplete,
  onSelect,
  testControlsEnabled = false,
}: KaplayMatchResultRuntimeInput & {
  readonly abortSignal?: AbortSignal;
  readonly failOnNextPointer?: boolean;
  readonly failRequiredSpriteLoad?: boolean;
  readonly kaplay: KaplayFunction;
  readonly motionTimeScale?: number;
  readonly onDisposalComplete?: (disposalComplete: Promise<void>) => void;
  readonly testControlsEnabled?: boolean;
}): Promise<KaplayMatchResultRuntimeHandle> => {
  throwIfAborted(abortSignal);

  let snapshot = initialSnapshot;
  let disposed = false;
  let failed = false;
  let activeEffect: ShoveEffect | null = null;
  let lastSelectionEffectId = snapshot.selectionEffectId;
  let pointerShouldFail = failOnNextPointer;
  const eventControllers: KEventController[] = [];
  const abortController = new AbortController();
  const configuredStage = initialViewport.stage;
  let resolveDisposalComplete!: () => void;
  const disposalComplete = new Promise<void>((resolve) => {
    resolveDisposalComplete = resolve;
  });
  let disposalCompletionScheduled = false;
  const scheduleDisposalCompletion = () => {
    if (disposalCompletionScheduled) {
      return;
    }

    disposalCompletionScheduled = true;
    window.requestAnimationFrame(() => {
      resolveDisposalComplete();
    });
  };

  const k = kaplay({
    background: [246, 244, 237],
    canvas,
    debug: false,
    focus: false,
    font: 'sans-serif',
    global: false,
    height: configuredStage.height,
    letterbox: true,
    loadingScreen: false,
    maxFPS: 45,
    pixelDensity: conservativePixelDensity(),
    stretch: true,
    touchToMouse: false,
    width: configuredStage.width,
  } satisfies KAPLAYOpt);
  applyCanvasDisplayGeometry(canvas, configuredStage);
  onDisposalComplete?.(disposalComplete);

  const dispose = () => {
    if (disposed) {
      return;
    }

    disposed = true;
    abortSignal?.removeEventListener('abort', dispose);
    abortController.abort();

    for (const controller of eventControllers) {
      controller.cancel();
    }

    try {
      k.quit();
    } catch {
      // Teardown is best-effort after partial initialization or engine failure.
    } finally {
      scheduleDisposalCompletion();
    }
  };

  if (abortSignal?.aborted) {
    dispose();
    throw new Error('Kaplay preview runtime generation was cancelled.');
  }

  abortSignal?.addEventListener('abort', dispose, { once: true });

  const fail = (error: Error) => {
    if (disposed || failed) {
      return;
    }

    failed = true;
    onFailure(error);
    dispose();
  };

  try {
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

          const layout = projectMatchResultLayout(
            snapshot,
            measuredCanvasCssWidth(canvas),
          );

          if (!stagesMatch(layout.stage, configuredStage)) {
            return;
          }

          const pointer = pointerPositionInGame(canvas, event, layout.stage);

          if (!pointer) {
            return;
          }

          const choice = choiceAtPoint(layout, pointer);

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
      const setupError = errorFromUnknown(
        error,
        'Kaplay preview error hooks failed.',
      );

      fail(setupError);
      throw setupError;
    }

    await loadRequiredRoosterAtlas(k, failRequiredSpriteLoad, abortSignal);

    eventControllers.push(
      k.onUpdate(() => {
        activeEffect = advanceShoveEffect(
          activeEffect,
          k.dt() * Math.max(0, motionTimeScale),
          snapshot,
        );
      }),
    );

    eventControllers.push(
      k.onDraw(() => {
        try {
          drawScene(
            k,
            snapshot,
            activeEffect,
            canvas,
            configuredStage,
            testControlsEnabled === true,
          );
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
      disposalComplete,
      dispose,
      update: (nextSnapshot) => {
        if (disposed || failed) {
          return;
        }

        if (nextSnapshot.choicePresentation === 'choices') {
          activeEffect = null;
        }

        snapshot = nextSnapshot;

        if (nextSnapshot.selectionEffectId !== lastSelectionEffectId) {
          lastSelectionEffectId = nextSnapshot.selectionEffectId;

          const selectedValue = selectedChoiceValue(nextSnapshot);

          activeEffect =
            selectedValue && nextSnapshot.choicePresentation === 'selected'
              ? createShoveEffect(nextSnapshot.selectionEffectId, selectedValue)
              : null;
        }
      },
    };
  } catch (error) {
    dispose();
    throw errorFromUnknown(error, 'Kaplay preview initialization failed.');
  }
};

const conservativePixelDensity = (): number =>
  Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));

const selectedChoiceValue = (
  snapshot: MatchResultRuntimeSnapshot,
): MatchResultChoiceValue | null =>
  snapshot.choices.find((choice) => choice.selected)?.value ?? null;

const measuredCanvasCssWidth = (canvas: HTMLCanvasElement): number => {
  const rect = canvas.getBoundingClientRect();

  return rect.width > 0 ? rect.width : MATCH_RESULT_SCENE_WIDTH;
};

const applyCanvasDisplayGeometry = (
  canvas: HTMLCanvasElement,
  stage: MotionRect,
) => {
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  canvas.style.aspectRatio = `${stage.width} / ${stage.height}`;
};

const stagesMatch = (first: MotionRect, second: MotionRect): boolean =>
  first.width === second.width && first.height === second.height;

const loadRequiredRoosterAtlas = async (
  k: KAPLAYCtx,
  failRequiredSpriteLoad: boolean,
  signal?: AbortSignal,
): Promise<void> => {
  const assetUrl = failRequiredSpriteLoad
    ? '/assets/rooster/match-result/missing-required-rooster-atlas.png'
    : ROOSTER_SHOVE_ATLAS_URL;
  const asset = k.loadSpriteAtlas(assetUrl, ROOSTER_SHOVE_ATLAS_DATA);

  await waitForKaplayAsset(asset, signal);
};

const waitForKaplayAsset = <TValue>(
  asset: Asset<TValue>,
  signal?: AbortSignal,
): Promise<TValue> =>
  new Promise((resolve, reject) => {
    const aborted = errorIfAborted(signal);

    if (aborted) {
      reject(aborted);
      return;
    }

    let settled = false;
    const settle = (action: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      signal?.removeEventListener('abort', abort);
      action();
    };
    const abort = () => {
      settle(() =>
        reject(new Error('Kaplay preview runtime generation was cancelled.')),
      );
    };

    signal?.addEventListener('abort', abort, { once: true });

    if (asset.loaded && asset.data) {
      settle(() => resolve(asset.data as TValue));
      return;
    }

    if (asset.error) {
      settle(() => reject(asset.error));
      return;
    }

    asset.onLoad((data) => {
      settle(() => resolve(data));
    });
    asset.onError((error) => {
      settle(() => reject(error));
    });
  });

const pointerPositionInGame = (
  canvas: HTMLCanvasElement,
  event: PointerEvent,
  stage: MotionRect,
): { readonly x: number; readonly y: number } | null => {
  const rect = canvas.getBoundingClientRect();
  const contentRect = renderedContentRect(rect, stage);

  if (!contentRect) {
    return null;
  }

  const localX = event.clientX - rect.left - contentRect.x;
  const localY = event.clientY - rect.top - contentRect.y;

  if (
    localX < 0 ||
    localX > contentRect.width ||
    localY < 0 ||
    localY > contentRect.height
  ) {
    return null;
  }

  return {
    x: (localX / contentRect.width) * stage.width,
    y: (localY / contentRect.height) * stage.height,
  };
};

const renderedContentRect = (
  rect: DOMRect,
  stage: MotionRect,
): MotionRect | null => {
  if (
    rect.width <= 0 ||
    rect.height <= 0 ||
    stage.width <= 0 ||
    stage.height <= 0
  ) {
    return null;
  }

  const canvasAspect = rect.width / rect.height;
  const stageAspect = stage.width / stage.height;

  if (canvasAspect > stageAspect) {
    const width = rect.height * stageAspect;

    return {
      height: rect.height,
      width,
      x: (rect.width - width) / 2,
      y: 0,
    };
  }

  const height = rect.width / stageAspect;

  return {
    height,
    width: rect.width,
    x: 0,
    y: (rect.height - height) / 2,
  };
};

const drawScene = (
  k: KAPLAYCtx,
  snapshot: MatchResultRuntimeSnapshot,
  activeEffect: ShoveEffect | null,
  canvas: HTMLCanvasElement,
  configuredStage: MotionRect,
  testControlsEnabled: boolean,
) => {
  const layout = projectMatchResultLayout(
    snapshot,
    measuredCanvasCssWidth(canvas),
  );
  const synchronized = stagesMatch(layout.stage, configuredStage);

  if (!synchronized) {
    k.drawRect({
      color: k.rgb(247, 244, 234),
      height: configuredStage.height,
      pos: k.vec2(0, 0),
      width: configuredStage.width,
    });

    if (testControlsEnabled) {
      publishDebugLayout(k, canvas, layout, configuredStage, synchronized);
    }

    return;
  }

  const shoveProjection = activeEffect
    ? projectShoveMotion(activeEffect, layout)
    : null;

  k.drawRect({
    color: k.rgb(247, 244, 234),
    height: layout.stage.height,
    pos: k.vec2(0, 0),
    width: layout.stage.width,
  });

  drawStageBackdrop(k, layout.stage);

  for (const projectedChoice of layout.choices) {
    if (projectedChoice.isRejected && !shoveProjection) {
      continue;
    }

    const offsetX = projectedChoice.isRejected
      ? (shoveProjection?.rejectedOffsetX ?? 0)
      : 0;

    drawChoiceCard(k, {
      focused: snapshot.focusedValue === projectedChoice.choice.value,
      labelBlock: offsetTextBlock(projectedChoice.labelBlock, offsetX),
      pickedBlock: projectedChoice.pickedBlock
        ? offsetTextBlock(projectedChoice.pickedBlock, offsetX)
        : null,
      rect: {
        ...projectedChoice.rect,
        x: projectedChoice.rect.x + offsetX,
      },
      selected: projectedChoice.isSelected,
      selectionIndicator: projectedChoice.selectionIndicator
        ? offsetRect(projectedChoice.selectionIndicator, offsetX)
        : null,
      tone: projectedChoice.isRejected ? 'rejected' : 'primary',
    });
  }

  if (shoveProjection) {
    drawRooster(k, shoveProjection);
  }

  if (testControlsEnabled) {
    publishDebugLayout(k, canvas, layout, configuredStage, synchronized);
  }
};

const publishDebugLayout = (
  k: KAPLAYCtx,
  canvas: HTMLCanvasElement,
  layout: ReturnType<typeof projectMatchResultLayout>,
  configuredStage: MotionRect,
  synchronized: boolean,
) => {
  const canvasRect = canvas.getBoundingClientRect();

  window.__RUGBY_ROOSTER_KAPLAY_LAST_LAYOUT__ = {
    choices: layout.choices.map((choice) => ({
      hitTestable: synchronized && choice.hitTestable,
      isRejected: choice.isRejected,
      isSelected: choice.isSelected,
      label: choice.choice.label,
      labelCssFontSize: choice.labelBlock.fontSize * layout.displayScale,
      labelLines: choice.labelBlock.lines,
      rect: choice.rect,
      targetCssHeight: choice.rect.height * layout.displayScale,
      value: choice.choice.value,
    })),
    contentBounds: layout.contentBounds,
    displayScale: layout.displayScale,
    isCompact: layout.isCompact,
    rejectedGroup: layout.rejectedGroup,
    selectedChoice: layout.selectedChoice?.rect ?? null,
    stage: layout.stage,
    synchronized,
    viewport: {
      canvasCssBounds: {
        height: canvasRect.height,
        width: canvasRect.width,
        x: canvasRect.left,
        y: canvasRect.top,
      },
      drawingBuffer: {
        height: canvas.height,
        width: canvas.width,
      },
      engine: {
        height: k.height(),
        width: k.width(),
      },
      renderedContentBounds: renderedContentRect(canvasRect, configuredStage),
    },
  };
};

const offsetRect = (rect: MotionRect, offsetX: number): MotionRect => ({
  ...rect,
  x: rect.x + offsetX,
});

const offsetTextBlock = (
  block: ProjectedTextBlock,
  offsetX: number,
): ProjectedTextBlock => ({
  ...block,
  rect: offsetRect(block.rect, offsetX),
});

const drawStageBackdrop = (k: KAPLAYCtx, rect: MotionRect) => {
  k.drawRect({
    color: k.rgb(252, 248, 235),
    height: rect.height,
    pos: k.vec2(rect.x, rect.y),
    width: rect.width,
  });
  k.drawRect({
    color: k.rgb(231, 237, 214),
    height: 112,
    pos: k.vec2(0, rect.height - 112),
    width: rect.width,
  });
  k.drawRect({
    color: k.rgb(196, 214, 171),
    height: 5,
    pos: k.vec2(0, rect.height - 114),
    width: rect.width,
  });
  k.drawLine({
    color: k.rgb(212, 204, 184),
    p1: k.vec2(62, rect.height - 104),
    p2: k.vec2(654, rect.height - 122),
    width: 3,
  });
};

const drawChoiceCard = (
  k: KAPLAYCtx,
  {
    focused,
    labelBlock,
    pickedBlock,
    rect,
    selected,
    selectionIndicator,
    tone,
  }: {
    readonly focused: boolean;
    readonly labelBlock: ProjectedTextBlock;
    readonly pickedBlock: ProjectedTextBlock | null;
    readonly rect: MotionRect;
    readonly selected: boolean;
    readonly selectionIndicator: MotionRect | null;
    readonly tone: 'primary' | 'rejected';
  },
) => {
  const fill = selected
    ? k.rgb(204, 49, 42)
    : tone === 'rejected'
      ? k.rgb(255, 252, 242)
      : k.rgb(255, 255, 255);
  const outline = selected
    ? k.rgb(204, 49, 42)
    : focused
      ? k.rgb(249, 196, 64)
      : k.rgb(207, 198, 174);
  const textColor = selected ? k.rgb(255, 255, 255) : k.rgb(22, 31, 38);

  k.drawRect({
    color: fill,
    height: rect.height,
    outline: {
      color: outline,
      width: focused ? 5 : 3,
    },
    pos: k.vec2(rect.x, rect.y),
    radius: 8,
    width: rect.width,
  });

  if (pickedBlock) {
    drawTextBlock(k, {
      block: pickedBlock,
      color: k.rgb(255, 230, 180),
    });
  }

  drawTextBlock(k, {
    block: labelBlock,
    color: textColor,
  });

  if (selected && selectionIndicator) {
    k.drawRect({
      color: k.rgb(249, 196, 64),
      height: selectionIndicator.height,
      pos: k.vec2(selectionIndicator.x, selectionIndicator.y),
      radius: 6,
      width: selectionIndicator.width,
    });
  }
};

const drawRooster = (k: KAPLAYCtx, projection: ShoveProjection) => {
  const centerX = projection.roosterRect.x + projection.roosterRect.width / 2;
  const centerY = projection.roosterRect.y + projection.roosterRect.height / 2;
  const width = projection.roosterRect.width * projection.roosterScaleX;
  const height = projection.roosterRect.height * projection.roosterScaleY;

  k.drawSprite({
    anchor: 'center',
    frame: projection.roosterFrame,
    height,
    opacity: projection.roosterOpacity,
    pos: k.vec2(centerX, centerY),
    sprite: ROOSTER_SHOVE_SPRITE_NAME,
    width,
  });
};

const drawTextBlock = (
  k: KAPLAYCtx,
  {
    block,
    color,
  }: {
    readonly block: ProjectedTextBlock;
    readonly color: ReturnType<KAPLAYCtx['rgb']>;
  },
) => {
  block.lines.forEach((line, index) => {
    k.drawText({
      color,
      pos: k.vec2(
        block.rect.x,
        block.rect.y + index * block.lineHeight,
      ) as Vec2,
      size: block.fontSize,
      text: line,
      width: block.rect.width,
    });
  });
};
