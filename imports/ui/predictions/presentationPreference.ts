import { useCallback, useState } from 'react';

export type AnimationPreference = 'off' | 'on';

export const animationPreferenceStorageKey =
  'rugby-rooster:prediction-animations';

const isAnimationPreference = (value: unknown): value is AnimationPreference =>
  value === 'off' || value === 'on';

export interface BrowserStorageLike {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
}

export const readAnimationPreference = (
  storage: BrowserStorageLike | null | undefined,
): AnimationPreference => {
  if (!storage) {
    return 'off';
  }

  try {
    const value = storage.getItem(animationPreferenceStorageKey);

    return isAnimationPreference(value) ? value : 'off';
  } catch {
    return 'off';
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
  storage: BrowserStorageLike | null | undefined = window.localStorage,
): readonly [
  AnimationPreference,
  (preference: AnimationPreference) => void,
] => {
  const [preferenceState, setPreferenceState] = useState(() => ({
    preference: readAnimationPreference(storage),
    storage,
  }));
  const preference =
    preferenceState.storage === storage
      ? preferenceState.preference
      : readAnimationPreference(storage);

  const setPreference = useCallback(
    (nextPreference: AnimationPreference) => {
      setPreferenceState({
        preference: nextPreference,
        storage,
      });
      writeAnimationPreference(nextPreference, storage);
    },
    [storage],
  );

  return [preference, setPreference] as const;
};
