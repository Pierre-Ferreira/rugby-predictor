import { useCallback, useState } from 'react';

export type AnimationPreference = 'off' | 'on';
export type AnimationPreferenceSource = 'default' | 'stored';

export const animationPreferenceStorageKey =
  'rugby-rooster:prediction-animations';

export const defaultAnimationPreference: AnimationPreference = 'on';

const isAnimationPreference = (value: unknown): value is AnimationPreference =>
  value === 'off' || value === 'on';

export interface BrowserStorageLike {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
}

export interface AnimationPreferenceReadResult {
  readonly preference: AnimationPreference;
  readonly source: AnimationPreferenceSource;
}

export const acquireAnimationPreferenceStorage =
  (): BrowserStorageLike | null => {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      return window.localStorage;
    } catch {
      return null;
    }
  };

export const readAnimationPreference = (
  storage: BrowserStorageLike | null | undefined,
): AnimationPreference => readAnimationPreferenceResult(storage).preference;

export const readAnimationPreferenceResult = (
  storage: BrowserStorageLike | null | undefined,
): AnimationPreferenceReadResult => {
  if (!storage) {
    return {
      preference: defaultAnimationPreference,
      source: 'default',
    };
  }

  try {
    const value = storage.getItem(animationPreferenceStorageKey);

    return isAnimationPreference(value)
      ? {
          preference: value,
          source: 'stored',
        }
      : {
          preference: defaultAnimationPreference,
          source: 'default',
        };
  } catch {
    return {
      preference: defaultAnimationPreference,
      source: 'default',
    };
  }
};

export const writeAnimationPreference = (
  preference: AnimationPreference,
  storage: BrowserStorageLike | null | undefined,
): void => {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(animationPreferenceStorageKey, preference);
  } catch {
    // Prediction answers never depend on browser preference persistence.
  }
};

export const useAnimationPreference = (
  storage?: BrowserStorageLike | null,
): readonly [
  AnimationPreference,
  (preference: AnimationPreference) => void,
] => {
  const resolvedStorage =
    storage === undefined ? acquireAnimationPreferenceStorage() : storage;
  const [preferenceState, setPreferenceState] = useState(() => ({
    preference: readAnimationPreference(resolvedStorage),
    storage: resolvedStorage,
  }));
  const preference =
    preferenceState.storage === resolvedStorage
      ? preferenceState.preference
      : readAnimationPreference(resolvedStorage);

  const setPreference = useCallback(
    (nextPreference: AnimationPreference) => {
      setPreferenceState({
        preference: nextPreference,
        storage: resolvedStorage,
      });
      writeAnimationPreference(nextPreference, resolvedStorage);
    },
    [resolvedStorage],
  );

  return [preference, setPreference] as const;
};
