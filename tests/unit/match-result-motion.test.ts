import { describe, expect, it } from 'vitest';

import {
  advanceShoveEffect,
  choiceAtPoint,
  createShoveEffect,
  ROOSTER_SHOVE_CONTACT_SECONDS,
  ROOSTER_SHOVE_PUSH_START_SECONDS,
  projectMatchResultLayout,
  projectShoveMotion,
  ROOSTER_SHOVE_DURATION_SECONDS,
  ROOSTER_SHOVE_MANIFEST,
  type MatchResultMotionSnapshot,
} from '../../imports/ui/predictions/kaplay/matchResultMotion';

const snapshot = ({
  choicePresentation = 'selected',
  focusedValue = null,
  selectionEffectId = 1,
  selected = 'team1',
}: {
  readonly choicePresentation?: MatchResultMotionSnapshot['choicePresentation'];
  readonly focusedValue?: MatchResultMotionSnapshot['focusedValue'];
  readonly selectionEffectId?: number;
  readonly selected?: 'draw' | 'team1' | 'team2' | null;
} = {}): MatchResultMotionSnapshot => ({
  choicePresentation,
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
  focusedValue,
  pickedLabel:
    selected === 'team2'
      ? 'All Blacks'
      : selected === 'draw'
        ? 'Draw'
        : selected
          ? 'Springboks'
          : null,
  selectionEffectId,
});

const longNameSnapshot = ({
  choicePresentation = 'choices',
  focusedValue = null,
  selectionEffectId = 1,
  selected = null,
}: {
  readonly choicePresentation?: MatchResultMotionSnapshot['choicePresentation'];
  readonly focusedValue?: MatchResultMotionSnapshot['focusedValue'];
  readonly selectionEffectId?: number;
  readonly selected?: 'draw' | 'team1' | 'team2' | null;
} = {}): MatchResultMotionSnapshot => ({
  choicePresentation,
  choices: [
    {
      label: 'Cape Town Very Long Club Name XV',
      selected: selected === 'team1',
      value: 'team1',
    },
    {
      label: 'Johannesburg Equally Long Club Name XV',
      selected: selected === 'team2',
      value: 'team2',
    },
    {
      label: 'Draw',
      selected: selected === 'draw',
      value: 'draw',
    },
  ],
  focusedValue,
  pickedLabel:
    selected === 'team2'
      ? 'Johannesburg Equally Long Club Name XV'
      : selected === 'draw'
        ? 'Draw'
        : selected
          ? 'Cape Town Very Long Club Name XV'
          : null,
  selectionEffectId,
});

const shoveAt = (
  elapsedSeconds: number,
  viewportWidth: number,
  state: MatchResultMotionSnapshot = snapshot(),
) => {
  const layout = projectMatchResultLayout(state, viewportWidth);
  const projection = projectShoveMotion(
    {
      ...createShoveEffect(1, 'team1'),
      elapsedSeconds,
    },
    layout,
  );

  if (!projection || !layout.rejectedGroup) {
    throw new Error('Expected shove projection and rejected group.');
  }

  return { layout, projection };
};

const roosterContactX = (
  projection: NonNullable<ReturnType<typeof projectShoveMotion>>,
) => {
  const spriteScale =
    projection.roosterRect.height / ROOSTER_SHOVE_MANIFEST.frame.height;

  return (
    projection.roosterRect.x +
    ROOSTER_SHOVE_MANIFEST.visualAnchors.contactPoint.x * spriteScale
  );
};

const rejectedGroupLeft = (
  projection: NonNullable<ReturnType<typeof projectShoveMotion>>,
  groupX: number,
) => groupX + projection.rejectedOffsetX;

const stageRight = (layout: ReturnType<typeof projectMatchResultLayout>) =>
  layout.stage.x + layout.stage.width;

describe('match result rooster motion assets', () => {
  it('keeps prepared frame rectangles inside the runtime atlas', () => {
    for (const frame of ROOSTER_SHOVE_MANIFEST.frames) {
      expect(frame.atlasRect.x).toBeGreaterThanOrEqual(0);
      expect(frame.atlasRect.y).toBeGreaterThanOrEqual(0);
      expect(frame.atlasRect.x + frame.atlasRect.width).toBeLessThanOrEqual(
        ROOSTER_SHOVE_MANIFEST.atlas.width,
      );
      expect(frame.atlasRect.y + frame.atlasRect.height).toBeLessThanOrEqual(
        ROOSTER_SHOVE_MANIFEST.atlas.height,
      );
    }
  });

  it('records valid named animations and visual anchors', () => {
    const frameIndexes = new Set(
      ROOSTER_SHOVE_MANIFEST.frames.map((frame) => frame.index),
    );

    expect(ROOSTER_SHOVE_MANIFEST.animations.run.frames).toHaveLength(4);
    expect(ROOSTER_SHOVE_MANIFEST.animations.pushRun.frames).toHaveLength(4);

    for (const frame of [
      ...ROOSTER_SHOVE_MANIFEST.animations.run.frames,
      ...ROOSTER_SHOVE_MANIFEST.animations.pushRun.frames,
    ]) {
      expect(frameIndexes.has(frame)).toBe(true);
    }

    expect(ROOSTER_SHOVE_MANIFEST.visualAnchors.contactPoint.x).toBeGreaterThan(
      ROOSTER_SHOVE_MANIFEST.frame.width * 0.7,
    );
    expect(ROOSTER_SHOVE_MANIFEST.visualAnchors.frameAnchor.y).toBeGreaterThan(
      ROOSTER_SHOVE_MANIFEST.frame.height * 0.75,
    );
    expect(ROOSTER_SHOVE_MANIFEST.source.runtimeSheet.sha256).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });
});

describe('match result rooster shove projection', () => {
  it('keeps the intended short total duration', () => {
    expect(ROOSTER_SHOVE_DURATION_SECONDS).toBeGreaterThanOrEqual(0.6);
    expect(ROOSTER_SHOVE_DURATION_SECONDS).toBeLessThanOrEqual(0.8);
  });

  it('progresses entry to contact to push with whole-character offscreen exit', () => {
    const state = snapshot();
    const layout = projectMatchResultLayout(state, 960);
    const start = projectShoveMotion(createShoveEffect(1, 'team1'), layout);
    const contact = projectShoveMotion(
      {
        ...createShoveEffect(1, 'team1'),
        elapsedSeconds: 0.36,
      },
      layout,
    );
    const push = projectShoveMotion(
      {
        ...createShoveEffect(1, 'team1'),
        elapsedSeconds: 0.58,
      },
      layout,
    );
    const exit = projectShoveMotion(
      {
        ...createShoveEffect(1, 'team1'),
        elapsedSeconds: 0.75,
      },
      layout,
    );

    expect(start?.phase).toBe('entry');
    expect(contact?.phase).toBe('contact');
    expect(push?.phase).toBe('push');
    expect(exit?.phase).toBe('push');
    expect(start?.roosterRect.x).toBeLessThan(0);
    expect(contact?.roosterRect.x).toBeGreaterThan(start?.roosterRect.x ?? 0);
    expect(push?.rejectedOffsetX).toBeGreaterThan(
      contact?.rejectedOffsetX ?? 0,
    );
    expect(exit?.roosterBounds.x).toBeGreaterThan(stageRight(layout));
    expect(
      layout.rejectedGroup
        ? layout.rejectedGroup.x + (exit?.rejectedOffsetX ?? 0)
        : 0,
    ).toBeGreaterThan(stageRight(layout));
  });

  it.each([
    ['desktop', 720],
    ['compact', 312],
  ])(
    'keeps rooster and rejected cards continuous at the contact-to-push boundary on %s',
    (_label, viewportWidth) => {
      const before = shoveAt(
        ROOSTER_SHOVE_PUSH_START_SECONDS - 0.001,
        viewportWidth,
      );
      const boundary = shoveAt(ROOSTER_SHOVE_PUSH_START_SECONDS, viewportWidth);
      const after = shoveAt(
        ROOSTER_SHOVE_PUSH_START_SECONDS + 0.001,
        viewportWidth,
      );
      const positions = [before, boundary, after].map(
        ({ projection }) => projection.roosterBounds.x,
      );
      const offsets = [before, boundary, after].map(
        ({ projection }) => projection.rejectedOffsetX,
      );

      expect(
        Math.abs(
          boundary.projection.roosterBounds.x -
            before.projection.roosterBounds.x,
        ),
      ).toBeLessThan(0.5);
      expect(
        Math.abs(
          boundary.projection.rejectedOffsetX -
            before.projection.rejectedOffsetX,
        ),
      ).toBeLessThan(0.5);

      for (let index = 1; index < positions.length; index += 1) {
        expect(positions[index]).toBeGreaterThanOrEqual(
          positions[index - 1] - 0.05,
        );
        expect(offsets[index]).toBeGreaterThanOrEqual(
          offsets[index - 1] - 0.05,
        );
      }

      const contactRelationships = [before, boundary, after].map(
        ({ layout: currentLayout, projection }) =>
          roosterContactX(projection) -
          rejectedGroupLeft(projection, currentLayout.rejectedGroup?.x ?? 0),
      );

      expect(
        Math.max(...contactRelationships) - Math.min(...contactRelationships),
      ).toBeLessThan(0.1);
      expect(
        Math.abs(
          boundary.projection.roosterBounds.y -
            before.projection.roosterBounds.y,
        ),
      ).toBeLessThan(0.5);
    },
  );

  it.each([
    ['desktop', 720],
    ['compact', 312],
  ])(
    'keeps entry-to-contact geometry continuous on %s',
    (_label, viewportWidth) => {
      const before = shoveAt(
        ROOSTER_SHOVE_CONTACT_SECONDS - 0.001,
        viewportWidth,
      );
      const boundary = shoveAt(ROOSTER_SHOVE_CONTACT_SECONDS, viewportWidth);
      const after = shoveAt(
        ROOSTER_SHOVE_CONTACT_SECONDS + 0.001,
        viewportWidth,
      );

      expect(boundary.projection.roosterBounds.x).toBeCloseTo(
        before.projection.roosterBounds.x,
        0,
      );
      expect(after.projection.roosterBounds.x).toBeGreaterThanOrEqual(
        boundary.projection.roosterBounds.x - 0.05,
      );
      expect(
        Math.abs(
          boundary.projection.roosterBounds.y -
            before.projection.roosterBounds.y,
        ),
      ).toBeLessThan(0.5);
    },
  );

  it.each([
    ['desktop', 720],
    ['compact', 312],
  ])(
    'clears the full transformed rooster and rejected group before expiry on %s',
    (_label, viewportWidth) => {
      for (const frameInterval of [1 / 60, 1 / 30, 0.1]) {
        const { layout, projection } = shoveAt(
          ROOSTER_SHOVE_DURATION_SECONDS - frameInterval,
          viewportWidth,
        );

        expect(projection.phase).toBe('push');
        expect(ROOSTER_SHOVE_MANIFEST.animations.pushRun.frames).toContain(
          projection.roosterFrame,
        );
        expect(projection.roosterBounds.x).toBeGreaterThan(stageRight(layout));
        expect(
          layout.rejectedGroup
            ? layout.rejectedGroup.x + projection.rejectedOffsetX
            : 0,
        ).toBeGreaterThan(stageRight(layout));
      }
    },
  );

  it.each([
    ['360px portrait canvas area', 312],
    ['390px portrait canvas area', 342],
  ])(
    'keeps compact choices readable and hit-testable for %s',
    (_label, canvasWidth) => {
      const state = longNameSnapshot();
      const layout = projectMatchResultLayout(state, canvasWidth);

      expect(layout.isCompact).toBe(true);

      for (const choice of layout.choices) {
        expect(choice.rect.height * layout.displayScale).toBeGreaterThanOrEqual(
          44,
        );
        expect(
          choice.labelBlock.fontSize * layout.displayScale,
        ).toBeGreaterThanOrEqual(16);
        expect(
          choiceAtPoint(layout, {
            x: choice.rect.x + choice.rect.width / 2,
            y: choice.rect.y + choice.rect.height / 2,
          })?.value,
        ).toBe(choice.choice.value);
      }

      expect(layout.choices[0].labelBlock.lines.length).toBeGreaterThan(1);
      expect(layout.choices[1].labelBlock.lines.length).toBeGreaterThan(1);
      expect(
        Math.max(
          ...layout.choices.map((choice) => choice.rect.y + choice.rect.height),
        ),
      ).toBeLessThanOrEqual(layout.stage.height);
    },
  );

  it('keeps selected, rejected and indicator bounds separated in compact layout', () => {
    const layout = projectMatchResultLayout(
      longNameSnapshot({
        choicePresentation: 'selected',
        focusedValue: 'team1',
        selected: 'team1',
      }),
      312,
    );
    const selected = layout.selectedChoice;

    expect(selected).not.toBeNull();
    expect(layout.rejectedGroup).not.toBeNull();

    if (!selected || !layout.rejectedGroup || !selected.selectionIndicator) {
      return;
    }

    expect(selected.rect.y + selected.rect.height).toBeLessThan(
      layout.rejectedGroup.y,
    );
    expect(
      selected.labelBlock.rect.x + selected.labelBlock.rect.width,
    ).toBeLessThan(selected.selectionIndicator.x);

    for (const choice of layout.choices.filter((choice) => choice.isRejected)) {
      expect(choice.rect.y).toBeGreaterThan(
        selected.rect.y + selected.rect.height,
      );
      expect(
        choice.labelBlock.fontSize * layout.displayScale,
      ).toBeGreaterThanOrEqual(16);
    }
  });

  it('cancels obsolete effects when choices are restored or a newer id appears', () => {
    const effect = createShoveEffect(1, 'team1');

    expect(
      advanceShoveEffect(
        effect,
        0.1,
        snapshot({ choicePresentation: 'choices' }),
      ),
    ).toBeNull();
    expect(
      advanceShoveEffect(effect, 0.1, snapshot({ selectionEffectId: 2 })),
    ).toBeNull();
    expect(advanceShoveEffect(effect, 0.1, snapshot())).toMatchObject({
      elapsedSeconds: 0.1,
      id: 1,
      selectedValue: 'team1',
    });
  });
});
