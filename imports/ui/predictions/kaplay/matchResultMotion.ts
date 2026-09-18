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

export interface ProjectedChoice {
  readonly choice: MatchResultMotionChoice;
  readonly hitTestable: boolean;
  readonly isRejected: boolean;
  readonly isSelected: boolean;
  readonly rect: MotionRect;
  readonly visible: boolean;
}

export interface MatchResultLayout {
  readonly choices: readonly ProjectedChoice[];
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

const selectedValueFromSnapshot = (
  snapshot: MatchResultMotionSnapshot,
): MatchResultChoiceValue | null =>
  snapshot.choices.find((choice) => choice.selected)?.value ?? null;

const selectedChoiceRect = (isCompact: boolean): MotionRect => ({
  height: isCompact ? 106 : 98,
  width: isCompact ? 624 : 584,
  x: isCompact ? 48 : 68,
  y: isCompact ? 34 : 40,
});

const initialChoiceRect = (index: number, isCompact: boolean): MotionRect => {
  const height = isCompact ? 74 : 78;
  const gap = isCompact ? 13 : 15;
  const width = isCompact ? 624 : 584;

  return {
    height,
    width,
    x: (MATCH_RESULT_SCENE_WIDTH - width) / 2,
    y: (isCompact ? 82 : 88) + index * (height + gap),
  };
};

const rejectedChoiceRect = (
  rejectedIndex: number,
  isCompact: boolean,
): MotionRect => {
  const height = isCompact ? 62 : 60;
  const gap = isCompact ? 10 : 12;
  const width = isCompact ? 440 : 388;

  return {
    height,
    width,
    x: isCompact ? 230 : 252,
    y: (isCompact ? 214 : 220) + rejectedIndex * (height + gap),
  };
};

export const projectMatchResultLayout = (
  snapshot: MatchResultMotionSnapshot,
  viewportWidth = MATCH_RESULT_SCENE_WIDTH,
): MatchResultLayout => {
  const isCompact = viewportWidth < 560;
  const selectedValue = selectedValueFromSnapshot(snapshot);

  if (snapshot.choicePresentation === 'choices' || !selectedValue) {
    return {
      choices: snapshot.choices.map((choice, index) => ({
        choice,
        hitTestable: true,
        isRejected: false,
        isSelected: choice.selected,
        rect: initialChoiceRect(index, isCompact),
        visible: true,
      })),
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
  const selectedProjection: ProjectedChoice | null = selectedChoice
    ? {
        choice: selectedChoice,
        hitTestable: false,
        isRejected: false,
        isSelected: true,
        rect: selectedChoiceRect(isCompact),
        visible: true,
      }
    : null;
  const rejectedProjections = rejectedChoices.map((choice, index) => ({
    choice,
    hitTestable: false,
    isRejected: true,
    isSelected: false,
    rect: rejectedChoiceRect(index, isCompact),
    visible: true,
  }));
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
  const entryStartX = -spriteWidth - 48;
  const contactX = group.x - contactOffsetX + 8;
  const exitGroupX = MATCH_RESULT_SCENE_WIDTH + 96;
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

    return {
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
    };
  }

  if (phase === 'contact') {
    const progress = clamp01(
      (elapsed - ROOSTER_SHOVE_CONTACT_SECONDS) /
        (ROOSTER_SHOVE_PUSH_START_SECONDS - ROOSTER_SHOVE_CONTACT_SECONDS),
    );

    return {
      phase,
      progress,
      rejectedOffsetX: progress * 10,
      roosterFrame: animationFrame('pushRun', elapsed),
      roosterOpacity: 1,
      roosterRect: {
        height: spriteHeight,
        width: spriteWidth,
        x: contactX + progress * 10,
        y: laneGroundY - anchorOffsetY + progress * 3,
      },
      roosterScaleX: 1 + Math.sin(progress * Math.PI) * 0.035,
      roosterScaleY: 1 - Math.sin(progress * Math.PI) * 0.025,
    };
  }

  const progress = clamp01(
    (elapsed - ROOSTER_SHOVE_PUSH_START_SECONDS) /
      (ROOSTER_SHOVE_DURATION_SECONDS - ROOSTER_SHOVE_PUSH_START_SECONDS),
  );
  const drivenProgress = easeInOut(progress);
  const groupX = group.x + (exitGroupX - group.x) * drivenProgress;
  const roosterX = groupX - contactOffsetX + 8;
  const driveBounce = Math.sin(elapsed * Math.PI * 22) * 3;

  return {
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
