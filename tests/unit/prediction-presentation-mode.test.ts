import { describe, expect, it, vi } from 'vitest';

import {
  readAnimationPreference,
  readAnimationPreferenceResult,
  writeAnimationPreference,
  type BrowserStorageLike,
} from '../../imports/ui/predictions/presentationPreference';
import { prefersReducedMotion } from '../../imports/ui/predictions/reducedMotion';

describe('animation preference storage', () => {
  it('defaults malformed, missing and inaccessible values to On', () => {
    expect(readAnimationPreference(undefined)).toBe('on');
    expect(readAnimationPreferenceResult(undefined)).toEqual({
      preference: 'on',
      source: 'default',
    });
    expect(
      readAnimationPreference({
        getItem: () => 'banana',
        setItem: () => undefined,
      }),
    ).toBe('on');
    expect(
      readAnimationPreference({
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => undefined,
      }),
    ).toBe('on');
  });

  it('reads explicit On/Off values and swallows write failures', () => {
    const writes: string[] = [];
    const storage: BrowserStorageLike = {
      getItem: () => 'on',
      setItem: (_key, value) => {
        writes.push(value);
      },
    };

    expect(readAnimationPreference(storage)).toBe('on');
    expect(
      readAnimationPreference({
        getItem: () => 'off',
        setItem: () => undefined,
      }),
    ).toBe('off');
    expect(readAnimationPreferenceResult(storage)).toEqual({
      preference: 'on',
      source: 'stored',
    });
    writeAnimationPreference('off', storage);
    expect(writes).toEqual(['off']);
    expect(() =>
      writeAnimationPreference('on', {
        getItem: () => null,
        setItem: () => {
          throw new Error('blocked');
        },
      }),
    ).not.toThrow();
  });
});

describe('reduced motion preference helper', () => {
  it('treats missing or throwing matchMedia as no reduced-motion request', () => {
    expect(prefersReducedMotion(undefined)).toBe(false);
    expect(
      prefersReducedMotion(() => {
        throw new Error('blocked');
      }),
    ).toBe(false);
  });

  it('reads the browser reduced-motion media query', () => {
    const matchMedia = vi.fn(() => ({ matches: true }) as MediaQueryList);

    expect(prefersReducedMotion(matchMedia)).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });
});
