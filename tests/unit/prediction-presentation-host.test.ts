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
import type { RulesetSnapshot, TeamSide } from '../../imports/shared/scoring';
import { defaultRuleset } from '../../imports/shared/scoring';
import {
  PredictionPresentationHost,
  type PredictionPresentationOptions,
} from '../../imports/ui/predictions/PredictionPresentationHost';
import {
  MatchResultPredictionStep,
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
const restoreMatchMediaDescriptors: Array<() => void> = [];

afterEach(async () => {
  vi.useRealTimers();
  window.localStorage.clear();

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

    expect(css).toMatch(
      /@keyframes rr-match-result-selected-rise[\s\S]*translateY\(-1\.5rem\) scale\(1\.06\)/,
    );
    expect(css).toMatch(
      /@keyframes rr-match-result-selected-rise-compact[\s\S]*translateY\(-1\.125rem\) scale\(1\.045\)/,
    );
    expect(css).toMatch(
      /\.rr-match-result-stage \.rr-match-result-choice-card--rejected-hidden[\s\S]*visibility: hidden;[\s\S]*pointer-events: none;/,
    );
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
