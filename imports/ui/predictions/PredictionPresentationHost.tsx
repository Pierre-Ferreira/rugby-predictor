import { useCallback, type ReactNode } from 'react';

import {
  useAnimationPreference,
  type AnimationPreference,
} from './presentationPreference';
import { usePrefersReducedMotion } from './reducedMotion';

export interface PredictionPresentationOptions {
  readonly animationPreference: AnimationPreference;
  readonly animationsEnabled: boolean;
  readonly reducedMotion: boolean;
}

export interface PredictionPresentationHostProps {
  readonly renderExperience: (
    presentation: PredictionPresentationOptions,
  ) => ReactNode;
}

export const PredictionPresentationHost = ({
  renderExperience,
}: PredictionPresentationHostProps) => {
  const [preference, setPreference] = useAnimationPreference();
  const reducedMotion = usePrefersReducedMotion();
  const animationsEnabled = preference === 'on' && !reducedMotion;
  const selectPreference = useCallback(
    (nextPreference: AnimationPreference) => {
      setPreference(nextPreference);
    },
    [setPreference],
  );

  return (
    <div className="grid gap-5">
      <AnimationPreferenceControl
        preference={preference}
        reducedMotion={reducedMotion}
        onSelectPreference={selectPreference}
      />
      {renderExperience({
        animationPreference: preference,
        animationsEnabled,
        reducedMotion,
      })}
    </div>
  );
};

const AnimationPreferenceControl = ({
  onSelectPreference,
  preference,
  reducedMotion,
}: {
  readonly onSelectPreference: (preference: AnimationPreference) => void;
  readonly preference: AnimationPreference;
  readonly reducedMotion: boolean;
}) => (
  <section className="rounded-md border border-rooster-line bg-white p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-black text-rooster-ink">Animations</p>
      <div
        aria-label="Animations"
        className="grid grid-cols-2 overflow-hidden rounded-md border border-rooster-line"
        role="group"
      >
        <button
          aria-pressed={preference === 'off'}
          className={[
            'focus-ring min-h-11 px-4 text-sm font-black transition',
            preference === 'off'
              ? 'bg-rooster-ink text-white'
              : 'bg-white text-rooster-ink hover:bg-rooster-paper',
          ].join(' ')}
          type="button"
          onClick={() => onSelectPreference('off')}
        >
          Off
        </button>
        <button
          aria-pressed={preference === 'on'}
          className={[
            'focus-ring min-h-11 border-l border-rooster-line px-4 text-sm font-black transition',
            preference === 'on'
              ? 'bg-rooster-red text-white'
              : 'bg-white text-rooster-ink hover:bg-rooster-paper',
          ].join(' ')}
          type="button"
          onClick={() => onSelectPreference('on')}
        >
          On
        </button>
      </div>
    </div>

    {reducedMotion && preference === 'on' ? (
      <p
        className="mt-3 rounded-md border border-rooster-sun/50 bg-rooster-sun/10 p-3 text-sm font-bold text-rooster-ink"
        role="status"
      >
        Reduced motion is active.
      </p>
    ) : null}
  </section>
);
