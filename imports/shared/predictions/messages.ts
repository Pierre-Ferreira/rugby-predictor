import {
  STARTING_POINTS,
  questionById,
  type BuiltInQuestionId,
  type RulesetSnapshot,
  type TeamNumericBuiltInQuestionId,
} from '/imports/shared/scoring';
import type { PredictionStepId } from './sequence';

export type PredictionMessageId = PredictionStepId;

export interface PredictionMessageContext {
  readonly ruleset: RulesetSnapshot;
  readonly team1Name: string;
  readonly team2Name: string;
}

type MessageTemplate =
  string | ((context: PredictionMessageContext) => string | null);

interface PredictionMessageVariant {
  readonly body?: MessageTemplate;
  readonly heading: MessageTemplate;
}

interface PredictionMessageDefinition {
  readonly deduction?: MessageTemplate;
  readonly supportingText?: readonly MessageTemplate[];
  readonly variants: readonly PredictionMessageVariant[];
}

export interface ResolvedPredictionStepMessage {
  readonly body: string | null;
  readonly deduction: string | null;
  readonly heading: string;
  readonly supportingText: readonly string[];
}

export type PredictionMessageVariantSelection = Partial<
  Record<PredictionMessageId, number>
>;

export const formatPredictionPoints = (value: number): string =>
  value.toLocaleString('en-US');

const question = (ruleset: RulesetSnapshot, id: BuiltInQuestionId) =>
  questionById(ruleset).get(id);

export const teamNumericDeductionRate = (
  ruleset: RulesetSnapshot,
  id: TeamNumericBuiltInQuestionId,
): number | null => {
  const definition = question(ruleset, id);

  return definition?.type === 'built-in-team-numeric' ? definition.rate : null;
};

export const categoricalIncorrectDeduction = (
  ruleset: RulesetSnapshot,
  id: BuiltInQuestionId,
): number | null => {
  const definition = question(ruleset, id);

  return definition?.type === 'built-in-categorical'
    ? definition.incorrectDeduction
    : null;
};

const numericDeductionText =
  (id: TeamNumericBuiltInQuestionId, noun: string): MessageTemplate =>
  ({ ruleset }) => {
    const rate = teamNumericDeductionRate(ruleset, id);

    if (rate === null) {
      return null;
    }

    return `You lose ${formatPredictionPoints(rate)} points for every ${noun} your prediction is above or below each team's actual total.`;
  };

const categoricalDeductionText =
  (id: BuiltInQuestionId, text: (points: string) => string): MessageTemplate =>
  ({ ruleset }) => {
    const deduction = categoricalIncorrectDeduction(ruleset, id);

    return deduction === null ? null : text(formatPredictionPoints(deduction));
  };

const tryExample: MessageTemplate = ({ ruleset }) => {
  const rate = teamNumericDeductionRate(ruleset, 'tries');

  return rate === null
    ? null
    : `Predict 4 tries and they score 2? You lose ${formatPredictionPoints(
        2 * rate,
      )} points.`;
};

const cardDeduction: MessageTemplate = ({ ruleset }) => {
  const yellowRate = teamNumericDeductionRate(ruleset, 'yellow-cards');
  const redRate = teamNumericDeductionRate(ruleset, 'red-cards');

  if (yellowRate !== null && redRate !== null && yellowRate === redRate) {
    return `You lose ${formatPredictionPoints(yellowRate)} points for every card your prediction is above or below each team's actual total.`;
  }

  if (yellowRate !== null && redRate !== null) {
    return `Yellow cards deduct ${formatPredictionPoints(yellowRate)} points per difference. Red cards deduct ${formatPredictionPoints(redRate)} points per difference.`;
  }

  if (yellowRate !== null) {
    return `Yellow cards deduct ${formatPredictionPoints(yellowRate)} points per difference.`;
  }

  if (redRate !== null) {
    return `Red cards deduct ${formatPredictionPoints(redRate)} points per difference.`;
  }

  return null;
};

const cardExample: MessageTemplate = ({ ruleset }) => {
  const yellowRate = teamNumericDeductionRate(ruleset, 'yellow-cards');
  const redRate = teamNumericDeductionRate(ruleset, 'red-cards');
  const exampleRate = yellowRate ?? redRate;

  return exampleRate === null
    ? null
    : `Predict 0 and they receive 1? You lose ${formatPredictionPoints(
        exampleRate,
      )} points.`;
};

const teamScoreDeduction: MessageTemplate = ({ ruleset }) => {
  const rate = teamNumericDeductionRate(ruleset, 'team-score');

  return rate === null
    ? null
    : `You lose ${formatPredictionPoints(rate)} points for every point your prediction is above or below each team's final score. This is added to your other prediction deductions.`;
};

export const predictionIntroMessage = {
  actionLabel: "Let's predict",
  body: "You start with 10,000 points and lose points for incorrect predictions. Whoever has the most points at the end of the match wins. It's that easy!",
  heading: 'Welcome to Rugby Rooster! 🐓',
  scoreDistinction:
    'Predicted rugby match scores are derived from tries, conversions, penalty kicks and drop goals. Rugby Rooster competition points start at 10,000 and go down only when prediction errors cause deductions.',
  startingPoints: STARTING_POINTS,
} as const;

export const predictionMessageCatalog: Record<
  PredictionMessageId,
  PredictionMessageDefinition
> = {
  'match-result': {
    deduction: categoricalDeductionText(
      'match-result',
      (points) =>
        `Get the result wrong and lose ${points} points—half your starting score. Pick carefully!`,
    ),
    supportingText: [
      ({ team1Name, team2Name }) =>
        `Choices: ${team1Name}, ${team2Name}, or Draw.`,
    ],
    variants: [
      {
        heading: 'WHO DO YOU THINK WILL WIN?',
      },
      {
        body: "Who's taking this one?",
        heading: 'CALL IT!',
      },
      {
        body: 'Who gets the result?',
        heading: 'TIME TO PICK A SIDE!',
      },
    ],
  },
  tries: {
    deduction: numericDeductionText('tries', 'try'),
    supportingText: [tryExample],
    variants: [
      {
        body: 'Start by predicting how many tries each team will score.',
        heading: "LET'S BUILD YOUR SCORE PREDICTION",
      },
      {
        body: 'How often will each team cross the whitewash?',
        heading: 'TRY TIME!',
      },
      {
        body: "Pick each team's try tally.",
        heading: 'WHERE ARE THE TRIES COMING FROM?',
      },
    ],
  },
  conversions: {
    deduction: numericDeductionText('conversions', 'conversion'),
    variants: [
      {
        body: 'How good is your kicker going to be today?',
        heading: 'HOW MANY OF THESE TRIES WILL BE CONVERTED?',
      },
      {
        body: 'How many conversions will each team land?',
        heading: 'STRAIGHT THROUGH THE POSTS?',
      },
      {
        body: 'How many tries become seven-pointers?',
        heading: 'KICKERS, DO YOUR THING!',
      },
    ],
  },
  'penalty-kicks': {
    deduction: numericDeductionText('penalty-kicks', 'successful penalty kick'),
    variants: [
      {
        body: 'The pressure is on!',
        heading: 'HOW MANY SUCCESSFUL PENALTY KICKS?',
      },
      {
        body: 'How many penalties will each team kick over?',
        heading: 'TAKE THE THREE?',
      },
      {
        body: 'How many successful penalty kicks are coming?',
        heading: 'POINTS OFF THE TEE!',
      },
    ],
  },
  'drop-goals': {
    deduction: numericDeductionText('drop-goals', 'drop goal'),
    supportingText: ['YOUR FINAL SCORES COUNT TOO!', teamScoreDeduction],
    variants: [
      {
        body: 'Is there a hero on the park tonight?',
        heading: 'HOW MANY DROP GOALS?',
      },
      {
        body: 'How many three-pointers come from open play?',
        heading: 'DROP GOAL DRAMA?',
      },
      {
        body: "Predict each team's drop-goal tally.",
        heading: 'SOMEONE FANCY THE POCKET?',
      },
    ],
  },
  cards: {
    deduction: cardDeduction,
    supportingText: [cardExample],
    variants: [
      {
        body: 'How many yellow and red cards are coming?',
        heading: 'NAUGHTY, NAUGHTY!',
      },
      {
        body: "How busy will the ref's pocket be?",
        heading: 'KEEP IT CLEAN!',
      },
      {
        body: 'How many yellows and reds for each team?',
        heading: 'CARDS ON THE TABLE!',
      },
    ],
  },
  'first-try': {
    deduction: categoricalDeductionText(
      'first-try',
      (points) => `Get this prediction wrong and lose ${points} points!`,
    ),
    variants: [
      {
        body: "Who's more revved up, ya think?!",
        heading: 'WHO WILL SCORE THE FIRST TRY?',
      },
      {
        body: 'Pick the team scoring the opening try.',
        heading: 'WHO STRIKES FIRST?',
      },
      {
        body: "Who's crossing the line first?",
        heading: 'FIRST BLOOD!',
      },
    ],
  },
  'highest-scoring-half': {
    deduction: categoricalDeductionText(
      'highest-scoring-half',
      (points) => `Get this prediction wrong and lose ${points} points!`,
    ),
    variants: [
      {
        body: 'First, second, or level?',
        heading: 'WHICH HALF SCORES MORE?',
      },
      {
        body: 'Which half produces the most?',
        heading: 'WHEN DO THE POINTS FLOW?',
      },
      {
        body: 'Pick where most of the points will come.',
        heading: 'BIGGEST HALF?',
      },
    ],
  },
  'half-time-leader': {
    deduction: categoricalDeductionText(
      'half-time-leader',
      (points) => `Get this prediction wrong and lose ${points} points!`,
    ),
    variants: [
      {
        body: 'Who will lead at half-time?',
        heading: 'FAST START!',
      },
      {
        body: "Who'll be ahead at the break?",
        heading: 'HIT THE GROUND RUNNING!',
      },
      {
        body: 'Who takes the lead into half-time?',
        heading: 'FIRST-HALF BRAGGING RIGHTS!',
      },
    ],
  },
};

const resolveTemplate = (
  template: MessageTemplate | undefined,
  context: PredictionMessageContext,
): string | null => {
  if (template === undefined) {
    return null;
  }

  const resolved =
    typeof template === 'function' ? template(context) : template;

  return resolved && resolved.trim().length > 0 ? resolved : null;
};

export const selectPredictionMessageVariants = (
  messageIds: readonly PredictionMessageId[],
  random: () => number = Math.random,
): PredictionMessageVariantSelection =>
  Object.fromEntries(
    messageIds.map((messageId) => {
      const variantCount = predictionMessageCatalog[messageId].variants.length;

      return [
        messageId,
        Math.min(Math.floor(random() * variantCount), variantCount - 1),
      ];
    }),
  );

export const resolvePredictionStepMessage = (
  messageId: PredictionMessageId,
  selection: PredictionMessageVariantSelection,
  context: PredictionMessageContext,
): ResolvedPredictionStepMessage => {
  const definition = predictionMessageCatalog[messageId];
  const variantIndex = selection[messageId] ?? 0;
  const variant =
    definition.variants[variantIndex % definition.variants.length] ??
    definition.variants[0];

  return {
    body: resolveTemplate(variant.body, context),
    deduction: resolveTemplate(definition.deduction, context),
    heading: resolveTemplate(variant.heading, context) ?? '',
    supportingText:
      definition.supportingText
        ?.map((template) => resolveTemplate(template, context))
        .filter((text): text is string => text !== null) ?? [],
  };
};
