// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import {
  getRugbyRoosterPersonalityAsset,
  RugbyRoosterPersonality,
  rugbyRoosterPersonalityAssets,
  StatusBadge,
  type RugbyRoosterMood,
} from '../../imports/ui/components/player';

const projectRoot = resolve(__dirname, '../..');

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
    ['confident', '/assets/rooster/personality/rooster-confident.png'],
    ['thinking', '/assets/rooster/personality/rooster-thinking.png'],
    ['celebrating', '/assets/rooster/personality/rooster-celebrating.png'],
    ['nervous', '/assets/rooster/personality/rooster-nervous.png'],
    ['shocked', '/assets/rooster/personality/rooster-shocked.png'],
    ['disappointed', '/assets/rooster/personality/rooster-disappointed.png'],
    ['tantrum', '/assets/rooster/personality/rooster-tantrum.png'],
    ['crying', '/assets/rooster/personality/rooster-crying.png'],
    ['cooked', '/assets/rooster/personality/rooster-cooked.png'],
    ['superCooked', '/assets/rooster/personality/rooster-super-cooked.png'],
    ['running', '/assets/rooster/match-result/frames/rooster-run-1.png'],
  ] satisfies readonly [RugbyRoosterMood, string][])(
    'maps %s mood to the approved runtime asset path',
    (mood, src) => {
      expect(getRugbyRoosterPersonalityAsset(mood)).toMatchObject({
        mood,
        src,
      });
    },
  );

  it('keeps non-running moods off the generic running frames', () => {
    for (const asset of Object.values(rugbyRoosterPersonalityAssets)) {
      if (asset.mood === 'running') {
        expect(asset.src).toContain('/match-result/frames/rooster-run-1.png');
        continue;
      }

      expect(asset.src).toContain('/assets/rooster/personality/');
      expect(asset.src).not.toContain('/match-result/frames/');
      expect(asset.width).toBeGreaterThan(0);
      expect(asset.height).toBeGreaterThan(0);
    }
  });

  it('keeps personality copy and reserved layout when the mascot image fails to load', () => {
    const container = mount(
      createElement(RugbyRoosterPersonality, {
        assetSrcOverride: '/missing-rooster.png',
        message: 'Hmm...',
        mood: 'thinking',
      }),
    );
    const image = container.querySelector('img');

    expect(image?.getAttribute('src')).toBe('/missing-rooster.png');

    act(() => {
      image?.dispatchEvent(new Event('error'));
    });

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('Hmm...');
    expect(
      container
        .querySelector('.rr-personality')
        ?.classList.contains('rr-personality--image-failed'),
    ).toBe(true);
  });

  it.each([
    ['compact', 'rr-personality--compact'],
    ['standard', 'rr-personality--standard'],
    ['hero', 'rr-personality--hero'],
  ] as const)('renders the %s size class', (size, className) => {
    const container = mount(
      createElement(RugbyRoosterPersonality, {
        mood: 'confident',
        size,
      }),
    );

    expect(container.querySelector('.rr-personality')?.classList).toContain(
      className,
    );
  });

  it('keeps approved semantic colour tokens available', () => {
    const css = readFileSync(resolve(projectRoot, 'client/main.css'), 'utf8');
    const tailwind = readFileSync(
      resolve(projectRoot, 'tailwind.config.cjs'),
      'utf8',
    );

    for (const token of [
      '--rr-field-green',
      '--rr-gold',
      '--rr-rooster-red',
      '--rr-cobalt-blue',
      '--rr-cream',
      '--rr-tan-feather',
      '--rr-charcoal',
    ]) {
      expect(css).toContain(token);
    }

    for (const alias of [
      'fieldGreen',
      'gold',
      'roosterRed',
      'cobaltBlue',
      'cream',
      'tanFeather',
      'charcoal',
    ]) {
      expect(tailwind).toContain(alias);
    }
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
