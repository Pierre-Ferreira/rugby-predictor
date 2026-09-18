import { describe, expect, it } from 'vitest';

import {
  advanceShoveEffect,
  createShoveEffect,
  MATCH_RESULT_SCENE_WIDTH,
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
  pickedLabel: selected ? 'Springboks' : null,
  selectionEffectId,
});

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

  it('progresses entry to contact to push to offscreen exit', () => {
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
    expect(
      (exit?.roosterRect.x ?? 0) + (exit?.roosterRect.width ?? 0),
    ).toBeGreaterThan(MATCH_RESULT_SCENE_WIDTH);
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
