import type { SpriteAtlasData } from 'kaplay';

import roosterManifest from './roosterShoveManifest.generated.json';

export type MatchResultChoiceValue = 'draw' | 'team1' | 'team2';

export interface MatchResultMotionChoice {
  readonly label: string;
  readonly selected: boolean;
  readonly value: MatchResultChoiceValue;
}

export interface MatchResultMotionSnapshot {
  readonly choices: readonly MatchResultMotionChoice[];
  readonly choicePresentation: 'choices' | 'selected';
  readonly focusedValue: MatchResultChoiceValue | null;
  readonly pickedLabel: string | null;
  readonly selectionEffectId: number;
}

export interface MotionRect {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface ProjectedTextBlock {
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly lines: readonly string[];
  readonly rect: MotionRect;
}

export interface ProjectedChoice {
  readonly choice: MatchResultMotionChoice;
  readonly hitTestable: boolean;
  readonly isRejected: boolean;
  readonly isSelected: boolean;
  readonly labelBlock: ProjectedTextBlock;
  readonly pickedBlock: ProjectedTextBlock | null;
  readonly rect: MotionRect;
  readonly selectionIndicator: MotionRect | null;
  readonly visible: boolean;
}

export interface MatchResultLayout {
  readonly choices: readonly ProjectedChoice[];
  readonly displayScale: number;
  readonly isCompact: boolean;
  readonly rejectedGroup: MotionRect | null;
  readonly selectedChoice: ProjectedChoice | null;
  readonly stage: MotionRect;
}

export interface ShoveEffect {
  readonly elapsedSeconds: number;
  readonly id: number;
  readonly selectedValue: MatchResultChoiceValue;
}

export interface ShoveProjection {
  readonly phase: 'contact' | 'entry' | 'push';
  readonly progress: number;
  readonly rejectedOffsetX: number;
  readonly roosterFrame: number;
  readonly roosterBounds: MotionRect;
  readonly roosterOpacity: number;
  readonly roosterRect: MotionRect;
  readonly roosterScaleX: number;
  readonly roosterScaleY: number;
}

export const MATCH_RESULT_SCENE_WIDTH = 720;
export const MATCH_RESULT_SCENE_HEIGHT = 520;
export const ROOSTER_SHOVE_DURATION_SECONDS = 0.76;
export const ROOSTER_SHOVE_CONTACT_SECONDS = 0.34;
export const ROOSTER_SHOVE_PUSH_START_SECONDS = 0.4;

export const ROOSTER_SHOVE_ATLAS_URL = roosterManifest.atlas.image;
export const ROOSTER_SHOVE_SPRITE_NAME = roosterManifest.atlas.spriteName;
export const ROOSTER_SHOVE_ATLAS_DATA =
  roosterManifest.kaplayAtlas as SpriteAtlasData;
export const ROOSTER_SHOVE_MANIFEST = roosterManifest;

const stageRect: MotionRect = {
  height: MATCH_RESULT_SCENE_HEIGHT,
  width: MATCH_RESULT_SCENE_WIDTH,
  x: 0,
  y: 0,
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const easeInOut = (value: number) =>
  value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;

const displayScaleForViewport = (viewportWidth: number) =>
  Math.max(0.1, viewportWidth / MATCH_RESULT_SCENE_WIDTH);

const cssPixelsToScene = (cssPixels: number, displayScale: number) =>
  cssPixels / displayScale;

const readableFontSize = (
  baseSceneSize: number,
  targetCssPixels: number,
  displayScale: number,
) => Math.max(baseSceneSize, cssPixelsToScene(targetCssPixels, displayScale));

const estimatedCharacterWidth = (fontSize: number) => fontSize * 0.56;

const splitLongWord = (
  word: string,
  maxWidth: number,
  fontSize: number,
): string[] => {
  const maxCharacters = Math.max(
    1,
    Math.floor(maxWidth / estimatedCharacterWidth(fontSize)),
  );
  const chunks: string[] = [];

  for (let index = 0; index < word.length; index += maxCharacters) {
    chunks.push(word.slice(index, index + maxCharacters));
  }

  return chunks;
};

const wrapTextLines = (
  text: string,
  maxWidth: number,
  fontSize: number,
): readonly string[] => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const sourceWords = words.length > 0 ? words : [text];
  const lines: string[] = [];
  let currentLine = '';

  for (const sourceWord of sourceWords) {
    const wordParts =
      sourceWord.length * estimatedCharacterWidth(fontSize) > maxWidth
        ? splitLongWord(sourceWord, maxWidth, fontSize)
        : [sourceWord];

    for (const word of wordParts) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;

      if (
        currentLine &&
        candidate.length * estimatedCharacterWidth(fontSize) > maxWidth
      ) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
};

const measureTextBlock = (
  text: string,
  fontSize: number,
  width: number,
): Omit<ProjectedTextBlock, 'rect'> & {
  readonly height: number;
  readonly width: number;
} => {
  const lineHeight = fontSize * 1.16;
  const lines = wrapTextLines(text, width, fontSize);

  return {
    fontSize,
    height: lineHeight * lines.length,
    lineHeight,
    lines,
    width,
  };
};

const placeTextBlock = (
  measure: Omit<ProjectedTextBlock, 'rect'> & {
    readonly height: number;
    readonly width: number;
  },
  x: number,
  y: number,
): ProjectedTextBlock => ({
  fontSize: measure.fontSize,
  lineHeight: measure.lineHeight,
  lines: measure.lines,
  rect: {
    height: measure.height,
    width: measure.width,
    x,
    y,
  },
});

const selectedValueFromSnapshot = (
  snapshot: MatchResultMotionSnapshot,
): MatchResultChoiceValue | null =>
  snapshot.choices.find((choice) => choice.selected)?.value ?? null;

const baseChoiceLabelFontSize = ({
  displayScale,
  isCompact,
  selected,
  text,
}: {
  readonly displayScale: number;
  readonly isCompact: boolean;
  readonly selected: boolean;
  readonly text: string;
}) => {
  if (isCompact) {
    return readableFontSize(selected ? 38 : 37, 16, displayScale);
  }

  return text.length > 30 ? (selected ? 22 : 18) : selected ? 30 : 25;
};

const pickedLabelFontSize = (isCompact: boolean, displayScale: number) =>
  isCompact ? readableFontSize(30, 14, displayScale) : 18;

const choiceHorizontalPadding = (isCompact: boolean) => (isCompact ? 30 : 28);
const choiceVerticalPadding = (isCompact: boolean) => (isCompact ? 18 : 14);

const selectionIndicatorRect = (
  rect: MotionRect,
  isCompact: boolean,
): MotionRect => {
  const width = isCompact ? 38 : 30;
  const height = isCompact ? 16 : 14;

  return {
    height,
    width,
    x: rect.x + rect.width - (isCompact ? 66 : 58),
    y: rect.y + rect.height / 2 - height / 2,
  };
};

const choiceTextWidth = ({
  isCompact,
  rectWidth,
  selected,
}: {
  readonly isCompact: boolean;
  readonly rectWidth: number;
  readonly selected: boolean;
}) =>
  rectWidth -
  choiceHorizontalPadding(isCompact) * 2 -
  (selected ? (isCompact ? 82 : 72) : 0);

const measureChoiceContent = ({
  choice,
  displayScale,
  isCompact,
  pickedLabel,
  rectWidth,
  selected,
}: {
  readonly choice: MatchResultMotionChoice;
  readonly displayScale: number;
  readonly isCompact: boolean;
  readonly pickedLabel: string | null;
  readonly rectWidth: number;
  readonly selected: boolean;
}) => {
  const textWidth = choiceTextWidth({
    isCompact,
    rectWidth,
    selected,
  });
  const labelFontSize = baseChoiceLabelFontSize({
    displayScale,
    isCompact,
    selected,
    text: choice.label,
  });
  const label = measureTextBlock(choice.label, labelFontSize, textWidth);
  const picked = pickedLabel
    ? measureTextBlock(
        pickedLabel,
        pickedLabelFontSize(isCompact, displayScale),
        textWidth,
      )
    : null;
  const gap = isCompact ? 8 : 6;
  const contentHeight = picked
    ? picked.height + gap + label.height
    : label.height;

  return {
    contentHeight,
    gap,
    label,
    picked,
    textWidth,
  };
};

const projectChoice = ({
  baseHeight,
  choice,
  displayScale,
  hitTestable,
  isCompact,
  isRejected,
  pickedLabel,
  rectWidth,
  selected,
  x,
  y,
}: {
  readonly baseHeight: number;
  readonly choice: MatchResultMotionChoice;
  readonly displayScale: number;
  readonly hitTestable: boolean;
  readonly isCompact: boolean;
  readonly isRejected: boolean;
  readonly pickedLabel: string | null;
  readonly rectWidth: number;
  readonly selected: boolean;
  readonly x: number;
  readonly y: number;
}): ProjectedChoice => {
  const content = measureChoiceContent({
    choice,
    displayScale,
    isCompact,
    pickedLabel,
    rectWidth,
    selected,
  });
  const height = Math.max(
    baseHeight,
    content.contentHeight + choiceVerticalPadding(isCompact) * 2,
  );
  const rect: MotionRect = {
    height,
    width: rectWidth,
    x,
    y,
  };
  const textX = x + choiceHorizontalPadding(isCompact);
  const contentTop =
    y +
    Math.max(
      choiceVerticalPadding(isCompact),
      (height - content.contentHeight) / 2,
    );
  const pickedBlock = content.picked
    ? placeTextBlock(content.picked, textX, contentTop)
    : null;
  const labelY = pickedBlock
    ? pickedBlock.rect.y + pickedBlock.rect.height + content.gap
    : y + (height - content.label.height) / 2;
  const labelBlock = placeTextBlock(content.label, textX, labelY);
  const indicator = selected ? selectionIndicatorRect(rect, isCompact) : null;

  return {
    choice,
    hitTestable,
    isRejected,
    isSelected: selected,
    labelBlock,
    pickedBlock,
    rect,
    selectionIndicator: indicator,
    visible: true,
  };
};

export const projectMatchResultLayout = (
  snapshot: MatchResultMotionSnapshot,
  viewportWidth = MATCH_RESULT_SCENE_WIDTH,
): MatchResultLayout => {
  const isCompact = viewportWidth < 560;
  const displayScale = displayScaleForViewport(viewportWidth);
  const selectedValue = selectedValueFromSnapshot(snapshot);

  if (snapshot.choicePresentation === 'choices' || !selectedValue) {
    const width = isCompact ? 608 : 584;
    const baseHeight = isCompact ? 108 : 78;
    const gap = isCompact ? 10 : 15;
    let nextY = isCompact ? 42 : 88;
    const choices = snapshot.choices.map((choice) => {
      const projectedChoice = projectChoice({
        baseHeight,
        choice,
        displayScale,
        hitTestable: true,
        isCompact,
        isRejected: false,
        pickedLabel: null,
        rectWidth: width,
        selected: choice.selected,
        x: (MATCH_RESULT_SCENE_WIDTH - width) / 2,
        y: nextY,
      });

      nextY += projectedChoice.rect.height + gap;

      return projectedChoice;
    });

    return {
      choices,
      displayScale,
      isCompact,
      rejectedGroup: null,
      selectedChoice: null,
      stage: stageRect,
    };
  }

  const selectedChoice = snapshot.choices.find(
    (choice) => choice.value === selectedValue,
  );
  const rejectedChoices = snapshot.choices.filter(
    (choice) => choice.value !== selectedValue,
  );
  const selectedWidth = isCompact ? 608 : 584;
  const selectedProjection: ProjectedChoice | null = selectedChoice
    ? projectChoice({
        baseHeight: isCompact ? 112 : 98,
        choice: selectedChoice,
        displayScale,
        hitTestable: false,
        isCompact,
        isRejected: false,
        pickedLabel: snapshot.pickedLabel ? 'You picked' : null,
        rectWidth: selectedWidth,
        selected: true,
        x: (MATCH_RESULT_SCENE_WIDTH - selectedWidth) / 2,
        y: isCompact ? 28 : 40,
      })
    : null;
  const rejectedWidth = isCompact ? 500 : 388;
  const rejectedGap = isCompact ? 10 : 12;
  const rejectedStartY = selectedProjection
    ? selectedProjection.rect.y +
      selectedProjection.rect.height +
      (isCompact ? 42 : 82)
    : isCompact
      ? 214
      : 220;
  let nextRejectedY = rejectedStartY;
  const rejectedProjections = rejectedChoices.map((choice) => {
    const projectedChoice = projectChoice({
      baseHeight: isCompact ? 94 : 60,
      choice,
      displayScale,
      hitTestable: false,
      isCompact,
      isRejected: true,
      pickedLabel: null,
      rectWidth: rejectedWidth,
      selected: false,
      x: isCompact ? 188 : 252,
      y: nextRejectedY,
    });

    nextRejectedY += projectedChoice.rect.height + rejectedGap;

    return projectedChoice;
  });
  const rejectedGroup =
    rejectedProjections.length > 0
      ? rejectedProjections.reduce<MotionRect>(
          (group, projection) => ({
            height:
              Math.max(
                group.y + group.height,
                projection.rect.y + projection.rect.height,
              ) - Math.min(group.y, projection.rect.y),
            width:
              Math.max(
                group.x + group.width,
                projection.rect.x + projection.rect.width,
              ) - Math.min(group.x, projection.rect.x),
            x: Math.min(group.x, projection.rect.x),
            y: Math.min(group.y, projection.rect.y),
          }),
          rejectedProjections[0].rect,
        )
      : null;

  return {
    choices: selectedProjection
      ? [selectedProjection, ...rejectedProjections]
      : rejectedProjections,
    displayScale,
    isCompact,
    rejectedGroup,
    selectedChoice: selectedProjection,
    stage: stageRect,
  };
};

export const createShoveEffect = (
  id: number,
  selectedValue: MatchResultChoiceValue,
): ShoveEffect => ({
  elapsedSeconds: 0,
  id,
  selectedValue,
});

export const advanceShoveEffect = (
  effect: ShoveEffect | null,
  deltaSeconds: number,
  snapshot: MatchResultMotionSnapshot,
): ShoveEffect | null => {
  if (!effect) {
    return null;
  }

  const selectedValue = selectedValueFromSnapshot(snapshot);

  if (
    snapshot.choicePresentation === 'choices' ||
    snapshot.selectionEffectId !== effect.id ||
    selectedValue !== effect.selectedValue
  ) {
    return null;
  }

  const elapsedSeconds = effect.elapsedSeconds + Math.max(0, deltaSeconds);

  if (elapsedSeconds >= ROOSTER_SHOVE_DURATION_SECONDS) {
    return null;
  }

  return {
    ...effect,
    elapsedSeconds,
  };
};

export const projectShoveMotion = (
  effect: ShoveEffect,
  layout: MatchResultLayout,
): ShoveProjection | null => {
  const group = layout.rejectedGroup;

  if (!group) {
    return null;
  }

  const frame = ROOSTER_SHOVE_MANIFEST.frame;
  const contactPoint = ROOSTER_SHOVE_MANIFEST.visualAnchors.contactPoint;
  const frameAnchor = ROOSTER_SHOVE_MANIFEST.visualAnchors.frameAnchor;
  const spriteHeight = layout.isCompact ? 168 : 178;
  const spriteWidth = (frame.width / frame.height) * spriteHeight;
  const spriteScale = spriteHeight / frame.height;
  const contactOffsetX = contactPoint.x * spriteScale;
  const anchorOffsetY = frameAnchor.y * spriteScale;
  const laneGroundY = layout.isCompact ? 424 : 414;
  const contactInsetX = 8;
  const contactNudgeX = 10;
  const entryStartX = -spriteWidth - 48;
  const contactX = group.x - contactOffsetX + contactInsetX;
  const contactEndpointGroupX = group.x + contactNudgeX;
  const contactEndpointRoosterX =
    contactEndpointGroupX - contactOffsetX + contactInsetX;
  const stageRight = layout.stage.x + layout.stage.width;
  const exitMargin = layout.isCompact ? 56 : 64;
  const requiredExitGroupX = Math.max(
    stageRight + exitMargin,
    stageRight + exitMargin + contactOffsetX - contactInsetX,
  );
  const pushDuration =
    ROOSTER_SHOVE_DURATION_SECONDS - ROOSTER_SHOVE_PUSH_START_SECONDS;
  const safetyProgress = easeInOut(
    clamp01((pushDuration - 0.1) / pushDuration),
  );
  const exitGroupX =
    contactEndpointGroupX +
    (requiredExitGroupX - contactEndpointGroupX) /
      Math.max(safetyProgress, 0.01);
  const elapsed = effect.elapsedSeconds;
  const phase =
    elapsed < ROOSTER_SHOVE_CONTACT_SECONDS
      ? 'entry'
      : elapsed < ROOSTER_SHOVE_PUSH_START_SECONDS
        ? 'contact'
        : 'push';

  if (phase === 'entry') {
    const progress = easeInOut(elapsed / ROOSTER_SHOVE_CONTACT_SECONDS);
    const roosterX = entryStartX + (contactX - entryStartX) * progress;
    const bounce = Math.sin(progress * Math.PI * 5) * 3;

    return shoveProjectionWithBounds({
      phase,
      progress,
      rejectedOffsetX: 0,
      roosterFrame: animationFrame('run', elapsed),
      roosterOpacity: 1,
      roosterRect: {
        height: spriteHeight,
        width: spriteWidth,
        x: roosterX,
        y: laneGroundY - anchorOffsetY + bounce,
      },
      roosterScaleX: 1,
      roosterScaleY: 1,
    });
  }

  if (phase === 'contact') {
    const progress = clamp01(
      (elapsed - ROOSTER_SHOVE_CONTACT_SECONDS) /
        (ROOSTER_SHOVE_PUSH_START_SECONDS - ROOSTER_SHOVE_CONTACT_SECONDS),
    );

    return shoveProjectionWithBounds({
      phase,
      progress,
      rejectedOffsetX: progress * contactNudgeX,
      roosterFrame: animationFrame('pushRun', elapsed),
      roosterOpacity: 1,
      roosterRect: {
        height: spriteHeight,
        width: spriteWidth,
        x: contactX + progress * contactNudgeX,
        y: laneGroundY - anchorOffsetY + progress * 3,
      },
      roosterScaleX: 1 + Math.sin(progress * Math.PI) * 0.035,
      roosterScaleY: 1 - Math.sin(progress * Math.PI) * 0.025,
    });
  }

  const progress = clamp01(
    (elapsed - ROOSTER_SHOVE_PUSH_START_SECONDS) /
      (ROOSTER_SHOVE_DURATION_SECONDS - ROOSTER_SHOVE_PUSH_START_SECONDS),
  );
  const drivenProgress = easeInOut(progress);
  const groupX =
    contactEndpointGroupX +
    (exitGroupX - contactEndpointGroupX) * drivenProgress;
  const roosterX =
    contactEndpointRoosterX +
    (exitGroupX - contactEndpointGroupX) * drivenProgress;
  const driveBounce =
    3 +
    Math.sin((elapsed - ROOSTER_SHOVE_PUSH_START_SECONDS) * Math.PI * 22) * 3;

  return shoveProjectionWithBounds({
    phase,
    progress: drivenProgress,
    rejectedOffsetX: groupX - group.x,
    roosterFrame: animationFrame('pushRun', elapsed),
    roosterOpacity: 1,
    roosterRect: {
      height: spriteHeight,
      width: spriteWidth,
      x: roosterX,
      y: laneGroundY - anchorOffsetY + driveBounce,
    },
    roosterScaleX: 1,
    roosterScaleY: 1,
  });
};

const shoveProjectionWithBounds = (
  projection: Omit<ShoveProjection, 'roosterBounds'>,
): ShoveProjection => ({
  ...projection,
  roosterBounds: transformedRoosterBounds(
    projection.roosterRect,
    projection.roosterScaleX,
    projection.roosterScaleY,
  ),
});

const transformedRoosterBounds = (
  rect: MotionRect,
  scaleX: number,
  scaleY: number,
): MotionRect => {
  const width = rect.width * scaleX;
  const height = rect.height * scaleY;

  return {
    height,
    width,
    x: rect.x + rect.width / 2 - width / 2,
    y: rect.y + rect.height / 2 - height / 2,
  };
};

export const choiceAtPoint = (
  layout: MatchResultLayout,
  point: { readonly x: number; readonly y: number },
): MatchResultMotionChoice | null => {
  const hit = layout.choices.find(
    (choice) =>
      choice.visible &&
      choice.hitTestable &&
      point.x >= choice.rect.x &&
      point.x <= choice.rect.x + choice.rect.width &&
      point.y >= choice.rect.y &&
      point.y <= choice.rect.y + choice.rect.height,
  );

  return hit?.choice ?? null;
};

const animationFrame = (animation: 'pushRun' | 'run', elapsed: number) => {
  const definition = ROOSTER_SHOVE_MANIFEST.animations[animation];
  const index = Math.floor(elapsed * definition.fps) % definition.frames.length;

  return definition.frames[index];
};
