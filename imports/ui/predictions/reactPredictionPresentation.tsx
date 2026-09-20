import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type ReactNode,
  type AnimationEvent as ReactAnimationEvent,
} from 'react';

import {
  deriveTeamScoreFromForm,
  maxAttributeForWholeNumber,
  parseFormWholeNumber,
  teamDisplayName,
  type PredictionFormState,
  type TeamPredictionForm,
} from './standardPredictionState';
import type { FixtureDocument } from '/imports/shared/fixtures';
import {
  teamScoreComponentRugbyPoints,
  type FirstTryAnswer,
  type TeamSide,
} from '/imports/shared/scoring';

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

interface MatchResultRevealGeometry {
  readonly laneHeightPx: number;
  readonly laneTopPx: number;
  readonly packExitLeftPx: number;
  readonly packLeftPx: number;
  readonly packWidthPx: number;
  readonly revealMinHeightPx: number;
  readonly roosterContactLeftPx: number;
  readonly roosterEntryLeftPx: number;
  readonly roosterExitLeftPx: number;
  readonly roosterSizePx: number;
  readonly roosterUnderpassLeftPx: number;
  readonly selectedLiftPx: number;
  readonly selectedShiftXPx: number;
  readonly stageLiftSpacePx: number;
}

type MatchResultViewMode = 'choosing' | 'revealing' | 'settled';

const matchResultMotionDurationMs = 1_400;
const matchResultMinimumClearancePx = 16;
const roosterSpriteAspectRatio = 268 / 276;

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

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const cssPixel = (value: number): string => `${Math.round(value)}px`;

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
  const stageRef = useRef<HTMLDivElement | null>(null);
  const choiceInputRefs = useRef<
    Partial<Record<MatchResultChoiceValue, HTMLInputElement | null>>
  >({});
  const choiceCardRefs = useRef<
    Partial<Record<MatchResultChoiceValue, HTMLLabelElement | null>>
  >({});
  const choices = matchResultChoicesForFixture(fixture);
  const selectedChoice = isMatchResultChoiceValue(value)
    ? (choices.find((choice) => choice.value === value) ?? null)
    : null;
  const [shoveEffect, setShoveEffect] = useState<ShoveEffectState | null>(null);
  const [revealGeometry, setRevealGeometry] =
    useState<MatchResultRevealGeometry | null>(null);
  const [heroSettleMotion, setHeroSettleMotion] = useState(false);
  const [viewMode, setViewMode] = useState<MatchResultViewMode>(() =>
    isMatchResultChoiceValue(value) ? 'settled' : 'choosing',
  );
  const effectiveViewMode = selectedChoice ? viewMode : 'choosing';
  const cancelShoveEffect = useCallback(() => {
    setShoveEffect(null);
    setRevealGeometry(null);
    setHeroSettleMotion(false);
  }, []);
  const settleShoveEffect = useCallback(
    ({ animateHero }: { readonly animateHero: boolean }) => {
      setShoveEffect(null);
      setRevealGeometry(null);
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

  const measureRevealGeometry = useCallback(
    (selectedValue: MatchResultChoiceValue): MatchResultRevealGeometry => {
      const stage = stageRef.current;
      const selectedCard = choiceCardRefs.current[selectedValue];

      if (!stage || !selectedCard) {
        return {
          laneHeightPx: 160,
          laneTopPx: 152,
          packExitLeftPx: 760,
          packLeftPx: 400,
          packWidthPx: 360,
          revealMinHeightPx: 328,
          roosterContactLeftPx: 340,
          roosterEntryLeftPx: -160,
          roosterExitLeftPx: 900,
          roosterSizePx: 140,
          roosterUnderpassLeftPx: 56,
          selectedLiftPx: 120,
          selectedShiftXPx: 0,
          stageLiftSpacePx: 48,
        };
      }

      const stageRect = stage.getBoundingClientRect();
      const selectedRect = selectedCard.getBoundingClientRect();
      const stageWidth = Math.max(stageRect.width, 320);
      const selectedTopWithinStage = selectedRect.top - stageRect.top;
      const selectedLeftWithinStage = selectedRect.left - stageRect.left;
      const selectedHeight = selectedRect.height;
      const selectedWidth = selectedRect.width;
      const isCompact = stageWidth <= 520 || window.innerWidth <= 520;
      const roosterSize = isCompact
        ? clamp(window.innerWidth * 0.24, 92, 116)
        : clamp(window.innerWidth * 0.16, 108, 140);
      const roosterHeight = roosterSize * roosterSpriteAspectRatio;
      const upperTierTopWithinStage = isCompact ? 6 : 8;
      const stageLiftSpace = clamp(selectedHeight * 0.34, 32, 48);
      const selectedLift =
        stageLiftSpace + selectedTopWithinStage - upperTierTopWithinStage;
      const selectedTargetLeft = isCompact
        ? 6
        : clamp(stageWidth * 0.055, 8, 44);
      const selectedShiftX = selectedTargetLeft - selectedLeftWithinStage;
      const rejectedCardHeight = isCompact
        ? Math.max(64, selectedHeight * 0.62)
        : Math.max(76, selectedHeight * 0.68);
      const rejectedPackHeight = rejectedCardHeight * 2 + 8;
      const laneHeight =
        Math.max(roosterHeight, rejectedPackHeight) +
        matchResultMinimumClearancePx;
      const selectedFinalBottom =
        upperTierTopWithinStage + selectedHeight - stageLiftSpace;
      const laneTop = Math.max(
        selectedHeight + 52,
        selectedFinalBottom + matchResultMinimumClearancePx + 72,
      );
      const packWidth = isCompact
        ? clamp(stageWidth * 0.54, 172, stageWidth - 24)
        : clamp(stageWidth * 0.42, 300, 448);
      const packLeft = isCompact
        ? clamp(stageWidth * 0.48, 126, stageWidth - packWidth + 8)
        : clamp(stageWidth * 0.52, 320, stageWidth - packWidth + 20);
      const roosterUnderpassLeft =
        selectedTargetLeft + Math.min(selectedWidth * 0.24, 48);
      const roosterContactLeft = Math.max(
        roosterUnderpassLeft + 24,
        packLeft - roosterSize * 0.42,
      );
      const roosterEntryLeft = -roosterSize - 24;
      const roosterExitLeft = stageWidth + roosterSize + 24;
      const packExitLeft = stageWidth + packWidth + 32;
      const revealMinHeight = stageLiftSpace + laneTop + laneHeight + 20;

      return {
        laneHeightPx: Math.ceil(laneHeight),
        laneTopPx: Math.ceil(laneTop),
        packExitLeftPx: Math.ceil(packExitLeft),
        packLeftPx: Math.ceil(packLeft),
        packWidthPx: Math.ceil(packWidth),
        revealMinHeightPx: Math.ceil(revealMinHeight),
        roosterContactLeftPx: Math.ceil(roosterContactLeft),
        roosterEntryLeftPx: Math.floor(roosterEntryLeft),
        roosterExitLeftPx: Math.ceil(roosterExitLeft),
        roosterSizePx: Math.ceil(roosterSize),
        roosterUnderpassLeftPx: Math.ceil(roosterUnderpassLeft),
        selectedLiftPx: Math.ceil(selectedLift),
        selectedShiftXPx: Math.round(selectedShiftX),
        stageLiftSpacePx: Math.ceil(stageLiftSpace),
      };
    },
    [],
  );

  const selectChoice = (nextValue: MatchResultChoiceValue) => {
    if (nextValue === value) {
      cancelShoveEffect();
      setViewMode('settled');
      return;
    }

    const nextRevealGeometry = measureRevealGeometry(nextValue);

    onChange(nextValue);
    setHeroSettleMotion(false);
    setRevealGeometry(nextRevealGeometry);

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
  const revealStyle =
    isRevealing && revealGeometry
      ? ({
          '--rr-match-result-lane-height': cssPixel(
            revealGeometry.laneHeightPx,
          ),
          '--rr-match-result-lane-top': cssPixel(revealGeometry.laneTopPx),
          '--rr-match-result-pack-exit-left': cssPixel(
            revealGeometry.packExitLeftPx,
          ),
          '--rr-match-result-pack-left': cssPixel(revealGeometry.packLeftPx),
          '--rr-match-result-pack-width': cssPixel(revealGeometry.packWidthPx),
          '--rr-match-result-reveal-min-height': cssPixel(
            revealGeometry.revealMinHeightPx,
          ),
          '--rr-match-result-rooster-contact-left': cssPixel(
            revealGeometry.roosterContactLeftPx,
          ),
          '--rr-match-result-rooster-entry-left': cssPixel(
            revealGeometry.roosterEntryLeftPx,
          ),
          '--rr-match-result-rooster-exit-left': cssPixel(
            revealGeometry.roosterExitLeftPx,
          ),
          '--rr-match-result-rooster-size': cssPixel(
            revealGeometry.roosterSizePx,
          ),
          '--rr-match-result-rooster-underpass-left': cssPixel(
            revealGeometry.roosterUnderpassLeftPx,
          ),
          '--rr-match-result-selected-lift': cssPixel(
            revealGeometry.selectedLiftPx,
          ),
          '--rr-match-result-selected-shift-x': cssPixel(
            revealGeometry.selectedShiftXPx,
          ),
          '--rr-match-result-stage-lift-space': cssPixel(
            revealGeometry.stageLiftSpacePx,
          ),
        } as CSSProperties)
      : undefined;

  return (
    <fieldset data-testid="react-match-result-step">
      <legend className="sr-only">Who do you think will win?</legend>
      <div
        ref={stageRef}
        className={[
          'rr-match-result-stage',
          isRevealing ? 'rr-match-result-stage--revealing' : '',
          isSettled ? 'rr-match-result-stage--settled' : '',
        ].join(' ')}
        data-motion-phase={effectiveViewMode}
        style={revealStyle}
      >
        {effectiveViewMode === 'choosing' || isRevealing ? (
          <div className="rr-match-result-choice-grid grid gap-3 sm:grid-cols-3">
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
                  ref={(element) => {
                    choiceCardRefs.current[choice.value] = element;
                  }}
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
      <div
        className="rr-match-result-rooster-lane"
        data-testid="match-result-rooster-lane"
      >
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
  deductionText = null,
  fixture,
  form,
  motionEnabled,
  onChange,
  supportingText = [],
}: {
  readonly conversionAdjustmentNotice: string | null;
  readonly deductionText?: string | null;
  readonly fixture: FixtureDocument;
  readonly form: PredictionFormState;
  readonly motionEnabled: boolean;
  readonly onChange: (side: TeamSide, value: string) => void;
  readonly supportingText?: readonly string[];
}) => (
  <PredictionTeamNumericStep
    conversionAdjustmentNotice={conversionAdjustmentNotice}
    deductionText={deductionText}
    field="tries"
    fixture={fixture}
    form={form}
    motionEnabled={motionEnabled}
    supportingText={supportingText}
    onChange={onChange}
  />
);

export const ConversionsPredictionStep = ({
  conversionAdjustmentNotice,
  deductionText = null,
  fixture,
  form,
  motionEnabled,
  onChange,
  supportingText = [],
}: TeamNumericPredictionStepComponentProps) => (
  <PredictionTeamNumericStep
    conversionAdjustmentNotice={conversionAdjustmentNotice}
    deductionText={deductionText}
    field="conversions"
    fixture={fixture}
    form={form}
    motionEnabled={motionEnabled}
    supportingText={supportingText}
    onChange={onChange}
  />
);

export const PenaltyKicksPredictionStep = ({
  conversionAdjustmentNotice,
  deductionText = null,
  fixture,
  form,
  motionEnabled,
  onChange,
  supportingText = [],
}: TeamNumericPredictionStepComponentProps) => (
  <PredictionTeamNumericStep
    conversionAdjustmentNotice={conversionAdjustmentNotice}
    deductionText={deductionText}
    field="penaltyKicks"
    fixture={fixture}
    form={form}
    motionEnabled={motionEnabled}
    supportingText={supportingText}
    onChange={onChange}
  />
);

export const DropGoalsPredictionStep = ({
  conversionAdjustmentNotice,
  deductionText = null,
  fixture,
  form,
  motionEnabled,
  onChange,
  supportingText = [],
}: TeamNumericPredictionStepComponentProps) => (
  <PredictionTeamNumericStep
    conversionAdjustmentNotice={conversionAdjustmentNotice}
    deductionText={deductionText}
    field="dropGoals"
    fixture={fixture}
    form={form}
    motionEnabled={motionEnabled}
    supportingText={supportingText}
    onChange={onChange}
  />
);

const normalizeWholeNumberDraft = (value: string): string | null => {
  if (value === '' || /^\d+$/.test(value)) {
    return value;
  }

  return null;
};

type TeamScoringNumericField =
  'conversions' | 'dropGoals' | 'penaltyKicks' | 'tries';

type NumericReactionDirection = 'decrease' | 'increase' | 'limit';
type NumericReactionKind = 'change' | 'limit';

interface NumericReactionState {
  readonly direction: NumericReactionDirection;
  readonly field: TeamScoringNumericField;
  readonly id: number;
  readonly kind: NumericReactionKind;
  readonly message: string;
  readonly scoreChanged: boolean;
}

interface NumericReactionTargets {
  readonly activeReaction: NumericReactionState | null;
  readonly setCardElement: (element: HTMLElement | null) => void;
  readonly setHelperElement: (element: HTMLElement | null) => void;
  readonly setScoreElement: (element: HTMLElement | null) => void;
  readonly setValueElement: (element: HTMLElement | null) => void;
  readonly triggerLimitReaction: () => void;
}

interface TeamNumericPredictionStepComponentProps {
  readonly conversionAdjustmentNotice?: string | null;
  readonly deductionText?: string | null;
  readonly fixture: FixtureDocument;
  readonly form: PredictionFormState;
  readonly motionEnabled: boolean;
  readonly onChange: (side: TeamSide, value: string) => void;
  readonly supportingText?: readonly string[];
}

interface TeamNumericFieldCopy {
  readonly controlLabel: string;
  readonly inputLabelNoun: string;
  readonly pointsText: string;
  readonly testIdPrefix: string;
}

const numericFieldCopy = {
  conversions: {
    controlLabel: 'Conversions',
    inputLabelNoun: 'conversions',
    pointsText: `${teamScoreComponentRugbyPoints.conversions} rugby points each`,
    testIdPrefix: 'conversions',
  },
  dropGoals: {
    controlLabel: 'Drop goals',
    inputLabelNoun: 'drop goals',
    pointsText: `${teamScoreComponentRugbyPoints.dropGoals} rugby points each`,
    testIdPrefix: 'drop-goals',
  },
  penaltyKicks: {
    controlLabel: 'Penalty kicks',
    inputLabelNoun: 'penalty kicks',
    pointsText: `${teamScoreComponentRugbyPoints.penaltyKicks} rugby points each`,
    testIdPrefix: 'penalty-kicks',
  },
  tries: {
    controlLabel: 'Tries',
    inputLabelNoun: 'tries',
    pointsText: `Points from tries: ${teamScoreComponentRugbyPoints.tries} rugby points each`,
    testIdPrefix: 'tries',
  },
} as const satisfies Record<TeamScoringNumericField, TeamNumericFieldCopy>;

const numericReactionDurationMs = 420;
const numericLimitReactionDurationMs = 300;

const ambitiousTryMessage = (value: number): string => {
  if (value >= 5) {
    return value % 2 === 0 ? 'Going big!' : 'Try-fest?';
  }

  if (value >= 3) {
    return 'Try time!';
  }

  return 'On the board.';
};

const numericReactionMessage = (
  field: TeamScoringNumericField,
  direction: NumericReactionDirection,
  nextValue: number | null,
): string => {
  if (direction === 'limit') {
    return 'At the try cap.';
  }

  if (field === 'tries') {
    return direction === 'decrease'
      ? 'Try tally trimmed.'
      : ambitiousTryMessage(nextValue ?? 0);
  }

  if (field === 'conversions') {
    return direction === 'decrease'
      ? 'Conversion pulled back.'
      : 'Kick is good.';
  }

  if (field === 'penaltyKicks') {
    return direction === 'decrease' ? 'Taking three off.' : 'Posts in range.';
  }

  return direction === 'decrease'
    ? 'Drop-goal count eased.'
    : nextValue && nextValue > 1
      ? 'Old school!'
      : 'A drop goal?';
};

const playElementAnimation = (
  element: HTMLElement | null,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): Animation | null => {
  if (!element?.animate) {
    return null;
  }

  try {
    return element.animate(keyframes, options);
  } catch {
    return null;
  }
};

const numericValueScale = (
  field: TeamScoringNumericField,
  direction: NumericReactionDirection,
): number => {
  if (direction === 'decrease') {
    return 0.94;
  }

  if (field === 'tries') {
    return 1.22;
  }

  if (field === 'dropGoals') {
    return 1.2;
  }

  return 1.16;
};

const useNumericChangeReaction = ({
  field,
  motionEnabled,
  score,
  value,
}: {
  readonly field: TeamScoringNumericField;
  readonly motionEnabled: boolean;
  readonly score: number | null;
  readonly value: string;
}): NumericReactionTargets => {
  const animationRefs = useRef<Animation[]>([]);
  const cardElementRef = useRef<HTMLElement | null>(null);
  const helperElementRef = useRef<HTMLElement | null>(null);
  const nextReactionIdRef = useRef(0);
  const previousAcceptedRef = useRef<{
    readonly initialized: boolean;
    readonly score: number | null;
    readonly value: number | null;
  }>({
    initialized: false,
    score: null,
    value: null,
  });
  const scoreElementRef = useRef<HTMLElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const valueElementRef = useRef<HTMLElement | null>(null);
  const [reaction, setReaction] = useState<NumericReactionState | null>(null);

  const cancelAnimations = useCallback(() => {
    for (const animation of animationRefs.current) {
      animation.cancel();
    }

    animationRefs.current = [];
  }, []);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const playReaction = useCallback(
    (nextReaction: NumericReactionState) => {
      cancelAnimations();

      if (!motionEnabled) {
        return;
      }

      const animations: Animation[] = [];
      const isLimit = nextReaction.kind === 'limit';
      const direction = nextReaction.direction;
      const valueScale = numericValueScale(field, direction);
      const valueTranslate =
        direction === 'decrease'
          ? 'translateY(0.28rem)'
          : 'translateY(-0.5rem)';
      const cardTranslate =
        direction === 'decrease' ? 'translateY(0.2rem)' : 'translateY(-0.3rem)';
      const cardAnimation = isLimit
        ? playElementAnimation(
            cardElementRef.current,
            [
              { transform: 'translateX(0)' },
              { transform: 'translateX(-0.45rem)' },
              { transform: 'translateX(0.45rem)' },
              { transform: 'translateX(-0.25rem)' },
              { transform: 'translateX(0)' },
            ],
            {
              duration: numericLimitReactionDurationMs,
              easing: 'cubic-bezier(0.2, 0, 0.2, 1)',
            },
          )
        : playElementAnimation(
            cardElementRef.current,
            [
              { transform: 'translateY(0) scale(1)' },
              { transform: `${cardTranslate} scale(1.035)` },
              { transform: 'translateY(0) scale(1)' },
            ],
            {
              duration: numericReactionDurationMs,
              easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)',
            },
          );

      if (cardAnimation) {
        animations.push(cardAnimation);
      }

      if (!isLimit) {
        const valueAnimation = playElementAnimation(
          valueElementRef.current,
          [
            { transform: 'translateY(0) scale(1)' },
            { transform: `${valueTranslate} scale(${valueScale})` },
            { transform: 'translateY(0) scale(1)' },
          ],
          {
            duration: numericReactionDurationMs,
            easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)',
          },
        );

        if (valueAnimation) {
          animations.push(valueAnimation);
        }
      }

      if (isLimit) {
        const helperAnimation = playElementAnimation(
          helperElementRef.current,
          [
            { transform: 'scale(1)' },
            { transform: 'scale(1.035)' },
            { transform: 'scale(1)' },
          ],
          {
            duration: numericLimitReactionDurationMs,
            easing: 'cubic-bezier(0.2, 0, 0.2, 1)',
          },
        );

        if (helperAnimation) {
          animations.push(helperAnimation);
        }
      }

      if (nextReaction.scoreChanged) {
        const scoreAnimation = playElementAnimation(
          scoreElementRef.current,
          [
            { transform: 'translateY(0) scale(1)' },
            { transform: 'translateY(-0.42rem) scale(1.24)' },
            { transform: 'translateY(0) scale(1)' },
          ],
          {
            duration: numericReactionDurationMs,
            easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)',
          },
        );

        if (scoreAnimation) {
          animations.push(scoreAnimation);
        }
      }

      animationRefs.current = animations;
    },
    [cancelAnimations, field, motionEnabled],
  );

  const startReaction = useCallback(
    ({
      direction,
      kind,
      nextValue,
      scoreChanged,
    }: {
      readonly direction: NumericReactionDirection;
      readonly kind: NumericReactionKind;
      readonly nextValue: number | null;
      readonly scoreChanged: boolean;
    }) => {
      if (!motionEnabled) {
        return;
      }

      clearTimer();

      const nextReaction = {
        direction,
        field,
        id: nextReactionIdRef.current + 1,
        kind,
        message: numericReactionMessage(field, direction, nextValue),
        scoreChanged,
      } satisfies NumericReactionState;

      nextReactionIdRef.current = nextReaction.id;
      setReaction(nextReaction);
      playReaction(nextReaction);
      timeoutRef.current = window.setTimeout(
        () => {
          timeoutRef.current = null;
          setReaction((current) =>
            current?.id === nextReaction.id ? null : current,
          );
        },
        kind === 'limit'
          ? numericLimitReactionDurationMs
          : numericReactionDurationMs,
      );
    },
    [clearTimer, field, motionEnabled, playReaction],
  );

  useEffect(() => {
    if (motionEnabled) {
      return undefined;
    }

    clearTimer();
    cancelAnimations();

    const timeout = window.setTimeout(() => {
      setReaction(null);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [cancelAnimations, clearTimer, motionEnabled]);

  useEffect(
    () => () => {
      clearTimer();
      cancelAnimations();
    },
    [cancelAnimations, clearTimer],
  );

  useEffect(() => {
    const parsedValue = parseFormWholeNumber(value);
    const previous = previousAcceptedRef.current;

    previousAcceptedRef.current = {
      initialized: true,
      score,
      value: parsedValue,
    };

    if (
      !previous.initialized ||
      parsedValue === null ||
      previous.value === parsedValue
    ) {
      return;
    }

    const direction =
      previous.value !== null && parsedValue < previous.value
        ? 'decrease'
        : 'increase';

    startReaction({
      direction,
      kind: 'change',
      nextValue: parsedValue,
      scoreChanged: previous.score !== score && score !== null,
    });
  }, [score, startReaction, value]);

  return {
    activeReaction: reaction,
    setCardElement: (element) => {
      cardElementRef.current = element;
    },
    setHelperElement: (element) => {
      helperElementRef.current = element;
    },
    setScoreElement: (element) => {
      scoreElementRef.current = element;
    },
    triggerLimitReaction: () =>
      startReaction({
        direction: 'limit',
        kind: 'limit',
        nextValue: null,
        scoreChanged: false,
      }),
    setValueElement: (element) => {
      valueElementRef.current = element;
    },
  };
};

export const PredictionTeamNumericStep = ({
  conversionAdjustmentNotice = null,
  deductionText = null,
  field,
  fixture,
  form,
  motionEnabled,
  onChange,
  supportingText = [],
}: {
  readonly conversionAdjustmentNotice?: string | null;
  readonly deductionText?: string | null;
  readonly field: TeamScoringNumericField;
  readonly fixture: FixtureDocument;
  readonly form: PredictionFormState;
  readonly motionEnabled: boolean;
  readonly onChange: (side: TeamSide, value: string) => void;
  readonly supportingText?: readonly string[];
}) => (
  <div
    className="grid gap-4"
    data-testid={`react-${numericFieldCopy[field].testIdPrefix}-step`}
  >
    {conversionAdjustmentNotice ? (
      <p
        className="rounded-md border border-rooster-sun/50 bg-rooster-sun/10 p-3 text-sm font-semibold text-rooster-ink"
        role="status"
      >
        {conversionAdjustmentNotice}
      </p>
    ) : null}
    {deductionText || supportingText.length > 0 ? (
      <div className="rounded-md border border-rooster-line bg-rooster-paper p-3">
        {deductionText ? (
          <p className="text-sm font-semibold leading-6 text-rooster-muted">
            {deductionText}
          </p>
        ) : null}
        {supportingText.map((text) => (
          <p
            className="mt-2 text-sm font-semibold leading-6 text-rooster-muted"
            key={text}
          >
            {text}
          </p>
        ))}
      </div>
    ) : null}
    <div className="grid gap-4 md:grid-cols-2">
      {(['team1', 'team2'] as const).map((side) => (
        <TeamNumericPredictionCard
          field={field}
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

const conversionContextText = (teamForm: TeamPredictionForm): string => {
  const tries = parseFormWholeNumber(teamForm.tries);

  if (tries === null) {
    return 'Enter tries first to set your conversion ceiling.';
  }

  return `You predicted ${tries} ${tries === 1 ? 'try' : 'tries'} - conversions can't exceed ${tries}.`;
};

const helperTextForField = (
  field: TeamScoringNumericField,
  teamForm: TeamPredictionForm,
): string => {
  if (field === 'conversions') {
    return conversionContextText(teamForm);
  }

  return numericFieldCopy[field].pointsText;
};

const TeamNumericPredictionCard = ({
  field,
  fixture,
  motionEnabled,
  onChange,
  side,
  teamForm,
}: {
  readonly field: TeamScoringNumericField;
  readonly fixture: FixtureDocument;
  readonly motionEnabled: boolean;
  readonly onChange: (value: string) => void;
  readonly side: TeamSide;
  readonly teamForm: TeamPredictionForm;
}) => {
  const inputId = useId();
  const copy = numericFieldCopy[field];
  const teamName = teamDisplayName(fixture, side);
  const score = deriveTeamScoreFromForm(teamForm, fixture, side);
  const value = teamForm[field];
  const maximum = field === 'conversions' ? teamForm.tries : undefined;
  const max = maximum ? maxAttributeForWholeNumber(maximum) : undefined;
  const helperText = helperTextForField(field, teamForm);
  const reactionHandles = useNumericChangeReaction({
    field,
    motionEnabled,
    score: score.score,
    value,
  });
  const {
    activeReaction,
    setCardElement,
    setHelperElement,
    setScoreElement,
    setValueElement,
    triggerLimitReaction,
  } = reactionHandles;

  const draftExceedsMaximum = (nextValue: string): boolean => {
    const parsedMaximum = max === undefined ? null : parseFormWholeNumber(max);
    const parsedNextValue = parseFormWholeNumber(nextValue);

    return (
      field === 'conversions' &&
      parsedMaximum !== null &&
      parsedNextValue !== null &&
      parsedNextValue > parsedMaximum
    );
  };

  const commit = (nextValue: string) => {
    const exceedsMaximum = draftExceedsMaximum(nextValue);

    onChange(nextValue);

    if (exceedsMaximum) {
      triggerLimitReaction();
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = normalizeWholeNumberDraft(event.target.value);

    if (nextValue === null) {
      return;
    }

    commit(nextValue);
  };

  return (
    <section
      className={[
        'rr-numeric-team-card h-full rounded-md border border-rooster-line bg-rooster-paper p-4 transition focus-within:border-rooster-red/70 focus-within:ring-2 focus-within:ring-rooster-red/20',
        `rr-numeric-team-card--${copy.testIdPrefix}`,
      ].join(' ')}
      data-reaction-active={activeReaction ? 'true' : 'false'}
      data-reaction-direction={activeReaction?.direction ?? undefined}
      data-reaction-kind={activeReaction?.kind ?? undefined}
      data-score-reaction={activeReaction?.scoreChanged ? 'true' : undefined}
      data-testid={`${copy.testIdPrefix}-${side}-card`}
      ref={setCardElement}
    >
      <p className="text-xs font-black uppercase text-rooster-muted">
        Predicted score so far
      </p>
      <PredictedScorePulse
        reaction={activeReaction}
        targetRef={setScoreElement}
        data-testid={`${copy.testIdPrefix}-${side}-score`}
      >
        {score.score === null ? '-' : score.score}
      </PredictedScorePulse>
      <h3 className="mt-1 break-words text-lg font-black text-rooster-ink">
        {teamName}
      </h3>
      {score.message ? (
        <p className="mt-2 text-xs font-semibold leading-5 text-rooster-muted">
          {score.message}
        </p>
      ) : null}

      <NumericValuePulse reaction={activeReaction} targetRef={setValueElement}>
        <NumericStepper
          ariaLabel={`${teamName} ${copy.inputLabelNoun}`}
          id={inputId}
          label={copy.controlLabel}
          max={max}
          onLimit={field === 'conversions' ? triggerLimitReaction : undefined}
          testIdPrefix={`${copy.testIdPrefix}-${side}`}
          value={value}
          onChange={commit}
          onInputChange={handleInputChange}
        />
        <p
          className="rr-numeric-helper mt-2 text-xs font-semibold leading-5 text-rooster-muted"
          data-limit-reaction={
            activeReaction?.kind === 'limit' ? 'true' : undefined
          }
          data-testid={`${copy.testIdPrefix}-${side}-helper`}
          ref={setHelperElement}
        >
          {helperText}
        </p>
        <NumericChangeReaction
          reaction={activeReaction}
          side={side}
          testIdPrefix={copy.testIdPrefix}
        />
      </NumericValuePulse>
    </section>
  );
};

const PredictedScorePulse = ({
  children,
  reaction,
  targetRef,
  ...props
}: {
  readonly children: string | number;
  readonly 'data-testid': string;
  readonly reaction: NumericReactionState | null;
  readonly targetRef: (element: HTMLElement | null) => void;
}) => (
  <p
    className="rr-numeric-score mt-1 text-4xl font-black text-rooster-ink"
    data-reaction-active={reaction?.scoreChanged ? 'true' : 'false'}
    data-reaction-direction={reaction?.direction ?? undefined}
    ref={targetRef}
    {...props}
  >
    {children}
  </p>
);

const NumericValuePulse = ({
  children,
  reaction,
  targetRef,
}: {
  readonly children: ReactNode;
  readonly reaction: NumericReactionState | null;
  readonly targetRef: (element: HTMLElement | null) => void;
}) => (
  <div
    className="rr-numeric-value-pulse mt-4"
    data-reaction-active={reaction ? 'true' : 'false'}
    data-reaction-direction={reaction?.direction ?? undefined}
    data-reaction-kind={reaction?.kind ?? undefined}
    ref={targetRef}
  >
    {children}
  </div>
);

const NumericChangeReaction = ({
  reaction,
  side,
  testIdPrefix,
}: {
  readonly reaction: NumericReactionState | null;
  readonly side: TeamSide;
  readonly testIdPrefix: string;
}) => (
  <p
    aria-hidden="true"
    className="rr-numeric-reaction-copy mt-2 min-h-5 text-sm font-black text-rooster-red"
    data-reaction-active={reaction ? 'true' : 'false'}
    data-reaction-direction={reaction?.direction ?? undefined}
    data-reaction-kind={reaction?.kind ?? undefined}
    data-testid={`${testIdPrefix}-${side}-reaction`}
  >
    {reaction?.message ?? ''}
  </p>
);

const NumericStepper = ({
  ariaLabel,
  id,
  label,
  max,
  min = '0',
  onChange,
  onInputChange,
  onLimit,
  testIdPrefix,
  value,
}: {
  readonly ariaLabel: string;
  readonly id: string;
  readonly label: string;
  readonly max?: string;
  readonly min?: string;
  readonly onChange: (value: string) => void;
  readonly onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onLimit?: () => void;
  readonly testIdPrefix: string;
  readonly value: string;
}) => {
  const parsed = parseFormWholeNumber(value);
  const parsedMin = parseFormWholeNumber(min) ?? 0;
  const parsedMax = max === undefined ? null : parseFormWholeNumber(max);
  const canDecrement = parsed !== null && parsed > parsedMin;
  const canIncrement =
    parsed === null || parsedMax === null || parsed < parsedMax;
  const canReactToLimit = !canIncrement && onLimit !== undefined;
  const decrement = () => {
    onChange(String(Math.max(parsedMin, (parsed ?? parsedMin) - 1)));
  };
  const increment = () => {
    if (!canIncrement) {
      onLimit?.();
      return;
    }

    onChange(String(parsed === null ? parsedMin : parsed + 1));
  };

  return (
    <div>
      <label className="block text-sm font-black text-rooster-ink" htmlFor={id}>
        {label}
      </label>
      <div className="mt-2 grid grid-cols-[3.25rem_minmax(0,1fr)_3.25rem] overflow-hidden rounded-md border border-rooster-line bg-white">
        <button
          aria-label={`Decrease ${ariaLabel}`}
          className="focus-ring min-h-12 border-r border-rooster-line text-2xl font-black text-rooster-ink transition hover:bg-rooster-paper disabled:cursor-not-allowed disabled:text-rooster-muted"
          data-testid={`${testIdPrefix}-decrement`}
          disabled={!canDecrement}
          type="button"
          onClick={decrement}
        >
          -
        </button>
        <input
          aria-label={ariaLabel}
          className="rr-numeric-stepper-input focus-ring min-h-12 w-full border-0 bg-white px-3 text-center text-xl font-black text-rooster-ink"
          data-testid={`${testIdPrefix}-input`}
          id={id}
          inputMode="numeric"
          max={max}
          min={min}
          onChange={onInputChange}
          pattern="[0-9]*"
          step="1"
          type="number"
          value={value}
        />
        <button
          aria-label={`Increase ${ariaLabel}`}
          className={[
            'focus-ring min-h-12 border-l border-rooster-line text-2xl font-black transition hover:bg-rooster-paper disabled:cursor-not-allowed disabled:text-rooster-muted',
            canReactToLimit
              ? 'bg-rooster-sun/10 text-rooster-muted'
              : 'text-rooster-ink',
          ].join(' ')}
          data-limit-reached={canReactToLimit ? 'true' : undefined}
          data-testid={`${testIdPrefix}-increment`}
          disabled={!canIncrement && !canReactToLimit}
          type="button"
          onClick={increment}
        >
          +
        </button>
      </div>
    </div>
  );
};

type CardPredictionField = 'redCards' | 'yellowCards';
type CardKind = 'red' | 'yellow';
type CardReactionDirection = 'decrease' | 'increase';

interface CardFieldDefinition {
  readonly accentLabel: string;
  readonly field: CardPredictionField;
  readonly kind: CardKind;
  readonly label: string;
  readonly testIdSegment: string;
}

interface CardReactionState {
  readonly direction: CardReactionDirection;
  readonly id: number;
  readonly kind: CardKind;
  readonly message: string;
}

interface CardReactionTargets {
  readonly activeReaction: CardReactionState | null;
  readonly setFieldElement: (element: HTMLElement | null) => void;
  readonly setMarkerElement: (element: HTMLElement | null) => void;
  readonly setValueElement: (element: HTMLElement | null) => void;
}

const cardFields = [
  {
    accentLabel: 'yellow',
    field: 'yellowCards',
    kind: 'yellow',
    label: 'Yellow Cards',
    testIdSegment: 'yellow',
  },
  {
    accentLabel: 'red',
    field: 'redCards',
    kind: 'red',
    label: 'Red Cards',
    testIdSegment: 'red',
  },
] as const satisfies readonly CardFieldDefinition[];

const cardReactionDurationMs = 380;

const cardReactionMessage = (
  kind: CardKind,
  direction: CardReactionDirection,
  nextValue: number | null,
): string => {
  if (direction === 'decrease') {
    return kind === 'yellow' ? 'Careful now.' : 'Back from the brink.';
  }

  const yellowMessages = [
    'Into the book.',
    "Ref's reaching for the pocket.",
    'Careful now.',
  ];
  const redMessages = ['OFF!', 'Early shower?', 'That changes things.'];
  const messages = kind === 'yellow' ? yellowMessages : redMessages;
  const index = Math.max(0, nextValue ?? 0) % messages.length;

  return messages[index] ?? messages[0];
};

const useCardChangeReaction = ({
  activeReactionKey,
  kind,
  motionEnabled,
  reactionKey,
  value,
}: {
  readonly activeReactionKey: string | null;
  readonly kind: CardKind;
  readonly motionEnabled: boolean;
  readonly reactionKey: string;
  readonly value: string;
}): CardReactionTargets => {
  const animationRefs = useRef<Animation[]>([]);
  const fieldElementRef = useRef<HTMLElement | null>(null);
  const markerElementRef = useRef<HTMLElement | null>(null);
  const nextReactionIdRef = useRef(0);
  const previousAcceptedRef = useRef<{
    readonly initialized: boolean;
    readonly value: number | null;
  }>({
    initialized: false,
    value: null,
  });
  const timeoutRef = useRef<number | null>(null);
  const valueElementRef = useRef<HTMLElement | null>(null);
  const [reaction, setReaction] = useState<CardReactionState | null>(null);

  const cancelAnimations = useCallback(() => {
    for (const animation of animationRefs.current) {
      animation.cancel();
    }

    animationRefs.current = [];
  }, []);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const playReaction = useCallback(
    (nextReaction: CardReactionState) => {
      cancelAnimations();

      if (!motionEnabled) {
        return;
      }

      const animations: Animation[] = [];
      const isIncrease = nextReaction.direction === 'increase';
      const fieldAnimation = playElementAnimation(
        fieldElementRef.current,
        [
          { transform: 'translateY(0) scale(1)' },
          {
            transform:
              kind === 'red' && isIncrease
                ? 'translateY(-0.08rem) scale(1.045)'
                : 'translateY(-0.16rem) scale(1.025)',
          },
          { transform: 'translateY(0) scale(1)' },
        ],
        {
          duration: kind === 'red' && isIncrease ? 320 : cardReactionDurationMs,
          easing:
            kind === 'red' && isIncrease
              ? 'cubic-bezier(0.2, 0, 0.2, 1)'
              : 'cubic-bezier(0.18, 0.89, 0.32, 1.28)',
        },
      );

      if (fieldAnimation) {
        animations.push(fieldAnimation);
      }

      const markerAnimation =
        kind === 'yellow'
          ? playElementAnimation(
              markerElementRef.current,
              [
                { transform: 'translateY(0) rotateX(0deg)' },
                {
                  transform: isIncrease
                    ? 'translateY(-0.65rem) rotateX(64deg)'
                    : 'translateY(0.25rem) rotateX(-32deg)',
                },
                { transform: 'translateY(0) rotateX(0deg)' },
              ],
              {
                duration: cardReactionDurationMs,
                easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)',
              },
            )
          : playElementAnimation(
              markerElementRef.current,
              [
                { transform: 'translateY(0) scale(1)' },
                {
                  transform: isIncrease
                    ? 'translateY(-0.2rem) scale(1.24)'
                    : 'translateY(0.2rem) scale(0.9)',
                },
                { transform: 'translateY(0) scale(1)' },
              ],
              {
                duration: kind === 'red' && isIncrease ? 300 : 340,
                easing:
                  kind === 'red' && isIncrease
                    ? 'cubic-bezier(0.17, 0.67, 0.21, 1.44)'
                    : 'cubic-bezier(0.2, 0, 0.2, 1)',
              },
            );

      if (markerAnimation) {
        animations.push(markerAnimation);
      }

      const valueAnimation = playElementAnimation(
        valueElementRef.current,
        [
          { transform: 'translateY(0) scale(1)' },
          {
            transform: isIncrease
              ? 'translateY(-0.32rem) scale(1.16)'
              : 'translateY(0.2rem) scale(0.94)',
          },
          { transform: 'translateY(0) scale(1)' },
        ],
        {
          duration: cardReactionDurationMs,
          easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)',
        },
      );

      if (valueAnimation) {
        animations.push(valueAnimation);
      }

      animationRefs.current = animations;
    },
    [cancelAnimations, kind, motionEnabled],
  );

  const startReaction = useCallback(
    ({
      direction,
      nextValue,
    }: {
      readonly direction: CardReactionDirection;
      readonly nextValue: number | null;
    }) => {
      if (!motionEnabled) {
        return;
      }

      clearTimer();

      const nextReaction = {
        direction,
        id: nextReactionIdRef.current + 1,
        kind,
        message: cardReactionMessage(kind, direction, nextValue),
      } satisfies CardReactionState;

      nextReactionIdRef.current = nextReaction.id;
      setReaction(nextReaction);
      playReaction(nextReaction);
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        setReaction((current) =>
          current?.id === nextReaction.id ? null : current,
        );
      }, cardReactionDurationMs);
    },
    [clearTimer, kind, motionEnabled, playReaction],
  );

  useEffect(() => {
    if (motionEnabled) {
      return undefined;
    }

    clearTimer();
    cancelAnimations();

    const timeout = window.setTimeout(() => {
      setReaction(null);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [cancelAnimations, clearTimer, motionEnabled]);

  useEffect(() => {
    if (activeReactionKey === reactionKey) {
      return;
    }

    clearTimer();
    cancelAnimations();
    const timeout = window.setTimeout(() => {
      setReaction(null);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [activeReactionKey, cancelAnimations, clearTimer, reactionKey]);

  useEffect(
    () => () => {
      clearTimer();
      cancelAnimations();
    },
    [cancelAnimations, clearTimer],
  );

  useEffect(() => {
    const parsedValue = parseFormWholeNumber(value);
    const previous = previousAcceptedRef.current;

    previousAcceptedRef.current = {
      initialized: true,
      value: parsedValue,
    };

    if (
      !previous.initialized ||
      parsedValue === null ||
      previous.value === parsedValue
    ) {
      return;
    }

    if (activeReactionKey !== reactionKey) {
      return;
    }

    startReaction({
      direction:
        previous.value !== null && parsedValue < previous.value
          ? 'decrease'
          : 'increase',
      nextValue: parsedValue,
    });
  }, [activeReactionKey, reactionKey, startReaction, value]);

  return {
    activeReaction: activeReactionKey === reactionKey ? reaction : null,
    setFieldElement: (element) => {
      fieldElementRef.current = element;
    },
    setMarkerElement: (element) => {
      markerElementRef.current = element;
    },
    setValueElement: (element) => {
      valueElementRef.current = element;
    },
  };
};

export const CardsPredictionStep = ({
  deductionText = null,
  fixture,
  form,
  motionEnabled,
  onChange,
  showRedCards,
  showYellowCards,
  supportingText = [],
}: {
  readonly deductionText?: string | null;
  readonly fixture: FixtureDocument;
  readonly form: PredictionFormState;
  readonly motionEnabled: boolean;
  readonly onChange: (
    side: TeamSide,
    field: CardPredictionField,
    value: string,
  ) => void;
  readonly showRedCards: boolean;
  readonly showYellowCards: boolean;
  readonly supportingText?: readonly string[];
}) => {
  const [activeReactionKey, setActiveReactionKey] = useState<string | null>(
    null,
  );
  const activeFields = cardFields.filter(
    (field) =>
      (field.kind === 'yellow' && showYellowCards) ||
      (field.kind === 'red' && showRedCards),
  );
  const changeCard = (
    side: TeamSide,
    field: CardPredictionField,
    value: string,
  ) => {
    setActiveReactionKey(`${side}:${field}`);
    onChange(side, field, value);
  };

  return (
    <div className="grid gap-4" data-testid="react-cards-step">
      {deductionText || supportingText.length > 0 ? (
        <div className="rounded-md border border-rooster-line bg-rooster-paper p-3">
          {deductionText ? (
            <p className="text-sm font-semibold leading-6 text-rooster-muted">
              {deductionText}
            </p>
          ) : null}
          {supportingText.map((text) => (
            <p
              className="mt-2 text-sm font-semibold leading-6 text-rooster-muted"
              key={text}
            >
              {text}
            </p>
          ))}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {(['team1', 'team2'] as const).map((side) => (
          <CardsTeamPanel
            activeFields={activeFields}
            activeReactionKey={activeReactionKey}
            fixture={fixture}
            form={form}
            key={side}
            motionEnabled={motionEnabled}
            side={side}
            onChange={changeCard}
          />
        ))}
      </div>
    </div>
  );
};

const CardsTeamPanel = ({
  activeReactionKey,
  activeFields,
  fixture,
  form,
  motionEnabled,
  onChange,
  side,
}: {
  readonly activeReactionKey: string | null;
  readonly activeFields: readonly CardFieldDefinition[];
  readonly fixture: FixtureDocument;
  readonly form: PredictionFormState;
  readonly motionEnabled: boolean;
  readonly onChange: (
    side: TeamSide,
    field: CardPredictionField,
    value: string,
  ) => void;
  readonly side: TeamSide;
}) => {
  const score = deriveTeamScoreFromForm(form[side], fixture, side);
  const teamName = teamDisplayName(fixture, side);

  return (
    <section
      className="rr-cards-team-card h-full rounded-md border border-rooster-line bg-rooster-paper p-4 transition focus-within:border-rooster-red/70 focus-within:ring-2 focus-within:ring-rooster-red/20"
      data-testid={`cards-${side}-team-card`}
    >
      <p className="text-xs font-black uppercase text-rooster-muted">
        Predicted rugby score
      </p>
      <p
        className="mt-1 text-4xl font-black text-rooster-ink"
        data-testid={`cards-${side}-score`}
      >
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
      <p className="mt-3 text-xs font-semibold leading-5 text-rooster-muted">
        Cards affect prediction accuracy, not the predicted rugby score.
      </p>
      <div className="mt-4 grid gap-3">
        {activeFields.map((field) => (
          <CardPredictionControl
            activeReactionKey={activeReactionKey}
            field={field}
            key={field.field}
            motionEnabled={motionEnabled}
            reactionKey={`${side}:${field.field}`}
            teamName={teamName}
            testIdPrefix={`cards-${side}-${field.testIdSegment}`}
            value={form[side][field.field]}
            onChange={(value) => onChange(side, field.field, value)}
          />
        ))}
      </div>
    </section>
  );
};

const CardPredictionControl = ({
  activeReactionKey,
  field,
  motionEnabled,
  onChange,
  reactionKey,
  teamName,
  testIdPrefix,
  value,
}: {
  readonly activeReactionKey: string | null;
  readonly field: CardFieldDefinition;
  readonly motionEnabled: boolean;
  readonly onChange: (value: string) => void;
  readonly reactionKey: string;
  readonly teamName: string;
  readonly testIdPrefix: string;
  readonly value: string;
}) => {
  const inputId = useId();
  const reactionHandles = useCardChangeReaction({
    activeReactionKey,
    kind: field.kind,
    motionEnabled,
    reactionKey,
    value,
  });
  const { activeReaction, setFieldElement, setMarkerElement, setValueElement } =
    reactionHandles;
  const inputLabel = `${teamName} ${field.accentLabel} cards`;
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = normalizeWholeNumberDraft(event.target.value);

    if (nextValue === null) {
      return;
    }

    onChange(nextValue);
  };

  return (
    <section
      className={[
        'rr-card-field rounded-md border bg-white p-3 transition',
        `rr-card-field--${field.kind}`,
      ].join(' ')}
      data-card-kind={field.kind}
      data-reaction-active={activeReaction ? 'true' : 'false'}
      data-reaction-direction={activeReaction?.direction ?? undefined}
      data-testid={`${testIdPrefix}-field`}
      ref={setFieldElement}
    >
      <div className="flex items-start gap-5">
        <span
          aria-hidden="true"
          className={[
            'rr-card-marker mt-0.5 shrink-0',
            `rr-card-marker--${field.kind}`,
          ].join(' ')}
          data-testid={`${testIdPrefix}-marker`}
          ref={setMarkerElement}
        />
        <div className="min-w-0 flex-1">
          <CardValuePulse targetRef={setValueElement}>
            <NumericStepper
              ariaLabel={inputLabel}
              id={inputId}
              label={field.label}
              testIdPrefix={testIdPrefix}
              value={value}
              onChange={onChange}
              onInputChange={handleInputChange}
            />
          </CardValuePulse>
          <CardCountVisualization
            kind={field.kind}
            testIdPrefix={testIdPrefix}
            value={value}
          />
          <p
            aria-hidden="true"
            className={[
              'rr-card-reaction-copy mt-2 min-h-5 text-sm font-black',
              field.kind === 'yellow' ? 'text-rooster-ink' : 'text-rooster-red',
            ].join(' ')}
            data-reaction-active={activeReaction ? 'true' : 'false'}
            data-reaction-direction={activeReaction?.direction ?? undefined}
            data-testid={`${testIdPrefix}-reaction`}
          >
            {activeReaction?.message ?? ''}
          </p>
        </div>
      </div>
    </section>
  );
};

const CardValuePulse = ({
  children,
  targetRef,
}: {
  readonly children: ReactNode;
  readonly targetRef: (element: HTMLElement | null) => void;
}) => (
  <div className="rr-card-value-pulse" ref={targetRef}>
    {children}
  </div>
);

const CardCountVisualization = ({
  kind,
  testIdPrefix,
  value,
}: {
  readonly kind: CardKind;
  readonly testIdPrefix: string;
  readonly value: string;
}) => {
  const parsed = parseFormWholeNumber(value);

  if (parsed === null) {
    return null;
  }

  if (parsed === 0) {
    return (
      <p
        aria-hidden="true"
        className="mt-2 text-xs font-bold text-rooster-muted"
        data-testid={`${testIdPrefix}-stack`}
      >
        No cards
      </p>
    );
  }

  if (parsed >= 5) {
    return (
      <div
        aria-hidden="true"
        className="rr-card-stack mt-2 flex items-center gap-1.5"
        data-testid={`${testIdPrefix}-stack`}
      >
        <span
          className={[
            'rr-card-stack-marker',
            `rr-card-stack-marker--${kind}`,
          ].join(' ')}
        />
        <span className="text-xs font-black text-rooster-muted">
          x {parsed}
        </span>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="rr-card-stack mt-2 flex items-center gap-1.5"
      data-testid={`${testIdPrefix}-stack`}
    >
      {Array.from({ length: parsed }, (_, index) => (
        <span
          className={[
            'rr-card-stack-marker',
            `rr-card-stack-marker--${kind}`,
          ].join(' ')}
          key={index}
        />
      ))}
    </div>
  );
};

interface CategoricalChoiceOption {
  readonly accent?: 'neutral' | 'team';
  readonly disabled?: boolean;
  readonly label: string;
  readonly value: string;
}

interface CategoricalReactionState {
  readonly id: number;
  readonly message: string;
  readonly value: string;
}

const categoricalReactionDurationMs = 680;

const firstTryReactionMessage = (value: string, id: number): string => {
  const teamMessages = [
    'First blood?',
    'Backing them to strike first.',
    'Fast start?',
  ];
  const noTryMessages = [
    'No tries? Brave call.',
    'All boot, no dot-down?',
    'Defences on top?',
  ];
  const messages = value === 'no-tries' ? noTryMessages : teamMessages;

  return messages[id % messages.length] ?? messages[0];
};

export const FirstTryPredictionStep = ({
  constraintMessage = null,
  fixture,
  motionEnabled,
  onChange,
  onEditTries,
  options,
  value,
}: {
  readonly constraintMessage?: string | null;
  readonly fixture: FixtureDocument;
  readonly motionEnabled: boolean;
  readonly onChange: (value: FirstTryAnswer) => void;
  readonly onEditTries: () => void;
  readonly options: readonly {
    readonly disabled?: boolean;
    readonly label: string;
    readonly value: FirstTryAnswer;
  }[];
  readonly value: string;
}) => (
  <div className="grid gap-4" data-testid="react-first-try-step">
    <CategoricalChoicePresentation
      label="Who will score the first try?"
      name="first-try"
      motionEnabled={motionEnabled}
      options={options.map((option) => ({
        ...option,
        accent: option.value === 'no-tries' ? 'neutral' : 'team',
      }))}
      reactionMessage={firstTryReactionMessage}
      testIdPrefix="first-try"
      value={value}
      onChange={(nextValue) => onChange(nextValue as FirstTryAnswer)}
    />
    {constraintMessage ? (
      <div className="rounded-md border border-rooster-line bg-rooster-paper p-3 text-sm font-semibold text-rooster-muted">
        {constraintMessage}
        <button
          className="focus-ring ml-2 min-h-9 rounded-md border border-rooster-line bg-white px-3 text-xs font-black text-rooster-ink transition hover:bg-rooster-paper"
          type="button"
          onClick={onEditTries}
        >
          Edit tries
        </button>
      </div>
    ) : null}
    <p className="sr-only">
      First try choices are {teamDisplayName(fixture, 'team1')},{' '}
      {teamDisplayName(fixture, 'team2')}, and No Tries Today.
    </p>
  </div>
);

const CategoricalChoicePresentation = ({
  label,
  motionEnabled,
  name,
  onChange,
  options,
  reactionMessage,
  testIdPrefix,
  value,
}: {
  readonly label: string;
  readonly motionEnabled: boolean;
  readonly name: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly CategoricalChoiceOption[];
  readonly reactionMessage: (value: string, id: number) => string;
  readonly testIdPrefix: string;
  readonly value: string;
}) => {
  const baseId = useId();
  const animationRefs = useRef<Animation[]>([]);
  const choiceRefs = useRef<Record<string, HTMLLabelElement | null>>({});
  const nextReactionIdRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);
  const [reaction, setReaction] = useState<CategoricalReactionState | null>(
    null,
  );

  const cancelAnimations = useCallback(() => {
    for (const animation of animationRefs.current) {
      animation.cancel();
    }

    animationRefs.current = [];
  }, []);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startReaction = useCallback(
    (nextValue: string) => {
      if (!motionEnabled) {
        return;
      }

      clearTimer();
      cancelAnimations();

      const nextId = nextReactionIdRef.current + 1;
      const nextReaction = {
        id: nextId,
        message: reactionMessage(nextValue, nextId),
        value: nextValue,
      } satisfies CategoricalReactionState;
      const selectedElement = choiceRefs.current[nextValue];
      const selectedAnimation = playElementAnimation(
        selectedElement,
        [
          { transform: 'translateY(0) scale(1)' },
          { transform: 'translateY(-0.45rem) scale(1.035)' },
          { transform: 'translateY(0) scale(1)' },
        ],
        {
          duration: categoricalReactionDurationMs,
          easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)',
        },
      );

      nextReactionIdRef.current = nextId;
      animationRefs.current = selectedAnimation ? [selectedAnimation] : [];
      setReaction(nextReaction);
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        setReaction((current) =>
          current?.id === nextReaction.id ? null : current,
        );
      }, categoricalReactionDurationMs);
    },
    [cancelAnimations, clearTimer, motionEnabled, reactionMessage],
  );

  const selectChoice = (option: CategoricalChoiceOption) => {
    if (option.disabled || option.value === value) {
      return;
    }

    onChange(option.value);
    startReaction(option.value);
  };

  useEffect(() => {
    if (motionEnabled) {
      return undefined;
    }

    clearTimer();
    cancelAnimations();

    const timeout = window.setTimeout(() => {
      setReaction(null);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [cancelAnimations, clearTimer, motionEnabled]);

  useEffect(() => {
    if (!reaction || reaction.value === value) {
      return;
    }

    clearTimer();
    cancelAnimations();
    const timeout = window.setTimeout(() => {
      setReaction(null);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [cancelAnimations, clearTimer, reaction, value]);

  useEffect(
    () => () => {
      clearTimer();
      cancelAnimations();
    },
    [cancelAnimations, clearTimer],
  );

  const visibleReaction = reaction?.value === value ? reaction : null;

  return (
    <fieldset className="rr-categorical-choice-group">
      <legend className="sr-only">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((option) => {
          const checked = option.value === value;
          const reactionActive = visibleReaction?.value === option.value;

          return (
            <label
              className={[
                'rr-categorical-choice-card flex min-h-20 cursor-pointer items-center rounded-md border p-4 text-sm font-black transition',
                checked
                  ? 'border-rooster-red bg-rooster-red text-white shadow-sm'
                  : 'border-rooster-line bg-white text-rooster-ink hover:bg-rooster-paper',
                checked ? 'rr-categorical-choice-card--selected' : '',
                value && !checked
                  ? 'rr-categorical-choice-card--secondary'
                  : '',
                option.accent === 'neutral'
                  ? 'rr-categorical-choice-card--neutral'
                  : 'rr-categorical-choice-card--team',
                option.disabled ? 'cursor-not-allowed opacity-60' : '',
              ].join(' ')}
              data-reaction-active={reactionActive ? 'true' : 'false'}
              data-selected={checked ? 'true' : 'false'}
              data-testid={`${testIdPrefix}-choice-${option.value}`}
              key={option.value}
              ref={(element) => {
                choiceRefs.current[option.value] = element;
              }}
            >
              <input
                checked={checked}
                className="focus-ring mr-3 h-4 w-4 shrink-0 accent-rooster-red"
                disabled={option.disabled}
                id={`${baseId}-${option.value}`}
                name={name}
                type="radio"
                value={option.value}
                onChange={() => selectChoice(option)}
              />
              <span className="min-w-0 break-words leading-6">
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
      <p
        aria-hidden="true"
        className="rr-categorical-reaction-copy mt-3 min-h-5 text-sm font-black text-rooster-red"
        data-reaction-active={visibleReaction ? 'true' : 'false'}
        data-testid={`${testIdPrefix}-reaction`}
      >
        {visibleReaction?.message ?? ''}
      </p>
    </fieldset>
  );
};
