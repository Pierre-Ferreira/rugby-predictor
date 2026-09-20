// @vitest-environment jsdom

import { readFileSync } from 'node:fs';

import {
  StrictMode,
  act,
  createElement,
  useState,
  type ReactElement,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FixtureDocument } from '../../imports/shared/fixtures';
import {
  resolvePredictionStepMessage,
  type PredictionMessageId,
} from '../../imports/shared/predictions';
import type { RulesetSnapshot, TeamSide } from '../../imports/shared/scoring';
import { defaultRuleset } from '../../imports/shared/scoring';
import {
  PredictionPresentationHost,
  type PredictionPresentationOptions,
} from '../../imports/ui/predictions/PredictionPresentationHost';
import {
  ConversionsPredictionStep,
  DropGoalsPredictionStep,
  MatchResultPredictionStep,
  PenaltyKicksPredictionStep,
  TriesPredictionStep,
} from '../../imports/ui/predictions/reactPredictionPresentation';
import {
  emptyFormForRuleset,
  setTeamPredictionField,
  type PredictionFormState,
} from '../../imports/ui/predictions/standardPredictionState';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

interface MountedElement {
  readonly container: HTMLDivElement;
  readonly rerender: (element: ReactElement) => Promise<void>;
  readonly unmount: () => Promise<void>;
}

const mounted: MountedElement[] = [];
const restoreAnimateDescriptors: Array<() => void> = [];
const restoreMatchMediaDescriptors: Array<() => void> = [];

afterEach(async () => {
  vi.useRealTimers();
  window.localStorage.clear();

  while (restoreAnimateDescriptors.length > 0) {
    restoreAnimateDescriptors.pop()?.();
  }

  while (restoreMatchMediaDescriptors.length > 0) {
    restoreMatchMediaDescriptors.pop()?.();
  }

  while (mounted.length > 0) {
    const current = mounted.pop();

    if (current) {
      await current.unmount();
    }
  }
});

const now = new Date('2026-09-19T08:00:00.000Z');

const fixture = ({
  ruleset = defaultRuleset,
  team1DisplayName = 'Springboks',
  team2DisplayName = 'All Blacks',
}: {
  readonly ruleset?: RulesetSnapshot;
  readonly team1DisplayName?: string;
  readonly team2DisplayName?: string;
} = {}): FixtureDocument => ({
  _id: 'fixture-1',
  competitionDisplayName: 'Hook Cup',
  createdAt: now,
  createdByAdminId: 'admin-1',
  isCancelled: false,
  publishedAt: now,
  publishedByAdminId: 'admin-1',
  revision: 1,
  rulesetSnapshot: ruleset,
  scheduledKickoffAt: new Date('2098-06-01T12:00:00.000Z'),
  team1DisplayName,
  team2DisplayName,
  updatedAt: now,
  updatedByAdminId: 'admin-1',
  visibility: 'published',
});

const mount = async (element: ReactElement): Promise<MountedElement> => {
  const container = document.createElement('div');
  const root: Root = createRoot(container);

  document.body.append(container);

  const render = async (nextElement: ReactElement) => {
    await act(async () => {
      root.render(nextElement);
    });
  };

  await render(element);

  const mountedElement: MountedElement = {
    container,
    rerender: render,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };

  mounted.push(mountedElement);

  return mountedElement;
};

const replaceMatchMedia = (matches: boolean) => {
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      matches,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });

  restoreMatchMediaDescriptors.push(() => {
    if (original) {
      Object.defineProperty(window, 'matchMedia', original);
    } else {
      delete (window as { matchMedia?: Window['matchMedia'] }).matchMedia;
    }
  });
};

const buttonByText = (container: HTMLElement, text: string) => {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent === text,
  );

  if (!button) {
    throw new Error(`Button "${text}" not found.`);
  }

  return button;
};

const matchResultRadios = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLInputElement>('input[name="match-result"]'),
  );

const enabledMatchResultRadios = (container: HTMLElement) =>
  matchResultRadios(container).filter((radio) => !radio.disabled);

const matchResultStage = (container: HTMLElement) => {
  const stage = container.querySelector<HTMLElement>(
    '[data-testid="react-match-result-step"] [data-motion-phase]',
  );

  if (!stage) {
    throw new Error('Match Result stage not found.');
  }

  return stage;
};

const queryRadioByValue = (container: HTMLElement, value: string) =>
  container.querySelector<HTMLInputElement>(
    `input[type="radio"][value="${value}"]`,
  );

const radioByValue = (container: HTMLElement, value: string) => {
  const radio = queryRadioByValue(container, value);

  if (!radio) {
    throw new Error(`Radio "${value}" not found.`);
  }

  return radio;
};

const matchResultChoiceCard = (container: HTMLElement, value: string) => {
  const card = container.querySelector<HTMLElement>(
    `[data-testid="match-result-choice-${value}"]`,
  );

  if (!card) {
    throw new Error(`Match Result choice card "${value}" not found.`);
  }

  return card;
};

const inputByTestId = (container: HTMLElement, testId: string) => {
  const input = container.querySelector<HTMLInputElement>(
    `[data-testid="${testId}"]`,
  );

  if (!input) {
    throw new Error(`Input "${testId}" not found.`);
  }

  return input;
};

const buttonByTestId = (container: HTMLElement, testId: string) => {
  const button = container.querySelector<HTMLButtonElement>(
    `[data-testid="${testId}"]`,
  );

  if (!button) {
    throw new Error(`Button "${testId}" not found.`);
  }

  return button;
};

const elementByTestId = (container: HTMLElement, testId: string) => {
  const element = container.querySelector<HTMLElement>(
    `[data-testid="${testId}"]`,
  );

  if (!element) {
    throw new Error(`Element "${testId}" not found.`);
  }

  return element;
};

const click = async (element: HTMLElement) => {
  await act(async () => {
    element.click();
  });
};

const finishAnimation = async (element: HTMLElement) => {
  await act(async () => {
    element.dispatchEvent(new Event('animationend', { bubbles: true }));
  });
};

const changeInput = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;

    valueSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const replaceAnimate = () => {
  const cancel = vi.fn();
  const animate = vi.fn(() => ({ cancel }) as unknown as Animation);
  const original = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'animate',
  );

  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    value: animate,
  });

  restoreAnimateDescriptors.push(() => {
    if (original) {
      Object.defineProperty(HTMLElement.prototype, 'animate', original);
    } else {
      delete (HTMLElement.prototype as { animate?: Element['animate'] })
        .animate;
    }
  });

  return { animate, cancel };
};

const MatchResultHarness = ({
  initialValue = '',
  motionEnabled,
  onChoice,
}: {
  readonly initialValue?: string;
  readonly motionEnabled: boolean;
  readonly onChoice: (value: string) => void;
}) => {
  const [value, setValue] = useState(initialValue);

  return createElement(MatchResultPredictionStep, {
    fixture: fixture(),
    motionEnabled,
    value,
    onChange: (nextValue: string) => {
      onChoice(nextValue);
      setValue(nextValue);
    },
  });
};

const MatchResultHostHarness = ({
  initialValue = '',
  onChoice,
}: {
  readonly initialValue?: string;
  readonly onChoice: (value: string) => void;
}) => {
  const [value, setValue] = useState(initialValue);

  return createElement(PredictionPresentationHost, {
    renderExperience: (presentation) =>
      createElement(MatchResultPredictionStep, {
        fixture: fixture(),
        motionEnabled: presentation.animationsEnabled,
        value,
        onChange: (nextValue: string) => {
          onChoice(nextValue);
          setValue(nextValue);
        },
      }),
  });
};

const TriesHarness = ({
  motionEnabled,
  onTeamChange,
}: {
  readonly motionEnabled: boolean;
  readonly onTeamChange: (
    side: TeamSide,
    value: string,
    form: PredictionFormState,
  ) => void;
}) => {
  const [form, setForm] = useState<PredictionFormState>(() => ({
    ...emptyFormForRuleset(defaultRuleset),
    team1: {
      ...emptyFormForRuleset(defaultRuleset).team1,
      conversions: '3',
      tries: '3',
    },
  }));

  const changeTries = (side: TeamSide, value: string) => {
    setForm((currentForm) => {
      const result = setTeamPredictionField(currentForm, side, 'tries', value);

      onTeamChange(side, value, result.form);

      return result.form;
    });
  };

  return createElement(
    'div',
    null,
    createElement(TriesPredictionStep, {
      conversionAdjustmentNotice: null,
      fixture: fixture(),
      form,
      motionEnabled,
      onChange: changeTries,
    }),
    createElement(
      'output',
      { 'data-testid': 'team1-conversions' },
      form.team1.conversions,
    ),
  );
};

type NumericHarnessField =
  'conversions' | 'dropGoals' | 'penaltyKicks' | 'tries';

type PredictionFormOverrides = Partial<
  Omit<PredictionFormState, 'team1' | 'team2'>
> & {
  readonly team1?: Partial<PredictionFormState['team1']>;
  readonly team2?: Partial<PredictionFormState['team2']>;
};

const formWithOverrides = (
  overrides: PredictionFormOverrides = {},
): PredictionFormState => {
  const empty = emptyFormForRuleset(defaultRuleset);

  return {
    ...empty,
    ...overrides,
    team1: {
      ...empty.team1,
      ...overrides.team1,
    },
    team2: {
      ...empty.team2,
      ...overrides.team2,
    },
  };
};

const messageIdForNumericField = (
  field: NumericHarnessField,
): PredictionMessageId => {
  if (field === 'dropGoals') {
    return 'drop-goals';
  }

  if (field === 'penaltyKicks') {
    return 'penalty-kicks';
  }

  return field;
};

const numericStepPrefix = (field: NumericHarnessField): string => {
  if (field === 'dropGoals') {
    return 'drop-goals';
  }

  if (field === 'penaltyKicks') {
    return 'penalty-kicks';
  }

  return field;
};

const rulesetWithNumericRate = (
  questionId: 'drop-goals' | 'penalty-kicks',
  rate: number,
): RulesetSnapshot =>
  ({
    ...defaultRuleset,
    questions: defaultRuleset.questions.map((question) =>
      question.id === questionId && question.type === 'built-in-team-numeric'
        ? { ...question, rate }
        : question,
    ),
    version: `${defaultRuleset.version}-${questionId}-${rate}`,
  }) as RulesetSnapshot;

const NumericStepHarness = ({
  field,
  initialForm,
  motionEnabled,
  onTeamChange,
  ruleset = defaultRuleset,
}: {
  readonly field: NumericHarnessField;
  readonly initialForm?: PredictionFormOverrides;
  readonly motionEnabled: boolean;
  readonly onTeamChange?: (
    side: TeamSide,
    field: NumericHarnessField,
    value: string,
    form: PredictionFormState,
  ) => void;
  readonly ruleset?: RulesetSnapshot;
}) => {
  const [form, setForm] = useState<PredictionFormState>(() =>
    formWithOverrides(initialForm),
  );
  const currentFixture = fixture({ ruleset });
  const messageId = messageIdForNumericField(field);
  const stepMessage = resolvePredictionStepMessage(
    messageId,
    { [messageId]: 0 },
    {
      ruleset,
      team1Name: currentFixture.team1DisplayName,
      team2Name: currentFixture.team2DisplayName,
    },
  );
  const changeField = (side: TeamSide, value: string) => {
    setForm((currentForm) => {
      const result = setTeamPredictionField(currentForm, side, field, value);

      onTeamChange?.(side, field, value, result.form);

      return result.form;
    });
  };
  const props = {
    conversionAdjustmentNotice: null,
    deductionText: stepMessage.deduction,
    fixture: currentFixture,
    form,
    motionEnabled,
    onChange: changeField,
    supportingText: stepMessage.supportingText,
  };

  if (field === 'conversions') {
    return createElement(ConversionsPredictionStep, props);
  }

  if (field === 'dropGoals') {
    return createElement(DropGoalsPredictionStep, props);
  }

  if (field === 'penaltyKicks') {
    return createElement(PenaltyKicksPredictionStep, props);
  }

  return createElement(TriesPredictionStep, props);
};

describe('React prediction presentation host', () => {
  it('keeps the same rendered controls when Animations toggles On and Off', async () => {
    replaceMatchMedia(false);

    const Experience = ({
      presentation,
    }: {
      readonly presentation: PredictionPresentationOptions;
    }) =>
      createElement('input', {
        'data-animations-enabled': String(presentation.animationsEnabled),
        'data-testid': 'stable-control',
        readOnly: true,
        value: 'shared-control',
      });

    const mountedHost = await mount(
      createElement(
        StrictMode,
        null,
        createElement(PredictionPresentationHost, {
          renderExperience: (presentation) =>
            createElement(Experience, { presentation }),
        }),
      ),
    );

    const inputBefore = inputByTestId(mountedHost.container, 'stable-control');

    await click(buttonByText(mountedHost.container, 'Off'));
    await click(buttonByText(mountedHost.container, 'On'));

    const inputAfter = inputByTestId(mountedHost.container, 'stable-control');

    expect(inputAfter).toBe(inputBefore);
    expect(inputAfter.dataset.animationsEnabled).toBe('true');
  });

  it('keeps On stored while reduced motion suppresses motion only', async () => {
    replaceMatchMedia(true);

    const mountedHost = await mount(
      createElement(PredictionPresentationHost, {
        renderExperience: (presentation) =>
          createElement('div', {
            'data-enabled': String(presentation.animationsEnabled),
            'data-preference': presentation.animationPreference,
            'data-testid': 'presentation-state',
          }),
      }),
    );
    const state = mountedHost.container.querySelector<HTMLElement>(
      '[data-testid="presentation-state"]',
    );

    expect(state?.dataset.preference).toBe('on');
    expect(state?.dataset.enabled).toBe('false');
    expect(mountedHost.container.textContent).toContain(
      'Reduced motion is active.',
    );
  });
});

describe('Match Result React presentation', () => {
  it('defines a physical selected-card lift and hidden rejected-real-control CSS', () => {
    const css = readFileSync('client/main.css', 'utf8');

    expect(css).toMatch(/--rr-match-result-selected-lift: 7\.5rem;/);
    expect(css).toMatch(
      /@keyframes rr-match-result-selected-rise[\s\S]*var\(--rr-match-result-selected-shift-x\)[\s\S]*calc\(-1 \* var\(--rr-match-result-selected-lift\)\)/,
    );
    expect(css).toMatch(
      /\.rr-match-result-stage--revealing[\s\S]*min-height: var\(--rr-match-result-reveal-min-height\);[\s\S]*margin-top: var\(--rr-match-result-stage-lift-space\);/,
    );
    expect(css).toMatch(
      /@keyframes rr-match-result-rooster-travel[\s\S]*35%[\s\S]*var\(--rr-match-result-rooster-entry-left\)[\s\S]*52%[\s\S]*var\(--rr-match-result-rooster-underpass-left\)[\s\S]*64%[\s\S]*var\(--rr-match-result-rooster-contact-left\)/,
    );
    expect(css).toMatch(
      /\.rr-match-result-stage \.rr-match-result-choice-card--selected-rise[\s\S]*animation: rr-match-result-selected-rise 1400ms/,
    );
    expect(css).toMatch(
      /\.rr-match-result-shove-layer[\s\S]*animation: rr-match-result-layer-life 1400ms linear both;/,
    );
    expect(css).toMatch(
      /\.rr-match-result-rooster[\s\S]*animation: rr-match-result-rooster-travel 1400ms linear both;/,
    );
    expect(css).toMatch(
      /\.rr-match-result-shove-pack[\s\S]*animation: rr-match-result-shove-pack 1400ms linear both;/,
    );
    for (let index = 0; index < 8; index += 1) {
      expect(css).toMatch(
        new RegExp(
          `\\.rr-match-result-rooster-frame-${index}[\\s\\S]*animation: rr-match-result-rooster-frame-${index} 1400ms linear both;`,
        ),
      );
    }
    expect(css).toMatch(
      /\.rr-match-result-stage \.rr-match-result-choice-card--rejected-hidden[\s\S]*visibility: hidden;[\s\S]*pointer-events: none;/,
    );
  });

  it('keeps React reveal settling aligned to the restored 1400ms CSS cadence', async () => {
    vi.useFakeTimers();

    const mountedStep = await mount(
      createElement(MatchResultHarness, {
        motionEnabled: true,
        onChoice: vi.fn(),
      }),
    );

    await click(radioByValue(mountedStep.container, 'team1'));

    expect(matchResultStage(mountedStep.container).dataset.motionPhase).toBe(
      'revealing',
    );
    expect(
      mountedStep.container.querySelector(
        '[data-testid="match-result-shove-layer"]',
      ),
    ).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1_399);
    });

    expect(matchResultStage(mountedStep.container).dataset.motionPhase).toBe(
      'revealing',
    );
    expect(
      mountedStep.container.querySelector(
        '[data-testid="match-result-shove-layer"]',
      ),
    ).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(matchResultStage(mountedStep.container).dataset.motionPhase).toBe(
      'settled',
    );
    expect(
      mountedStep.container.querySelector(
        '[data-testid="match-result-shove-layer"]',
      ),
    ).toBeNull();
  });

  it('starts with the three-choice radio group when no answer exists', async () => {
    const mountedStep = await mount(
      createElement(MatchResultHarness, {
        motionEnabled: true,
        onChoice: vi.fn(),
      }),
    );

    expect(matchResultRadios(mountedStep.container)).toHaveLength(3);
    expect(radioByValue(mountedStep.container, 'team1').checked).toBe(false);
    expect(radioByValue(mountedStep.container, 'team2').checked).toBe(false);
    expect(radioByValue(mountedStep.container, 'draw').checked).toBe(false);
  });

  it('updates the shared action once, raises the selected answer, and settles to the hero', async () => {
    const choices: string[] = [];
    const mountedStep = await mount(
      createElement(MatchResultHarness, {
        motionEnabled: true,
        onChoice: (value) => choices.push(value),
      }),
    );

    await click(radioByValue(mountedStep.container, 'team1'));

    expect(choices).toEqual(['team1']);
    expect(matchResultStage(mountedStep.container).dataset.motionPhase).toBe(
      'revealing',
    );
    expect(matchResultRadios(mountedStep.container)).toHaveLength(3);
    expect(enabledMatchResultRadios(mountedStep.container)).toHaveLength(1);
    expect(radioByValue(mountedStep.container, 'team1').checked).toBe(true);
    expect(
      matchResultChoiceCard(mountedStep.container, 'team1').classList.contains(
        'rr-match-result-choice-card--selected-rise',
      ),
    ).toBe(true);
    expect(radioByValue(mountedStep.container, 'team1').disabled).toBe(false);

    const rejectedTeam2 = matchResultChoiceCard(mountedStep.container, 'team2');
    const rejectedDraw = matchResultChoiceCard(mountedStep.container, 'draw');

    expect(
      rejectedTeam2.classList.contains(
        'rr-match-result-choice-card--rejected-hidden',
      ),
    ).toBe(true);
    expect(rejectedTeam2.getAttribute('aria-hidden')).toBe('true');
    expect(radioByValue(mountedStep.container, 'team2').disabled).toBe(true);
    expect(
      rejectedDraw.classList.contains(
        'rr-match-result-choice-card--rejected-hidden',
      ),
    ).toBe(true);
    expect(rejectedDraw.getAttribute('aria-hidden')).toBe('true');
    expect(radioByValue(mountedStep.container, 'draw').disabled).toBe(true);
    expect(
      buttonByText(mountedStep.container, 'Change my selection').tagName,
    ).toBe('BUTTON');

    const shoveLayer = mountedStep.container.querySelector<HTMLElement>(
      '[data-testid="match-result-shove-layer"]',
    );

    expect(shoveLayer).not.toBeNull();
    expect(shoveLayer?.getAttribute('aria-hidden')).toBe('true');
    expect(
      shoveLayer?.querySelectorAll('.rr-match-result-shove-card'),
    ).toHaveLength(2);
    expect(shoveLayer?.querySelectorAll('button, input')).toHaveLength(0);

    if (shoveLayer) {
      await finishAnimation(shoveLayer);
    }

    expect(matchResultStage(mountedStep.container).dataset.motionPhase).toBe(
      'settled',
    );
    expect(matchResultRadios(mountedStep.container)).toHaveLength(1);
    expect(radioByValue(mountedStep.container, 'team1').checked).toBe(true);
    expect(queryRadioByValue(mountedStep.container, 'team2')).toBeNull();
    expect(queryRadioByValue(mountedStep.container, 'draw')).toBeNull();
    expect(
      mountedStep.container.querySelector(
        '[data-testid="match-result-selected-label"]',
      )?.textContent,
    ).toBe('YOU SELECTED:');
    expect(mountedStep.container.textContent).not.toContain('You picked');
    expect(
      buttonByText(mountedStep.container, 'Change my selection').tagName,
    ).toBe('BUTTON');
  });

  it('plays decorative shove only for a deliberate new animated choice', async () => {
    const choices: string[] = [];
    const mountedStep = await mount(
      createElement(MatchResultHarness, {
        initialValue: 'team1',
        motionEnabled: true,
        onChoice: (value) => choices.push(value),
      }),
    );

    expect(
      mountedStep.container.querySelector(
        '[data-testid="match-result-shove-layer"]',
      ),
    ).toBeNull();

    await click(buttonByText(mountedStep.container, 'Change my selection'));
    await click(radioByValue(mountedStep.container, 'team2'));

    expect(choices).toEqual(['team2']);
    expect(radioByValue(mountedStep.container, 'team2').checked).toBe(true);
    expect(matchResultStage(mountedStep.container).dataset.motionPhase).toBe(
      'revealing',
    );
    expect(matchResultRadios(mountedStep.container)).toHaveLength(3);
    expect(enabledMatchResultRadios(mountedStep.container)).toHaveLength(1);
    expect(radioByValue(mountedStep.container, 'team1').disabled).toBe(true);
    expect(
      mountedStep.container.querySelector(
        '[data-testid="match-result-shove-layer"]',
      ),
    ).not.toBeNull();
  });

  it('Change restores choices without changing the answer, then a new choice updates correctly', async () => {
    const choices: string[] = [];
    const mountedStep = await mount(
      createElement(MatchResultHarness, {
        initialValue: 'team1',
        motionEnabled: true,
        onChoice: (value) => choices.push(value),
      }),
    );

    await click(buttonByText(mountedStep.container, 'Change my selection'));

    expect(choices).toEqual([]);
    expect(matchResultRadios(mountedStep.container)).toHaveLength(3);
    expect(enabledMatchResultRadios(mountedStep.container)).toHaveLength(3);
    expect(radioByValue(mountedStep.container, 'team1').checked).toBe(true);
    expect(document.activeElement).toBe(
      radioByValue(mountedStep.container, 'team1'),
    );

    await click(radioByValue(mountedStep.container, 'draw'));

    expect(choices).toEqual(['draw']);
    expect(radioByValue(mountedStep.container, 'draw').checked).toBe(true);

    const shoveLayer = mountedStep.container.querySelector<HTMLElement>(
      '[data-testid="match-result-shove-layer"]',
    );

    expect(shoveLayer).not.toBeNull();

    if (shoveLayer) {
      await finishAnimation(shoveLayer);
    }

    expect(matchResultRadios(mountedStep.container)).toHaveLength(1);
    expect(radioByValue(mountedStep.container, 'draw').checked).toBe(true);
    expect(mountedStep.container.textContent).toContain('YOU SELECTED:');
  });

  it('reselecting the current answer returns to settled without duplicate updates', async () => {
    const choices: string[] = [];
    const mountedStep = await mount(
      createElement(MatchResultHarness, {
        initialValue: 'team2',
        motionEnabled: true,
        onChoice: (value) => choices.push(value),
      }),
    );

    await click(buttonByText(mountedStep.container, 'Change my selection'));
    await click(radioByValue(mountedStep.container, 'team2'));

    expect(choices).toEqual([]);
    expect(matchResultRadios(mountedStep.container)).toHaveLength(1);
    expect(radioByValue(mountedStep.container, 'team2').checked).toBe(true);
    expect(
      mountedStep.container.querySelector(
        '[data-testid="match-result-shove-layer"]',
      ),
    ).toBeNull();
  });

  it('initializes a saved selection as settled without replaying animation', async () => {
    const mountedStep = await mount(
      createElement(MatchResultHarness, {
        initialValue: 'team2',
        motionEnabled: true,
        onChoice: vi.fn(),
      }),
    );

    expect(matchResultRadios(mountedStep.container)).toHaveLength(1);
    expect(radioByValue(mountedStep.container, 'team2').checked).toBe(true);
    expect(
      mountedStep.container.querySelector(
        '[data-testid="match-result-selected-label"]',
      )?.textContent,
    ).toBe('YOU SELECTED:');
    expect(mountedStep.container.textContent).toContain('All Blacks');
    expect(
      mountedStep.container.querySelector('.rr-match-result-hero-card'),
    ).not.toBeNull();
    expect(
      mountedStep.container.querySelector(
        '.rr-match-result-hero--settle-motion',
      ),
    ).toBeNull();
    expect(
      mountedStep.container.querySelector(
        '[data-testid="match-result-shove-layer"]',
      ),
    ).toBeNull();
  });

  it('keeps the same choose, settled, and Change behavior when animations are Off', async () => {
    const choices: string[] = [];
    const mountedStep = await mount(
      createElement(MatchResultHarness, {
        motionEnabled: false,
        onChoice: (value) => choices.push(value),
      }),
    );

    await click(radioByValue(mountedStep.container, 'team1'));

    expect(choices).toEqual(['team1']);
    expect(matchResultRadios(mountedStep.container)).toHaveLength(1);
    expect(
      mountedStep.container.querySelector(
        '[data-testid="match-result-shove-layer"]',
      ),
    ).toBeNull();
    expect(radioByValue(mountedStep.container, 'team1').checked).toBe(true);
    expect(mountedStep.container.textContent).toContain('YOU SELECTED:');

    await click(buttonByText(mountedStep.container, 'Change my selection'));

    expect(choices).toEqual(['team1']);
    expect(matchResultRadios(mountedStep.container)).toHaveLength(3);
    expect(radioByValue(mountedStep.container, 'team1').checked).toBe(true);
  });

  it('keeps the same functional flow when reduced motion suppresses animation', async () => {
    replaceMatchMedia(true);

    const choices: string[] = [];
    const mountedStep = await mount(
      createElement(MatchResultHostHarness, {
        onChoice: (value) => choices.push(value),
      }),
    );

    await click(radioByValue(mountedStep.container, 'team1'));

    expect(choices).toEqual(['team1']);
    expect(matchResultRadios(mountedStep.container)).toHaveLength(1);
    expect(
      mountedStep.container.querySelector(
        '[data-testid="match-result-shove-layer"]',
      ),
    ).toBeNull();
    expect(radioByValue(mountedStep.container, 'team1').checked).toBe(true);
    expect(mountedStep.container.textContent).toContain('YOU SELECTED:');

    await click(buttonByText(mountedStep.container, 'Change my selection'));

    expect(choices).toEqual(['team1']);
    expect(matchResultRadios(mountedStep.container)).toHaveLength(3);
    expect(radioByValue(mountedStep.container, 'team1').checked).toBe(true);
  });

  it('cancels obsolete shove effects on resize and leaves a valid settled answer', async () => {
    const mountedStep = await mount(
      createElement(MatchResultHarness, {
        motionEnabled: true,
        onChoice: vi.fn(),
      }),
    );

    await click(radioByValue(mountedStep.container, 'team1'));
    expect(
      mountedStep.container.querySelector(
        '[data-testid="match-result-shove-layer"]',
      ),
    ).not.toBeNull();

    await act(async () => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(
      mountedStep.container.querySelector(
        '[data-testid="match-result-shove-layer"]',
      ),
    ).toBeNull();
    expect(radioByValue(mountedStep.container, 'team1').checked).toBe(true);
    expect(matchResultRadios(mountedStep.container)).toHaveLength(1);
    expect(
      mountedStep.container.querySelector(
        '.rr-match-result-choice-card--rejected-hidden',
      ),
    ).toBeNull();
  });

  it('Change during an active shove removes the decoration and restores choices', async () => {
    const choices: string[] = [];
    const mountedStep = await mount(
      createElement(MatchResultHarness, {
        motionEnabled: true,
        onChoice: (value) => choices.push(value),
      }),
    );

    await click(radioByValue(mountedStep.container, 'team1'));
    expect(
      mountedStep.container.querySelector(
        '[data-testid="match-result-shove-layer"]',
      ),
    ).not.toBeNull();

    await click(buttonByText(mountedStep.container, 'Change my selection'));

    expect(choices).toEqual(['team1']);
    expect(
      mountedStep.container.querySelector(
        '[data-testid="match-result-shove-layer"]',
      ),
    ).toBeNull();
    expect(matchResultRadios(mountedStep.container)).toHaveLength(3);
    expect(enabledMatchResultRadios(mountedStep.container)).toHaveLength(3);
    expect(radioByValue(mountedStep.container, 'team1').checked).toBe(true);
    expect(
      mountedStep.container.querySelector(
        '.rr-match-result-choice-card--rejected-hidden',
      ),
    ).toBeNull();
  });

  it('treats sprite load failure as harmless presentation cancellation', async () => {
    const choices: string[] = [];
    const mountedStep = await mount(
      createElement(MatchResultHarness, {
        motionEnabled: true,
        onChoice: (value) => choices.push(value),
      }),
    );

    await click(radioByValue(mountedStep.container, 'team1'));
    const frame = mountedStep.container.querySelector<HTMLImageElement>(
      '[data-testid="match-result-shove-layer"] img',
    );

    expect(frame).not.toBeNull();

    await act(async () => {
      frame?.dispatchEvent(new Event('error', { bubbles: true }));
    });

    expect(
      mountedStep.container.querySelector(
        '[data-testid="match-result-shove-layer"]',
      ),
    ).toBeNull();
    expect(radioByValue(mountedStep.container, 'team1').checked).toBe(true);

    await click(buttonByText(mountedStep.container, 'Change my selection'));
    await click(radioByValue(mountedStep.container, 'draw'));
    expect(choices).toEqual(['team1', 'draw']);
    expect(radioByValue(mountedStep.container, 'draw').checked).toBe(true);
  });

  it('settles safely when the shove animation completes normally', async () => {
    const mountedStep = await mount(
      createElement(MatchResultHarness, {
        motionEnabled: true,
        onChoice: vi.fn(),
      }),
    );

    await click(radioByValue(mountedStep.container, 'team1'));
    const shoveLayer = mountedStep.container.querySelector<HTMLElement>(
      '[data-testid="match-result-shove-layer"]',
    );

    expect(shoveLayer).not.toBeNull();

    if (shoveLayer) {
      await finishAnimation(shoveLayer);
    }

    expect(
      mountedStep.container.querySelector(
        '[data-testid="match-result-shove-layer"]',
      ),
    ).toBeNull();
    expect(matchResultRadios(mountedStep.container)).toHaveLength(1);
    expect(radioByValue(mountedStep.container, 'team1').checked).toBe(true);
    expect(
      buttonByText(mountedStep.container, 'Change my selection').tagName,
    ).toBe('BUTTON');
  });
});

describe('Tries React presentation', () => {
  it('uses the same shared numeric action for increment, decrement and typed input', async () => {
    const calls: Array<{ side: TeamSide; value: string }> = [];
    const mountedStep = await mount(
      createElement(TriesHarness, {
        motionEnabled: false,
        onTeamChange: (side, value) => calls.push({ side, value }),
      }),
    );

    await click(buttonByText(mountedStep.container, '+'));
    await click(
      mountedStep.container.querySelector<HTMLElement>(
        '[data-testid="tries-team1-decrement"]',
      ) ?? mountedStep.container,
    );
    await changeInput(
      inputByTestId(mountedStep.container, 'tries-team2-input'),
      '4',
    );

    expect(calls).toEqual([
      { side: 'team1', value: '4' },
      { side: 'team1', value: '3' },
      { side: 'team2', value: '4' },
    ]);
  });

  it('preserves blank editing, prevents decrement below zero, and delegates conversion clamping', async () => {
    const snapshots: PredictionFormState[] = [];
    const mountedStep = await mount(
      createElement(TriesHarness, {
        motionEnabled: false,
        onTeamChange: (_side, _value, form) => snapshots.push(form),
      }),
    );
    const team1Input = inputByTestId(
      mountedStep.container,
      'tries-team1-input',
    );

    await changeInput(team1Input, '');
    expect(team1Input.value).toBe('');

    await click(
      mountedStep.container.querySelector<HTMLElement>(
        '[data-testid="tries-team2-decrement"]',
      ) ?? mountedStep.container,
    );
    expect(
      inputByTestId(mountedStep.container, 'tries-team2-input').value,
    ).toBe('0');

    await changeInput(team1Input, '1');

    expect(snapshots.at(-1)?.team1.conversions).toBe('1');
    expect(
      mountedStep.container.querySelector('[data-testid="team1-conversions"]')
        ?.textContent,
    ).toBe('1');
  });

  it('does not duplicate domain updates during rapid numeric changes', async () => {
    const calls: string[] = [];
    const mountedStep = await mount(
      createElement(TriesHarness, {
        motionEnabled: true,
        onTeamChange: (_side, value) => calls.push(value),
      }),
    );
    const increment = mountedStep.container.querySelector<HTMLElement>(
      '[data-testid="tries-team2-increment"]',
    );

    if (!increment) {
      throw new Error('Team 2 increment not found.');
    }

    await click(increment);
    await click(increment);
    await click(increment);

    expect(calls).toEqual(['1', '2', '3']);
  });
});

describe('React numeric scoring presentation family', () => {
  it('shares increment, decrement, direct edit, blank, zero, and accessible labels', async () => {
    const calls: Array<{
      field: NumericHarnessField;
      side: TeamSide;
      value: string;
    }> = [];
    const prefix = numericStepPrefix('penaltyKicks');
    const mountedStep = await mount(
      createElement(NumericStepHarness, {
        field: 'penaltyKicks',
        initialForm: {
          team1: { penaltyKicks: '1' },
        },
        motionEnabled: false,
        onTeamChange: (side, field, value) =>
          calls.push({ field, side, value }),
      }),
    );

    expect(
      inputByTestId(
        mountedStep.container,
        `${prefix}-team1-input`,
      ).getAttribute('aria-label'),
    ).toBe('Springboks penalty kicks');
    expect(
      buttonByTestId(
        mountedStep.container,
        `${prefix}-team1-increment`,
      ).getAttribute('aria-label'),
    ).toBe('Increase Springboks penalty kicks');
    expect(
      buttonByTestId(
        mountedStep.container,
        `${prefix}-team1-decrement`,
      ).getAttribute('aria-label'),
    ).toBe('Decrease Springboks penalty kicks');

    await click(
      buttonByTestId(mountedStep.container, `${prefix}-team1-increment`),
    );
    await click(
      buttonByTestId(mountedStep.container, `${prefix}-team1-decrement`),
    );
    await changeInput(
      inputByTestId(mountedStep.container, `${prefix}-team2-input`),
      '4',
    );
    await changeInput(
      inputByTestId(mountedStep.container, `${prefix}-team2-input`),
      '',
    );

    expect(
      inputByTestId(mountedStep.container, `${prefix}-team2-input`).value,
    ).toBe('');
    expect(
      buttonByTestId(mountedStep.container, `${prefix}-team2-decrement`)
        .disabled,
    ).toBe(true);

    await changeInput(
      inputByTestId(mountedStep.container, `${prefix}-team2-input`),
      '0',
    );

    expect(
      buttonByTestId(mountedStep.container, `${prefix}-team2-decrement`)
        .disabled,
    ).toBe(true);
    expect(calls).toEqual([
      { field: 'penaltyKicks', side: 'team1', value: '2' },
      { field: 'penaltyKicks', side: 'team1', value: '1' },
      { field: 'penaltyKicks', side: 'team2', value: '4' },
      { field: 'penaltyKicks', side: 'team2', value: '' },
      { field: 'penaltyKicks', side: 'team2', value: '0' },
    ]);
  });

  it('keeps conversions bounded by predicted tries through the existing form helper', async () => {
    const snapshots: PredictionFormState[] = [];
    const mountedStep = await mount(
      createElement(NumericStepHarness, {
        field: 'conversions',
        initialForm: {
          team1: { conversions: '1', tries: '2' },
          team2: { conversions: '0', tries: '3' },
        },
        motionEnabled: false,
        onTeamChange: (_side, _field, _value, form) => snapshots.push(form),
      }),
    );
    const team1Input = inputByTestId(
      mountedStep.container,
      'conversions-team1-input',
    );
    const team2Input = inputByTestId(
      mountedStep.container,
      'conversions-team2-input',
    );

    expect(team1Input.getAttribute('max')).toBe('2');
    expect(
      mountedStep.container.textContent?.includes(
        "You predicted 2 tries - conversions can't exceed 2.",
      ),
    ).toBe(true);

    await click(
      buttonByTestId(mountedStep.container, 'conversions-team1-increment'),
    );

    expect(team1Input.value).toBe('2');
    expect(
      buttonByTestId(mountedStep.container, 'conversions-team1-increment')
        .disabled,
    ).toBe(false);
    expect(
      buttonByTestId(mountedStep.container, 'conversions-team1-increment')
        .dataset.limitReached,
    ).toBe('true');

    await changeInput(team1Input, '9');

    expect(team1Input.value).toBe('2');
    expect(snapshots.at(-1)?.team1.conversions).toBe('2');
    expect(snapshots.at(-1)?.team2.conversions).toBe('0');

    await changeInput(team2Input, '2');

    expect(team1Input.value).toBe('2');
    expect(team2Input.value).toBe('2');
    expect(snapshots.at(-1)?.team1.conversions).toBe('2');
    expect(snapshots.at(-1)?.team2.conversions).toBe('2');
  });

  it('updates penalty kicks for both teams and shows rule-derived deduction copy', async () => {
    const calls: Array<{
      field: NumericHarnessField;
      side: TeamSide;
      value: string;
    }> = [];
    const mountedStep = await mount(
      createElement(NumericStepHarness, {
        field: 'penaltyKicks',
        motionEnabled: false,
        onTeamChange: (side, field, value) =>
          calls.push({ field, side, value }),
        ruleset: rulesetWithNumericRate('penalty-kicks', 321),
      }),
    );

    expect(mountedStep.container.textContent).toContain('321');

    await click(
      buttonByTestId(mountedStep.container, 'penalty-kicks-team1-increment'),
    );
    await changeInput(
      inputByTestId(mountedStep.container, 'penalty-kicks-team2-input'),
      '3',
    );

    expect(calls).toEqual([
      { field: 'penaltyKicks', side: 'team1', value: '1' },
      { field: 'penaltyKicks', side: 'team2', value: '3' },
    ]);
    expect(
      inputByTestId(mountedStep.container, 'penalty-kicks-team1-input').value,
    ).toBe('1');
    expect(
      inputByTestId(mountedStep.container, 'penalty-kicks-team2-input').value,
    ).toBe('3');
  });

  it('updates drop goals for both teams and shows rule-derived deduction copy', async () => {
    const calls: Array<{
      field: NumericHarnessField;
      side: TeamSide;
      value: string;
    }> = [];
    const mountedStep = await mount(
      createElement(NumericStepHarness, {
        field: 'dropGoals',
        motionEnabled: false,
        onTeamChange: (side, field, value) =>
          calls.push({ field, side, value }),
        ruleset: rulesetWithNumericRate('drop-goals', 654),
      }),
    );

    expect(mountedStep.container.textContent).toContain('654');

    await click(
      buttonByTestId(mountedStep.container, 'drop-goals-team1-increment'),
    );
    await changeInput(
      inputByTestId(mountedStep.container, 'drop-goals-team2-input'),
      '2',
    );

    expect(calls).toEqual([
      { field: 'dropGoals', side: 'team1', value: '1' },
      { field: 'dropGoals', side: 'team2', value: '2' },
    ]);
    expect(
      inputByTestId(mountedStep.container, 'drop-goals-team1-input').value,
    ).toBe('1');
    expect(
      inputByTestId(mountedStep.container, 'drop-goals-team2-input').value,
    ).toBe('2');
    expect(
      mountedStep.container.querySelector(
        '[data-testid="drop-goals-team2-score"]',
      )?.textContent,
    ).toBe('6');
  });

  it('hides native number spinners while keeping numeric inputs', () => {
    const css = readFileSync('client/main.css', 'utf8');

    expect(css).toMatch(
      /\.rr-numeric-stepper-input[\s\S]*-moz-appearance: textfield;[\s\S]*appearance: textfield;/,
    );
    expect(css).toMatch(
      /\.rr-numeric-stepper-input::-webkit-inner-spin-button,\s*\.rr-numeric-stepper-input::-webkit-outer-spin-button[\s\S]*appearance: none;/,
    );
  });

  it('triggers visible Tries increase and decrement reactions with derived score feedback', async () => {
    const { animate, cancel } = replaceAnimate();
    const mountedStep = await mount(
      createElement(NumericStepHarness, {
        field: 'tries',
        initialForm: {
          team1: { tries: '0' },
        },
        motionEnabled: true,
      }),
    );

    await click(buttonByTestId(mountedStep.container, 'tries-team1-increment'));

    expect(
      inputByTestId(mountedStep.container, 'tries-team1-input').value,
    ).toBe('1');
    expect(
      elementByTestId(mountedStep.container, 'tries-team1-score').textContent,
    ).toBe('5');
    expect(
      elementByTestId(mountedStep.container, 'tries-team1-card').dataset
        .reactionDirection,
    ).toBe('increase');
    expect(
      elementByTestId(mountedStep.container, 'tries-team1-card').dataset
        .scoreReaction,
    ).toBe('true');
    expect(
      elementByTestId(mountedStep.container, 'tries-team1-reaction')
        .textContent,
    ).toBe('On the board.');
    expect(animate).toHaveBeenCalled();

    await click(buttonByTestId(mountedStep.container, 'tries-team1-decrement'));

    expect(
      inputByTestId(mountedStep.container, 'tries-team1-input').value,
    ).toBe('0');
    expect(
      elementByTestId(mountedStep.container, 'tries-team1-score').textContent,
    ).toBe('0');
    expect(
      elementByTestId(mountedStep.container, 'tries-team1-card').dataset
        .reactionDirection,
    ).toBe('decrease');
    expect(
      elementByTestId(mountedStep.container, 'tries-team1-reaction')
        .textContent,
    ).toBe('Try tally trimmed.');
    expect(cancel).toHaveBeenCalled();
  });

  it('coalesces rapid changes so the latest numeric reaction wins', async () => {
    vi.useFakeTimers();
    const { animate, cancel } = replaceAnimate();
    const calls: string[] = [];
    const mountedStep = await mount(
      createElement(NumericStepHarness, {
        field: 'dropGoals',
        motionEnabled: true,
        onTeamChange: (_side, _field, value) => calls.push(value),
      }),
    );
    const increment = buttonByTestId(
      mountedStep.container,
      'drop-goals-team1-increment',
    );

    await click(increment);
    await click(increment);
    await click(increment);

    expect(calls).toEqual(['1', '2', '3']);
    expect(
      inputByTestId(mountedStep.container, 'drop-goals-team1-input').value,
    ).toBe('3');
    expect(
      elementByTestId(mountedStep.container, 'drop-goals-team1-score')
        .textContent,
    ).toBe('9');
    expect(
      elementByTestId(mountedStep.container, 'drop-goals-team1-reaction')
        .textContent,
    ).toBe('Old school!');
    expect(animate.mock.calls.length).toBeGreaterThanOrEqual(9);
    expect(cancel.mock.calls.length).toBeGreaterThanOrEqual(6);

    await act(async () => {
      vi.advanceTimersByTime(419);
    });

    expect(
      elementByTestId(mountedStep.container, 'drop-goals-team1-card').dataset
        .reactionActive,
    ).toBe('true');

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(
      elementByTestId(mountedStep.container, 'drop-goals-team1-card').dataset
        .reactionActive,
    ).toBe('false');
  });

  it('shows accepted Conversions reactions and a nonblocking cap reaction', async () => {
    const { animate, cancel } = replaceAnimate();
    const mountedStep = await mount(
      createElement(NumericStepHarness, {
        field: 'conversions',
        initialForm: {
          team1: { conversions: '1', tries: '2' },
        },
        motionEnabled: true,
      }),
    );
    const increment = buttonByTestId(
      mountedStep.container,
      'conversions-team1-increment',
    );

    await click(increment);

    expect(
      inputByTestId(mountedStep.container, 'conversions-team1-input').value,
    ).toBe('2');
    expect(
      elementByTestId(mountedStep.container, 'conversions-team1-score')
        .textContent,
    ).toBe('14');
    expect(
      elementByTestId(mountedStep.container, 'conversions-team1-card').dataset
        .reactionKind,
    ).toBe('change');
    expect(
      elementByTestId(mountedStep.container, 'conversions-team1-reaction')
        .textContent,
    ).toBe('Kick is good.');
    expect(increment.dataset.limitReached).toBe('true');

    await click(increment);

    expect(
      inputByTestId(mountedStep.container, 'conversions-team1-input').value,
    ).toBe('2');
    expect(
      elementByTestId(mountedStep.container, 'conversions-team1-card').dataset
        .reactionKind,
    ).toBe('limit');
    expect(
      elementByTestId(mountedStep.container, 'conversions-team1-helper').dataset
        .limitReaction,
    ).toBe('true');
    expect(
      elementByTestId(mountedStep.container, 'conversions-team1-reaction')
        .textContent,
    ).toBe('At the try cap.');
    expect(animate).toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
  });

  it('keeps Animations Off functionally capped without motion state', async () => {
    const { animate } = replaceAnimate();
    const mountedStep = await mount(
      createElement(NumericStepHarness, {
        field: 'conversions',
        initialForm: {
          team1: { conversions: '2', tries: '2' },
        },
        motionEnabled: false,
      }),
    );

    await click(
      buttonByTestId(mountedStep.container, 'conversions-team1-increment'),
    );

    expect(
      inputByTestId(mountedStep.container, 'conversions-team1-input').value,
    ).toBe('2');
    expect(
      elementByTestId(mountedStep.container, 'conversions-team1-card').dataset
        .reactionActive,
    ).toBe('false');
    expect(
      elementByTestId(mountedStep.container, 'conversions-team1-reaction')
        .textContent,
    ).toBe('');
    expect(animate).not.toHaveBeenCalled();
  });

  it('triggers Penalty Kick value and score reactions', async () => {
    replaceAnimate();
    const mountedStep = await mount(
      createElement(NumericStepHarness, {
        field: 'penaltyKicks',
        motionEnabled: true,
      }),
    );

    await click(
      buttonByTestId(mountedStep.container, 'penalty-kicks-team1-increment'),
    );

    expect(
      inputByTestId(mountedStep.container, 'penalty-kicks-team1-input').value,
    ).toBe('1');
    expect(
      elementByTestId(mountedStep.container, 'penalty-kicks-team1-score')
        .textContent,
    ).toBe('3');
    expect(
      elementByTestId(mountedStep.container, 'penalty-kicks-team1-card').dataset
        .scoreReaction,
    ).toBe('true');
    expect(
      elementByTestId(mountedStep.container, 'penalty-kicks-team1-reaction')
        .textContent,
    ).toBe('Posts in range.');
  });

  it('triggers Drop Goal value and score reactions without adding warning copy', async () => {
    replaceAnimate();
    const mountedStep = await mount(
      createElement(NumericStepHarness, {
        field: 'dropGoals',
        motionEnabled: true,
      }),
    );

    await click(
      buttonByTestId(mountedStep.container, 'drop-goals-team1-increment'),
    );

    expect(
      inputByTestId(mountedStep.container, 'drop-goals-team1-input').value,
    ).toBe('1');
    expect(
      elementByTestId(mountedStep.container, 'drop-goals-team1-score')
        .textContent,
    ).toBe('3');
    expect(
      elementByTestId(mountedStep.container, 'drop-goals-team1-card').dataset
        .scoreReaction,
    ).toBe('true');
    expect(
      elementByTestId(mountedStep.container, 'drop-goals-team1-reaction')
        .textContent,
    ).toBe('A drop goal?');
    expect(mountedStep.container.textContent).not.toContain(
      "YOUR SCORES DON'T MATCH YOUR CHOSEN WINNER",
    );
  });

  it('triggers reaction state from valid direct typing', async () => {
    replaceAnimate();
    const mountedStep = await mount(
      createElement(NumericStepHarness, {
        field: 'penaltyKicks',
        motionEnabled: true,
      }),
    );

    await changeInput(
      inputByTestId(mountedStep.container, 'penalty-kicks-team2-input'),
      '2',
    );

    expect(
      inputByTestId(mountedStep.container, 'penalty-kicks-team2-input').value,
    ).toBe('2');
    expect(
      elementByTestId(mountedStep.container, 'penalty-kicks-team2-score')
        .textContent,
    ).toBe('6');
    expect(
      elementByTestId(mountedStep.container, 'penalty-kicks-team2-card').dataset
        .reactionActive,
    ).toBe('true');
    expect(
      elementByTestId(mountedStep.container, 'penalty-kicks-team2-card').dataset
        .scoreReaction,
    ).toBe('true');
  });

  it('cleans numeric reaction timers and animations on unmount', async () => {
    vi.useFakeTimers();
    const { cancel } = replaceAnimate();
    const mountedStep = await mount(
      createElement(NumericStepHarness, {
        field: 'penaltyKicks',
        motionEnabled: true,
      }),
    );

    await click(
      buttonByTestId(mountedStep.container, 'penalty-kicks-team1-increment'),
    );

    expect(
      elementByTestId(mountedStep.container, 'penalty-kicks-team1-card').dataset
        .reactionActive,
    ).toBe('true');

    mounted.pop();
    await mountedStep.unmount();

    expect(cancel).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps reduced-motion numeric input functional without running movement', async () => {
    replaceMatchMedia(true);
    const { animate } = replaceAnimate();
    const calls: string[] = [];
    const mountedStep = await mount(
      createElement(PredictionPresentationHost, {
        renderExperience: (presentation) =>
          createElement(NumericStepHarness, {
            field: 'penaltyKicks',
            motionEnabled: presentation.animationsEnabled,
            onTeamChange: (_side, _field, value) => calls.push(value),
          }),
      }),
    );

    await click(
      buttonByTestId(mountedStep.container, 'penalty-kicks-team1-increment'),
    );

    expect(calls).toEqual(['1']);
    expect(animate).not.toHaveBeenCalled();
    expect(
      inputByTestId(mountedStep.container, 'penalty-kicks-team1-input').value,
    ).toBe('1');
    expect(
      elementByTestId(mountedStep.container, 'penalty-kicks-team1-card').dataset
        .reactionActive,
    ).toBe('false');
  });
});
