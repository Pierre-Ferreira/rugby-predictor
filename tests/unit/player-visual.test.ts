// @vitest-environment jsdom

import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import {
  getRugbyRoosterPersonalityAsset,
  RugbyRoosterPersonality,
  StatusBadge,
  type RugbyRoosterMood,
} from '../../imports/ui/components/player';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: Array<{
  readonly container: HTMLDivElement;
  readonly root: Root;
}> = [];

afterEach(() => {
  while (mounted.length > 0) {
    const current = mounted.pop();

    if (current) {
      act(() => {
        current.root.unmount();
      });
      current.container.remove();
    }
  }
});

const mount = (element: ReactElement): HTMLDivElement => {
  const container = document.createElement('div');
  const root = createRoot(container);

  document.body.append(container);
  mounted.push({ container, root });

  act(() => {
    root.render(element);
  });

  return container;
};

describe('Rugby Rooster player visual primitives', () => {
  it.each([
    ['confident', '/assets/rooster/match-result/frames/rooster-run-1.png'],
    ['thinking', '/assets/rooster/match-result/frames/rooster-run-2.png'],
    ['waiting', '/assets/rooster/match-result/frames/rooster-run-4.png'],
    ['celebrating', '/assets/rooster/match-result/frames/rooster-push-4.png'],
    ['neutral', '/icons/rr-icon-192.png'],
  ] satisfies readonly [RugbyRoosterMood, string][])(
    'maps %s mood to an existing asset path',
    (mood, src) => {
      expect(getRugbyRoosterPersonalityAsset(mood)).toMatchObject({
        mood,
        src,
      });
    },
  );

  it('keeps personality copy when the mascot image fails to load', () => {
    const container = mount(
      createElement(RugbyRoosterPersonality, {
        assetSrcOverride: '/missing-rooster.png',
        message: 'Now we wait.',
        mood: 'waiting',
      }),
    );
    const image = container.querySelector('img');

    expect(image?.getAttribute('src')).toBe('/missing-rooster.png');

    act(() => {
      image?.dispatchEvent(new Event('error'));
    });

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('Now we wait.');
  });

  it('renders status badge text with the requested tone class', () => {
    const container = mount(
      createElement(StatusBadge, {
        label: 'Final',
        tone: 'success',
      }),
    );
    const badge = container.querySelector('.rr-status-badge');

    expect(badge?.textContent).toBe('Final');
    expect(badge?.classList.contains('rr-status-badge--success')).toBe(true);
  });
});
