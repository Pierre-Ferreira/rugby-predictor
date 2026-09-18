import { useEffect, useState } from 'react';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

export const prefersReducedMotion = (
  matchMedia: Window['matchMedia'] | undefined,
): boolean => {
  if (!matchMedia) {
    return false;
  }

  try {
    return matchMedia(reducedMotionQuery).matches;
  } catch {
    return false;
  }
};

export const usePrefersReducedMotion = (
  matchMedia: Window['matchMedia'] | undefined = window.matchMedia,
): boolean => {
  const [reducedMotionState, setReducedMotionState] = useState(() => ({
    isReducedMotion: prefersReducedMotion(matchMedia),
    matchMedia,
  }));
  const isReducedMotion =
    reducedMotionState.matchMedia === matchMedia
      ? reducedMotionState.isReducedMotion
      : prefersReducedMotion(matchMedia);

  useEffect(() => {
    if (!matchMedia) {
      return undefined;
    }

    let mediaQuery: MediaQueryList;

    try {
      mediaQuery = matchMedia(reducedMotionQuery);
    } catch {
      return undefined;
    }

    const updatePreference = (event: MediaQueryListEvent) => {
      setReducedMotionState({
        isReducedMotion: event.matches,
        matchMedia,
      });
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updatePreference);

      return () => {
        mediaQuery.removeEventListener('change', updatePreference);
      };
    }

    mediaQuery.addListener(updatePreference);

    return () => {
      mediaQuery.removeListener(updatePreference);
    };
  }, [matchMedia]);

  return isReducedMotion;
};
