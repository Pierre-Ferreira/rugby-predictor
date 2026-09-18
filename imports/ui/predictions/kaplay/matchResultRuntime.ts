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
  MATCH_RESULT_SCENE_HEIGHT,
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
  canvas,
  failOnNextPointer = false,
  failRequiredSpriteLoad = false,
  initialSnapshot,
  isSelectionAllowed,
  kaplay,
  motionTimeScale = 1,
  onFailure,
  onSelect,
}: KaplayMatchResultRuntimeInput & {
  readonly failOnNextPointer?: boolean;
  readonly failRequiredSpriteLoad?: boolean;
  readonly kaplay: KaplayFunction;
  readonly motionTimeScale?: number;
}): Promise<KaplayMatchResultRuntimeHandle> => {
  let snapshot = initialSnapshot;
  let disposed = false;
  let failed = false;
  let activeEffect: ShoveEffect | null = null;
  let lastSelectionEffectId = snapshot.selectionEffectId;
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
    height: MATCH_RESULT_SCENE_HEIGHT,
    letterbox: true,
    loadingScreen: false,
    maxFPS: 45,
    pixelDensity: conservativePixelDensity(),
    stretch: true,
    touchToMouse: false,
    width: MATCH_RESULT_SCENE_WIDTH,
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

          const pointer = pointerPositionInGame(canvas, event);
          const layout = projectMatchResultLayout(
            snapshot,
            canvas.getBoundingClientRect().width,
          );
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

    await loadRequiredRoosterAtlas(k, failRequiredSpriteLoad);

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
          drawScene(k, snapshot, activeEffect, canvas);
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

const loadRequiredRoosterAtlas = async (
  k: KAPLAYCtx,
  failRequiredSpriteLoad: boolean,
): Promise<void> => {
  const assetUrl = failRequiredSpriteLoad
    ? '/assets/rooster/match-result/missing-required-rooster-atlas.png'
    : ROOSTER_SHOVE_ATLAS_URL;
  const asset = k.loadSpriteAtlas(assetUrl, ROOSTER_SHOVE_ATLAS_DATA);

  await waitForKaplayAsset(asset);
};

const waitForKaplayAsset = <TValue>(asset: Asset<TValue>): Promise<TValue> =>
  new Promise((resolve, reject) => {
    if (asset.loaded && asset.data) {
      resolve(asset.data);
      return;
    }

    if (asset.error) {
      reject(asset.error);
      return;
    }

    asset.onLoad((data) => {
      resolve(data);
    });
    asset.onError((error) => {
      reject(error);
    });
  });

const pointerPositionInGame = (
  canvas: HTMLCanvasElement,
  event: PointerEvent,
): { readonly x: number; readonly y: number } => {
  const rect = canvas.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / rect.width) * MATCH_RESULT_SCENE_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * MATCH_RESULT_SCENE_HEIGHT,
  };
};

const drawScene = (
  k: KAPLAYCtx,
  snapshot: MatchResultRuntimeSnapshot,
  activeEffect: ShoveEffect | null,
  canvas: HTMLCanvasElement,
) => {
  const layout = projectMatchResultLayout(
    snapshot,
    canvas.getBoundingClientRect().width,
  );
  const shoveProjection = activeEffect
    ? projectShoveMotion(activeEffect, layout)
    : null;

  k.drawRect({
    color: k.rgb(247, 244, 234),
    height: MATCH_RESULT_SCENE_HEIGHT,
    pos: k.vec2(0, 0),
    width: MATCH_RESULT_SCENE_WIDTH,
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
      pickedLabel:
        projectedChoice.isSelected && snapshot.pickedLabel
          ? 'You picked'
          : null,
      rect: {
        ...projectedChoice.rect,
        x: projectedChoice.rect.x + offsetX,
      },
      selected: projectedChoice.isSelected,
      text: projectedChoice.choice.label,
      tone: projectedChoice.isRejected ? 'rejected' : 'primary',
    });
  }

  if (shoveProjection) {
    drawRooster(k, shoveProjection);
  }
};

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
    pos: k.vec2(0, MATCH_RESULT_SCENE_HEIGHT - 112),
    width: MATCH_RESULT_SCENE_WIDTH,
  });
  k.drawRect({
    color: k.rgb(196, 214, 171),
    height: 5,
    pos: k.vec2(0, MATCH_RESULT_SCENE_HEIGHT - 114),
    width: MATCH_RESULT_SCENE_WIDTH,
  });
  k.drawLine({
    color: k.rgb(212, 204, 184),
    p1: k.vec2(62, 416),
    p2: k.vec2(654, 398),
    width: 3,
  });
};

const drawChoiceCard = (
  k: KAPLAYCtx,
  {
    focused,
    pickedLabel,
    rect,
    selected,
    text,
    tone,
  }: {
    readonly focused: boolean;
    readonly pickedLabel: string | null;
    readonly rect: MotionRect;
    readonly selected: boolean;
    readonly text: string;
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

  if (pickedLabel) {
    drawTextBlock(k, {
      color: k.rgb(255, 230, 180),
      size: 18,
      text: pickedLabel,
      width: rect.width - 44,
      x: rect.x + 28,
      y: rect.y + 18,
    });
  }

  drawTextBlock(k, {
    color: textColor,
    size: selected ? labelSize(text, 30, 22) : labelSize(text, 25, 18),
    text,
    width: rect.width - 56,
    x: rect.x + 28,
    y: rect.y + (pickedLabel ? 48 : rect.height / 2 - 14),
  });

  if (selected) {
    k.drawRect({
      color: k.rgb(249, 196, 64),
      height: 14,
      pos: k.vec2(rect.x + rect.width - 58, rect.y + rect.height / 2 - 7),
      radius: 6,
      width: 30,
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

const labelSize = (text: string, normalSize: number, smallSize: number) =>
  text.length > 30 ? smallSize : normalSize;

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
