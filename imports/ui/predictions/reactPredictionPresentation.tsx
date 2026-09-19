import {
  type ChangeEvent,
  type AnimationEvent as ReactAnimationEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import type { FixtureDocument } from '/imports/shared/fixtures';
import {
  teamScoreComponentRugbyPoints,
  type TeamSide,
} from '/imports/shared/scoring';
import {
  deriveTeamScoreFromForm,
  parseFormWholeNumber,
  teamDisplayName,
  type PredictionFormState,
  type TeamPredictionForm,
} from './standardPredictionState';

type MatchResultChoiceValue = 'draw' | 'team1' | 'team2';

interface MatchResultChoice {
  readonly label: string;
  readonly value: MatchResultChoiceValue;
}

interface ShoveEffectState {
  readonly id: number;
  readonly rejectedChoices: readonly MatchResultChoice[];
  readonly selectedValue: MatchResultChoiceValue;
}

type MatchResultViewMode = 'choosing' | 'revealing' | 'settled';

const matchResultMotionDurationMs = 1_200;

const roosterShoveFrameUrls = [
  '/assets/rooster/match-result/frames/rooster-run-1.png',
  '/assets/rooster/match-result/frames/rooster-run-2.png',
  '/assets/rooster/match-result/frames/rooster-run-3.png',
  '/assets/rooster/match-result/frames/rooster-run-4.png',
  '/assets/rooster/match-result/frames/rooster-push-1.png',
  '/assets/rooster/match-result/frames/rooster-push-2.png',
  '/assets/rooster/match-result/frames/rooster-push-3.png',
  '/assets/rooster/match-result/frames/rooster-push-4.png',
] as const;

const matchResultChoicesForFixture = (
  fixture: FixtureDocument,
): readonly MatchResultChoice[] => [
  { label: teamDisplayName(fixture, 'team1'), value: 'team1' },
  { label: teamDisplayName(fixture, 'team2'), value: 'team2' },
  { label: 'Draw', value: 'draw' },
];

const isMatchResultChoiceValue = (
  value: string,
): value is MatchResultChoiceValue =>
  value === 'team1' || value === 'team2' || value === 'draw';

export const MatchResultPredictionStep = ({
  fixture,
  motionEnabled,
  onChange,
  value,
}: {
  readonly fixture: FixtureDocument;
  readonly motionEnabled: boolean;
  readonly onChange: (value: string) => void;
  readonly value: string;
}) => {
  const baseId = useId();
  const nextEffectIdRef = useRef(0);
  const focusChoicesAfterChangeRef = useRef(false);
  const choiceInputRefs = useRef<
    Partial<Record<MatchResultChoiceValue, HTMLInputElement | null>>
  >({});
  const choices = matchResultChoicesForFixture(fixture);
  const selectedChoice = isMatchResultChoiceValue(value)
    ? (choices.find((choice) => choice.value === value) ?? null)
    : null;
  const [shoveEffect, setShoveEffect] = useState<ShoveEffectState | null>(null);
  const [heroSettleMotion, setHeroSettleMotion] = useState(false);
  const [viewMode, setViewMode] = useState<MatchResultViewMode>(() =>
    isMatchResultChoiceValue(value) ? 'settled' : 'choosing',
  );
  const effectiveViewMode = selectedChoice ? viewMode : 'choosing';
  const cancelShoveEffect = useCallback(() => {
    setShoveEffect(null);
    setHeroSettleMotion(false);
  }, []);
  const settleShoveEffect = useCallback(
    ({ animateHero }: { readonly animateHero: boolean }) => {
      setShoveEffect(null);
      setHeroSettleMotion(animateHero);
      setViewMode((currentMode) =>
        currentMode === 'choosing' ? currentMode : 'settled',
      );
    },
    [],
  );

  useEffect(() => {
    if (
      !focusChoicesAfterChangeRef.current ||
      effectiveViewMode !== 'choosing'
    ) {
      return;
    }

    focusChoicesAfterChangeRef.current = false;
    const focusValue = isMatchResultChoiceValue(value) ? value : 'team1';
    choiceInputRefs.current[focusValue]?.focus();
  }, [effectiveViewMode, value]);

  useEffect(() => {
    if (!shoveEffect) {
      return undefined;
    }

    const obsoleteEffect =
      !motionEnabled || value !== shoveEffect.selectedValue;

    if (obsoleteEffect) {
      const timeout = window.setTimeout(
        () => settleShoveEffect({ animateHero: false }),
        0,
      );

      return () => {
        window.clearTimeout(timeout);
      };
    }

    const timeout = window.setTimeout(
      () => settleShoveEffect({ animateHero: true }),
      matchResultMotionDurationMs,
    );
    const cancelOnResize = () => settleShoveEffect({ animateHero: false });

    window.addEventListener('resize', cancelOnResize);
    window.addEventListener('orientationchange', cancelOnResize);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('resize', cancelOnResize);
      window.removeEventListener('orientationchange', cancelOnResize);
    };
  }, [motionEnabled, settleShoveEffect, shoveEffect, value]);

  const selectChoice = (nextValue: MatchResultChoiceValue) => {
    if (nextValue === value) {
      cancelShoveEffect();
      setViewMode('settled');
      return;
    }

    onChange(nextValue);
    setHeroSettleMotion(false);

    if (!motionEnabled) {
      cancelShoveEffect();
      setViewMode('settled');
      return;
    }

    const nextEffectId = nextEffectIdRef.current + 1;
    nextEffectIdRef.current = nextEffectId;
    setShoveEffect({
      id: nextEffectId,
      rejectedChoices: choices.filter((choice) => choice.value !== nextValue),
      selectedValue: nextValue,
    });
    setViewMode('revealing');
  };

  const changeSelection = () => {
    cancelShoveEffect();
    focusChoicesAfterChangeRef.current = true;
    setViewMode('choosing');
  };

  const isRevealing = effectiveViewMode === 'revealing';
  const isSettled = effectiveViewMode === 'settled';
  const activeShove =
    isRevealing &&
    motionEnabled &&
    shoveEffect &&
    value === shoveEffect.selectedValue;

  return (
    <fieldset data-testid="react-match-result-step">
      <legend className="sr-only">Who do you think will win?</legend>
      <div
        className={[
          'rr-match-result-stage',
          isRevealing ? 'rr-match-result-stage--revealing' : '',
          isSettled ? 'rr-match-result-stage--settled' : '',
        ].join(' ')}
        data-motion-phase={effectiveViewMode}
      >
        {effectiveViewMode === 'choosing' || isRevealing ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {choices.map((choice) => {
              const checked = choice.value === value;
              const rejectedDuringReveal = isRevealing && !checked;

              return (
                <label
                  aria-hidden={rejectedDuringReveal ? 'true' : undefined}
                  className={[
                    'rr-match-result-choice-card flex min-h-24 cursor-pointer items-center rounded-md border p-4 text-base font-black transition sm:min-h-28',
                    checked
                      ? 'border-rooster-red bg-rooster-red text-white shadow-sm'
                      : 'border-rooster-line bg-white text-rooster-ink hover:bg-rooster-paper',
                    isRevealing && checked
                      ? 'rr-match-result-choice-card--selected-rise'
                      : '',
                    rejectedDuringReveal
                      ? 'rr-match-result-choice-card--rejected-hidden'
                      : '',
                  ].join(' ')}
                  data-testid={`match-result-choice-${choice.value}`}
                  key={choice.value}
                >
                  <input
                    ref={(element) => {
                      choiceInputRefs.current[choice.value] = element;
                    }}
                    checked={checked}
                    className="focus-ring mr-3 h-5 w-5 shrink-0 accent-rooster-red"
                    disabled={rejectedDuringReveal}
                    id={`${baseId}-${choice.value}`}
                    name="match-result"
                    type="radio"
                    value={choice.value}
                    onChange={() => selectChoice(choice.value)}
                    onClick={() => {
                      if (checked) {
                        selectChoice(choice.value);
                      }
                    }}
                  />
                  <span className="min-w-0 break-words leading-6">
                    {choice.label}
                  </span>
                </label>
              );
            })}
          </div>
        ) : selectedChoice ? (
          <div
            className={[
              'rr-match-result-hero',
              heroSettleMotion && motionEnabled
                ? 'rr-match-result-hero--settle-motion'
                : '',
            ].join(' ')}
          >
            <p
              aria-hidden="true"
              className="rr-match-result-selected-label"
              data-testid="match-result-selected-label"
            >
              YOU SELECTED:
            </p>
            <label
              className="rr-match-result-choice-card rr-match-result-hero-card flex items-center rounded-md border border-rooster-red bg-rooster-red font-black text-white"
              data-testid={`match-result-choice-${selectedChoice.value}`}
            >
              <input
                checked
                className="focus-ring mr-3 h-6 w-6 shrink-0 accent-rooster-red sm:h-7 sm:w-7"
                id={`${baseId}-settled-${selectedChoice.value}`}
                name="match-result"
                readOnly
                type="radio"
                value={selectedChoice.value}
              />
              <span className="rr-match-result-hero-card-label min-w-0 break-words">
                {selectedChoice.label}
              </span>
            </label>
          </div>
        ) : null}

        {activeShove ? (
          <MatchResultShoveOverlay
            key={shoveEffect.id}
            rejectedChoices={shoveEffect.rejectedChoices}
            onAnimationComplete={() => settleShoveEffect({ animateHero: true })}
            onCancel={() => settleShoveEffect({ animateHero: false })}
          />
        ) : null}
      </div>

      {selectedChoice && (isRevealing || isSettled) ? (
        <div className="mt-3 flex justify-center sm:justify-end">
          <button
            className="focus-ring inline-flex min-h-10 w-full items-center justify-center rounded-md border border-rooster-line bg-white px-3 text-sm font-black text-rooster-ink transition hover:bg-rooster-paper sm:w-auto"
            type="button"
            onClick={changeSelection}
          >
            Change my selection
          </button>
        </div>
      ) : null}
    </fieldset>
  );
};

const MatchResultShoveOverlay = ({
  onAnimationComplete,
  onCancel,
  rejectedChoices,
}: {
  readonly onAnimationComplete: () => void;
  readonly onCancel: () => void;
  readonly rejectedChoices: readonly MatchResultChoice[];
}) => {
  const handleAnimationEnd = (event: ReactAnimationEvent<HTMLDivElement>) => {
    if (event.currentTarget === event.target) {
      onAnimationComplete();
    }
  };

  return (
    <div
      aria-hidden="true"
      className="rr-match-result-shove-layer"
      data-testid="match-result-shove-layer"
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="rr-match-result-shove-pack">
        {rejectedChoices.map((choice) => (
          <div
            className="rr-match-result-shove-card"
            data-testid={`match-result-shove-card-${choice.value}`}
            key={choice.value}
          >
            {choice.label}
          </div>
        ))}
      </div>
      <div className="rr-match-result-rooster-lane">
        <div
          className="rr-match-result-rooster"
          data-testid="match-result-rooster"
        >
          {roosterShoveFrameUrls.map((url, index) => (
            <img
              alt=""
              aria-hidden="true"
              className={`rr-match-result-rooster-frame rr-match-result-rooster-frame-${index}`}
              key={url}
              src={url}
              onError={onCancel}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export const TriesPredictionStep = ({
  conversionAdjustmentNotice,
  fixture,
  form,
  motionEnabled,
  onChange,
}: {
  readonly conversionAdjustmentNotice: string | null;
  readonly fixture: FixtureDocument;
  readonly form: PredictionFormState;
  readonly motionEnabled: boolean;
  readonly onChange: (side: TeamSide, value: string) => void;
}) => (
  <div className="grid gap-4" data-testid="react-tries-step">
    {conversionAdjustmentNotice ? (
      <p
        className="rounded-md border border-rooster-sun/50 bg-rooster-sun/10 p-3 text-sm font-semibold text-rooster-ink"
        role="status"
      >
        {conversionAdjustmentNotice}
      </p>
    ) : null}
    <div className="grid gap-4 md:grid-cols-2">
      {(['team1', 'team2'] as const).map((side) => (
        <TryTeamCard
          fixture={fixture}
          key={side}
          motionEnabled={motionEnabled}
          side={side}
          teamForm={form[side]}
          onChange={(value) => onChange(side, value)}
        />
      ))}
    </div>
  </div>
);

const normalizeWholeNumberDraft = (value: string): string | null => {
  if (value === '' || /^\d+$/.test(value)) {
    return value;
  }

  return null;
};

const TryTeamCard = ({
  fixture,
  motionEnabled,
  onChange,
  side,
  teamForm,
}: {
  readonly fixture: FixtureDocument;
  readonly motionEnabled: boolean;
  readonly onChange: (value: string) => void;
  readonly side: TeamSide;
  readonly teamForm: TeamPredictionForm;
}) => {
  const inputId = useId();
  const pulseTargetRef = useRef<HTMLDivElement | null>(null);
  const pulseAnimationRef = useRef<Animation | null>(null);
  const teamName = teamDisplayName(fixture, side);
  const score = deriveTeamScoreFromForm(teamForm, fixture, side);
  const parsed = parseFormWholeNumber(teamForm.tries);
  const canDecrement = parsed !== null && parsed > 0;

  useEffect(
    () => () => {
      pulseAnimationRef.current?.cancel();
    },
    [],
  );

  const playPulse = useCallback(() => {
    if (!motionEnabled) {
      return;
    }

    const target = pulseTargetRef.current;

    if (!target?.animate) {
      return;
    }

    try {
      pulseAnimationRef.current?.cancel();
      pulseAnimationRef.current = target.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.045)' },
          { transform: 'scale(1)' },
        ],
        {
          duration: 180,
          easing: 'cubic-bezier(0.2, 0, 0.2, 1)',
        },
      );
    } catch {
      pulseAnimationRef.current = null;
    }
  }, [motionEnabled]);

  const commit = (nextValue: string) => {
    onChange(nextValue);
    playPulse();
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = normalizeWholeNumberDraft(event.target.value);

    if (nextValue === null) {
      return;
    }

    commit(nextValue);
  };

  return (
    <section className="rounded-md border border-rooster-line bg-rooster-paper p-4">
      <p className="text-xs font-black uppercase text-rooster-muted">
        Predicted rugby score
      </p>
      <p className="mt-1 text-4xl font-black text-rooster-ink">
        {score.score === null ? '-' : score.score}
      </p>
      <h3 className="mt-1 break-words text-lg font-black text-rooster-ink">
        {teamName}
      </h3>
      {score.message ? (
        <p className="mt-2 text-xs font-semibold leading-5 text-rooster-muted">
          {score.message}
        </p>
      ) : null}

      <div className="mt-4" ref={pulseTargetRef}>
        <label
          className="block text-sm font-black text-rooster-ink"
          htmlFor={inputId}
        >
          Tries
        </label>
        <div className="mt-2 grid grid-cols-[3.25rem_minmax(0,1fr)_3.25rem] overflow-hidden rounded-md border border-rooster-line bg-white">
          <button
            aria-label={`Decrease ${teamName} tries`}
            className="focus-ring min-h-12 border-r border-rooster-line text-2xl font-black text-rooster-ink transition hover:bg-rooster-paper disabled:cursor-not-allowed disabled:text-rooster-muted"
            data-testid={`tries-${side}-decrement`}
            disabled={!canDecrement}
            type="button"
            onClick={() => commit(String(Math.max(0, (parsed ?? 0) - 1)))}
          >
            -
          </button>
          <input
            aria-label={`${teamName} tries`}
            className="focus-ring min-h-12 w-full border-0 bg-white px-3 text-center text-xl font-black text-rooster-ink"
            data-testid={`tries-${side}-input`}
            id={inputId}
            inputMode="numeric"
            min="0"
            onChange={handleInputChange}
            pattern="[0-9]*"
            step="1"
            type="number"
            value={teamForm.tries}
          />
          <button
            aria-label={`Increase ${teamName} tries`}
            className="focus-ring min-h-12 border-l border-rooster-line text-2xl font-black text-rooster-ink transition hover:bg-rooster-paper"
            data-testid={`tries-${side}-increment`}
            type="button"
            onClick={() => commit(String(parsed === null ? 0 : parsed + 1))}
          >
            +
          </button>
        </div>
        <p className="mt-2 text-xs font-semibold leading-5 text-rooster-muted">
          Points from tries: {teamScoreComponentRugbyPoints.tries} rugby points
          each
        </p>
      </div>
    </section>
  );
};
