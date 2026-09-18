import { describe, expect, it } from 'vitest';

import {
  advanceShoveEffect,
  choiceAtPoint,
  createShoveEffect,
  MATCH_RESULT_MIN_CHOICE_CSS_HEIGHT,
  MATCH_RESULT_PRIMARY_LABEL_CSS_FONT_SIZE,
  MATCH_RESULT_SCENE_HEIGHT,
  ROOSTER_SHOVE_CONTACT_SECONDS,
  ROOSTER_SHOVE_PUSH_START_SECONDS,
  projectMatchResultLayout,
  projectShoveMotion,
  ROOSTER_SHOVE_DURATION_SECONDS,
  ROOSTER_SHOVE_MANIFEST,
  type MatchResultMotionSnapshot,
  type MotionRect,
  type ProjectedChoice,
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
  labels = {
    team1: 'Cape Town Very Long Club Name ccpp009c2a XV',
    team2: 'Johannesburg Equally Long Club Name ccpp009c2b XV',
  },
  selectionEffectId = 1,
  selected = null,
}: {
  readonly choicePresentation?: MatchResultMotionSnapshot['choicePresentation'];
  readonly focusedValue?: MatchResultMotionSnapshot['focusedValue'];
  readonly labels?: {
    readonly team1: string;
    readonly team2: string;
  };
  readonly selectionEffectId?: number;
  readonly selected?: 'draw' | 'team1' | 'team2' | null;
} = {}): MatchResultMotionSnapshot => ({
  choicePresentation,
  choices: [
    {
      label: labels.team1,
      selected: selected === 'team1',
      value: 'team1',
    },
    {
      label: labels.team2,
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
      ? labels.team2
      : selected === 'draw'
        ? 'Draw'
        : selected
          ? labels.team1
          : null,
  selectionEffectId,
});

const maximumNameSnapshot = (
  options: Parameters<typeof longNameSnapshot>[0] = {},
) =>
  longNameSnapshot({
    ...options,
    labels: {
      team1: `Cape Town ${'A'.repeat(70)}`,
      team2: `Johannesburg ${'B'.repeat(67)}`,
    },
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

const rectBottom = (rect: MotionRect) => rect.y + rect.height;
const rectRight = (rect: MotionRect) => rect.x + rect.width;

const expectRectInside = (inner: MotionRect, outer: MotionRect) => {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y);
  expect(rectRight(inner)).toBeLessThanOrEqual(rectRight(outer));
  expect(rectBottom(inner)).toBeLessThanOrEqual(rectBottom(outer));
};

const rectsOverlap = (first: MotionRect, second: MotionRect) =>
  first.x < rectRight(second) &&
  rectRight(first) > second.x &&
  first.y < rectBottom(second) &&
  rectBottom(first) > second.y;

const expectChoicesDoNotOverlap = (choices: readonly ProjectedChoice[]) => {
  choices.forEach((choice, index) => {
    for (
      let comparisonIndex = index + 1;
      comparisonIndex < choices.length;
      comparisonIndex += 1
    ) {
      expect(
        rectsOverlap(choice.rect, choices[comparisonIndex].rect),
      ).toBe(false);
    }
  });
};

const expectChoiceContentContained = (choice: ProjectedChoice) => {
  expectRectInside(choice.labelBlock.rect, choice.rect);

  if (choice.pickedBlock) {
    expectRectInside(choice.pickedBlock.rect, choice.rect);
  }

  if (choice.selectionIndicator) {
    expectRectInside(choice.selectionIndicator, choice.rect);
    expect(rectRight(choice.labelBlock.rect)).toBeLessThanOrEqual(
      choice.selectionIndicator.x,
    );
  }
};

const expectLayoutStaticContentFits = (
  layout: ReturnType<typeof projectMatchResultLayout>,
) => {
  expect(layout.contentBounds).not.toBeNull();

  if (layout.contentBounds) {
    expectRectInside(layout.contentBounds, layout.stage);
  }

  for (const choice of layout.choices) {
    expectRectInside(choice.rect, layout.stage);
    expectChoiceContentContained(choice);
  }

  expectChoicesDoNotOverlap(layout.choices);
};

const expectDisplayedReadableLabel = (choice: ProjectedChoice, scale: number) =>
  expect(choice.labelBlock.fontSize * scale).toBeGreaterThanOrEqual(
    MATCH_RESULT_PRIMARY_LABEL_CSS_FONT_SIZE - 0.01,
  );

const expectDisplayedSelectableHeight = (
  choice: ProjectedChoice,
  scale: number,
) =>
  expect(choice.rect.height * scale).toBeGreaterThanOrEqual(
    MATCH_RESULT_MIN_CHOICE_CSS_HEIGHT - 0.01,
  );

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

  it.each([272, 282, 300, 312, 342, 720])(
    'keeps initial choices readable, contained and hit-testable at %ipx canvas width',
    (canvasWidth) => {
      const layout = projectMatchResultLayout(longNameSnapshot(), canvasWidth);

      expect(layout.isCompact).toBe(canvasWidth < 560);
      expectLayoutStaticContentFits(layout);

      for (const choice of layout.choices) {
        expectDisplayedSelectableHeight(choice, layout.displayScale);
        expectDisplayedReadableLabel(choice, layout.displayScale);
        expect(
          choiceAtPoint(layout, {
            x: choice.rect.x + choice.rect.width / 2,
            y: choice.rect.y + choice.rect.height / 2,
          })?.value,
        ).toBe(choice.choice.value);
      }

      if (layout.isCompact) {
        expect(layout.stage.height).toBeGreaterThan(MATCH_RESULT_SCENE_HEIGHT);
        expect(layout.choices[0].labelBlock.lines.length).toBeGreaterThan(1);
        expect(layout.choices[1].labelBlock.lines.length).toBeGreaterThan(1);
      }
    },
  );

  it.each([
    ['Team 1 selected', 'team1'],
    ['Team 2 selected', 'team2'],
    ['Draw selected', 'draw'],
  ] as const)(
    'keeps %s compact selected and rejected arrangements contained',
    (_label, selected) => {
      for (const canvasWidth of [272, 282, 300, 312, 342]) {
        const layout = projectMatchResultLayout(
          longNameSnapshot({
            choicePresentation: 'selected',
            focusedValue: selected,
            selected,
          }),
          canvasWidth,
        );
        const selectedChoice = layout.selectedChoice;

        expect(layout.isCompact).toBe(true);
        expect(selectedChoice).not.toBeNull();
        expect(layout.rejectedGroup).not.toBeNull();
        expectLayoutStaticContentFits(layout);

        if (!selectedChoice || !layout.rejectedGroup) {
          continue;
        }

        expect(rectBottom(selectedChoice.rect)).toBeLessThan(
          layout.rejectedGroup.y,
        );
        expectRectInside(layout.rejectedGroup, layout.stage);

        for (const choice of layout.choices) {
          expectDisplayedReadableLabel(choice, layout.displayScale);
        }

        for (const choice of layout.choices.filter(
          (projectedChoice) => projectedChoice.hitTestable,
        )) {
          expect(
            choiceAtPoint(layout, {
              x: choice.rect.x + choice.rect.width / 2,
              y: choice.rect.y + choice.rect.height / 2,
            })?.value,
          ).toBe(choice.choice.value);
        }

        expect(
          choiceAtPoint(layout, {
            x: selectedChoice.rect.x + selectedChoice.rect.width / 2,
            y: selectedChoice.rect.y + selectedChoice.rect.height / 2,
          }),
        ).toBeNull();
      }
    },
  );

  it('reserves compact stage height for Draw with both long team names rejected', () => {
    const layout = projectMatchResultLayout(
      longNameSnapshot({
        choicePresentation: 'selected',
        selected: 'draw',
      }),
      272,
    );

    expect(layout.rejectedGroup).not.toBeNull();
    expect(layout.stage.height).toBeGreaterThan(MATCH_RESULT_SCENE_HEIGHT);
    expectLayoutStaticContentFits(layout);
  });

  it.each([272, 300, 342])(
    'keeps maximum-length valid team labels inside compact layout at %ipx',
    (canvasWidth) => {
      for (const selected of [null, 'team1', 'team2', 'draw'] as const) {
        const layout = projectMatchResultLayout(
          maximumNameSnapshot({
            choicePresentation: selected ? 'selected' : 'choices',
            selected,
          }),
          canvasWidth,
        );

        expectLayoutStaticContentFits(layout);

        for (const choice of layout.choices) {
          expectDisplayedReadableLabel(choice, layout.displayScale);
          expectDisplayedSelectableHeight(choice, layout.displayScale);
        }
      }
    },
  );

  it('maps restored choices at projected centers after a compact resize', () => {
    const restored = longNameSnapshot({ choicePresentation: 'choices' });
    const beforeResize = projectMatchResultLayout(restored, 342);
    const afterResize = projectMatchResultLayout(restored, 272);

    expectLayoutStaticContentFits(beforeResize);
    expectLayoutStaticContentFits(afterResize);

    for (const layout of [beforeResize, afterResize]) {
      for (const choice of layout.choices) {
        expect(
          choiceAtPoint(layout, {
            x: choice.rect.x + choice.rect.width / 2,
            y: choice.rect.y + choice.rect.height / 2,
          })?.value,
        ).toBe(choice.choice.value);
      }
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
