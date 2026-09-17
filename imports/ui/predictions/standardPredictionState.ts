import type { FixtureDocument } from '/imports/shared/fixtures';
import { activeCustomQuestions } from '/imports/shared/predictions/sequence';
import {
  deriveMatchResult,
  deriveTeamScore,
  isBuiltInEnabled,
  ScoringValidationError,
  type FirstTryAnswer,
  type FixturePrediction,
  type MatchResult,
  type QuestionDefinition,
  type RulesetSnapshot,
  type TeamPrediction,
  type TeamSide,
} from '/imports/shared/scoring';

export interface TeamPredictionForm {
  readonly conversions: string;
  readonly dropGoals: string;
  readonly penaltyKicks: string;
  readonly redCards: string;
  readonly tries: string;
  readonly yellowCards: string;
}

export interface PredictionFormState {
  readonly customAnswers: Record<string, string>;
  readonly firstTry: string;
  readonly halfTimeLeader: string;
  readonly highestScoringHalf: string;
  readonly matchResult: string;
  readonly team1: TeamPredictionForm;
  readonly team2: TeamPredictionForm;
}

export interface TeamScoreReview {
  readonly message: string | null;
  readonly score: number | null;
}

export interface ScoreReview {
  readonly matchResult: MatchResult | null;
  readonly resultMessage: string | null;
  readonly team1: TeamScoreReview;
  readonly team2: TeamScoreReview;
}

export interface ResultConsistencyIssue {
  readonly body: string;
  readonly derivedResult: MatchResult;
  readonly heading: string;
  readonly selectedResult: MatchResult;
}

export interface FirstTryConstraint {
  readonly allowedAnswers: readonly FirstTryAnswer[];
  readonly forcedAnswer: FirstTryAnswer | null;
  readonly message: string | null;
}

const emptyTeamForm = (): TeamPredictionForm => ({
  conversions: '0',
  dropGoals: '0',
  penaltyKicks: '0',
  redCards: '0',
  tries: '0',
  yellowCards: '0',
});

export type ActiveCustomQuestion = Extract<
  QuestionDefinition,
  { readonly type: 'custom-categorical' | 'custom-numeric' }
>;

export const emptyFormForRuleset = (
  ruleset: RulesetSnapshot,
): PredictionFormState => ({
  customAnswers: Object.fromEntries(
    activeCustomQuestions(ruleset).map((question) => [question.id, '']),
  ),
  firstTry: '',
  halfTimeLeader: '',
  highestScoringHalf: '',
  matchResult: '',
  team1: emptyTeamForm(),
  team2: emptyTeamForm(),
});

const stringFromNumber = (value: number | undefined): string =>
  value === undefined ? '0' : String(value);

export const formFromPrediction = (
  prediction: FixturePrediction,
  ruleset: RulesetSnapshot,
): PredictionFormState => ({
  customAnswers: Object.fromEntries(
    activeCustomQuestions(ruleset).map((question) => [
      question.id,
      prediction.customAnswers?.[question.id] === undefined
        ? ''
        : String(prediction.customAnswers[question.id]),
    ]),
  ),
  firstTry: prediction.firstTry ?? '',
  halfTimeLeader: prediction.halfTimeLeader ?? '',
  highestScoringHalf: prediction.highestScoringHalf ?? '',
  matchResult: prediction.matchResult ?? '',
  team1: {
    conversions: stringFromNumber(prediction.team1.conversions),
    dropGoals: stringFromNumber(prediction.team1.dropGoals),
    penaltyKicks: stringFromNumber(prediction.team1.penaltyKicks),
    redCards: stringFromNumber(prediction.team1.redCards),
    tries: stringFromNumber(prediction.team1.tries),
    yellowCards: stringFromNumber(prediction.team1.yellowCards),
  },
  team2: {
    conversions: stringFromNumber(prediction.team2.conversions),
    dropGoals: stringFromNumber(prediction.team2.dropGoals),
    penaltyKicks: stringFromNumber(prediction.team2.penaltyKicks),
    redCards: stringFromNumber(prediction.team2.redCards),
    tries: stringFromNumber(prediction.team2.tries),
    yellowCards: stringFromNumber(prediction.team2.yellowCards),
  },
});

const teamPredictionFormsEqual = (
  left: TeamPredictionForm,
  right: TeamPredictionForm,
): boolean =>
  left.conversions === right.conversions &&
  left.dropGoals === right.dropGoals &&
  left.penaltyKicks === right.penaltyKicks &&
  left.redCards === right.redCards &&
  left.tries === right.tries &&
  left.yellowCards === right.yellowCards;

const customAnswersEqual = (
  left: Record<string, string>,
  right: Record<string, string>,
): boolean => {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);

  for (const key of keys) {
    if ((left[key] ?? '') !== (right[key] ?? '')) {
      return false;
    }
  }

  return true;
};

export const predictionFormsEqual = (
  left: PredictionFormState,
  right: PredictionFormState,
): boolean =>
  left.firstTry === right.firstTry &&
  left.halfTimeLeader === right.halfTimeLeader &&
  left.highestScoringHalf === right.highestScoringHalf &&
  left.matchResult === right.matchResult &&
  teamPredictionFormsEqual(left.team1, right.team1) &&
  teamPredictionFormsEqual(left.team2, right.team2) &&
  customAnswersEqual(left.customAnswers, right.customAnswers);

export const parseFormWholeNumber = (value: string): number | null => {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isSafeInteger(parsed)) {
    return null;
  }

  return parsed;
};

export const parseWholeNumber = (value: string, label: string): number => {
  const parsed = parseFormWholeNumber(value);

  if (parsed === null) {
    if (/^\d+$/.test(value.trim())) {
      throw new Error(`${label} is too large.`);
    }

    throw new Error(`${label} must be a whole number of 0 or more.`);
  }

  return parsed;
};

export const parseCustomNumberAnswer = (
  value: string,
  question: Extract<ActiveCustomQuestion, { readonly type: 'custom-numeric' }>,
): number => {
  const parsed = parseWholeNumber(value, question.prompt);

  if (parsed < question.min || parsed > question.max) {
    throw new Error(
      `${question.prompt} must be between ${question.min} and ${question.max}.`,
    );
  }

  return parsed;
};

export const customQuestionById = (
  ruleset: RulesetSnapshot,
  questionId: string,
): ActiveCustomQuestion | null =>
  activeCustomQuestions(ruleset).find(
    (question) => question.id === questionId,
  ) ?? null;

export const customChoiceAnswerLabel = (
  question: Extract<
    ActiveCustomQuestion,
    { readonly type: 'custom-categorical' }
  >,
  value: string,
): string =>
  question.options.find((option) => option.id === value)?.label ?? 'Not saved';

export const customAnswerDisplayValue = (
  question: ActiveCustomQuestion,
  value: string,
): string => {
  if (!value) {
    return 'Not saved';
  }

  if (question.type === 'custom-numeric') {
    return parseFormWholeNumber(value) === null ? 'Not saved' : value;
  }

  return customChoiceAnswerLabel(question, value);
};

export const customStepValidationMessage = (
  question: ActiveCustomQuestion,
  value: string,
): string | null => {
  if (question.type === 'custom-numeric') {
    if (!value.trim()) {
      return `Enter a whole number from ${question.min} to ${question.max} to continue.`;
    }

    const parsed = parseFormWholeNumber(value);

    if (parsed === null) {
      return `Enter a whole number from ${question.min} to ${question.max} to continue.`;
    }

    if (parsed < question.min || parsed > question.max) {
      return `Enter a value from ${question.min} to ${question.max} to continue.`;
    }

    return null;
  }

  if (!value) {
    return 'Choose one option to continue.';
  }

  return question.options.some((option) => option.id === value)
    ? null
    : 'Choose one of the listed options to continue.';
};

export const maxAttributeForWholeNumber = (
  value: string,
): string | undefined => {
  const parsed = parseFormWholeNumber(value);

  return parsed === null ? undefined : String(parsed);
};

export const clampWholeNumberToMaximum = (
  value: string,
  maximum: number,
): string => {
  const parsed = parseFormWholeNumber(value);

  if (parsed === null) {
    return value;
  }

  return String(Math.min(parsed, maximum));
};

export const teamDisplayName = (
  fixture: Pick<FixtureDocument, 'team1DisplayName' | 'team2DisplayName'>,
  side: TeamSide,
): string =>
  side === 'team1' ? fixture.team1DisplayName : fixture.team2DisplayName;

export const matchResultLabel = (
  fixture: Pick<FixtureDocument, 'team1DisplayName' | 'team2DisplayName'>,
  value: string,
): string => {
  if (value === 'team1') {
    return teamDisplayName(fixture, 'team1');
  }

  if (value === 'team2') {
    return teamDisplayName(fixture, 'team2');
  }

  if (value === 'draw') {
    return 'Draw';
  }

  return 'Not selected';
};

export const halfTimeLeaderLabel = (
  fixture: Pick<FixtureDocument, 'team1DisplayName' | 'team2DisplayName'>,
  value: string,
): string => {
  if (value === 'draw') {
    return 'Half-time Draw';
  }

  return matchResultLabel(fixture, value);
};

export const firstTryLabel = (
  fixture: Pick<FixtureDocument, 'team1DisplayName' | 'team2DisplayName'>,
  value: string,
): string => {
  if (value === 'no-tries') {
    return 'No Tries Today!';
  }

  return matchResultLabel(fixture, value);
};

export const highestHalfLabel = (value: string): string => {
  if (value === 'first') {
    return 'First half';
  }

  if (value === 'second') {
    return 'Second half';
  }

  if (value === 'equal') {
    return 'Equal points';
  }

  return 'Not selected';
};

const parseWholeNumberForTeam = (
  value: string,
  fixture: Pick<FixtureDocument, 'team1DisplayName' | 'team2DisplayName'>,
  side: TeamSide,
  label: string,
): number =>
  parseWholeNumber(value, `${teamDisplayName(fixture, side)} ${label}`);

export const scoreUnavailableReason = (error: unknown): string => {
  if (error instanceof ScoringValidationError) {
    return error.issues[0]?.message ?? 'Enter valid scoring totals.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Enter valid scoring totals.';
};

export const deriveTeamScoreFromForm = (
  form: TeamPredictionForm,
  fixture: Pick<FixtureDocument, 'team1DisplayName' | 'team2DisplayName'>,
  side: TeamSide,
): TeamScoreReview => {
  try {
    return {
      message: null,
      score: deriveTeamScore({
        conversions: parseWholeNumberForTeam(
          form.conversions,
          fixture,
          side,
          'conversions',
        ),
        dropGoals: parseWholeNumberForTeam(
          form.dropGoals,
          fixture,
          side,
          'drop goals',
        ),
        penaltyKicks: parseWholeNumberForTeam(
          form.penaltyKicks,
          fixture,
          side,
          'penalty kicks',
        ),
        tries: parseWholeNumberForTeam(form.tries, fixture, side, 'tries'),
      }),
    };
  } catch (error) {
    return {
      message: scoreUnavailableReason(error),
      score: null,
    };
  }
};

export const deriveScoresFromForm = (
  form: PredictionFormState,
  fixture: Pick<FixtureDocument, 'team1DisplayName' | 'team2DisplayName'>,
): ScoreReview => {
  const team1 = deriveTeamScoreFromForm(form.team1, fixture, 'team1');
  const team2 = deriveTeamScoreFromForm(form.team2, fixture, 'team2');

  if (team1.score === null || team2.score === null) {
    return {
      matchResult: null,
      resultMessage: 'Enter valid scoring totals for both teams.',
      team1,
      team2,
    };
  }

  try {
    return {
      matchResult: deriveMatchResult(team1.score, team2.score),
      resultMessage: null,
      team1,
      team2,
    };
  } catch (error) {
    return {
      matchResult: null,
      resultMessage: scoreUnavailableReason(error),
      team1,
      team2,
    };
  }
};

export const resultConsistencyIssue = (
  form: PredictionFormState,
  fixture: Pick<FixtureDocument, 'team1DisplayName' | 'team2DisplayName'>,
): ResultConsistencyIssue | null => {
  if (
    form.matchResult !== 'team1' &&
    form.matchResult !== 'team2' &&
    form.matchResult !== 'draw'
  ) {
    return null;
  }

  const derived = deriveScoresFromForm(form, fixture);

  if (
    derived.matchResult === null ||
    derived.matchResult === form.matchResult
  ) {
    return null;
  }

  const selected = form.matchResult;
  const derivedResult = derived.matchResult;
  const selectedLabel = matchResultLabel(fixture, selected);
  const derivedLabel = matchResultLabel(fixture, derivedResult);
  const body =
    derivedResult === 'draw'
      ? `You picked ${selectedLabel} to win, but your scores predict a draw.`
      : selected === 'draw'
        ? `You picked Draw, but your scores put ${derivedLabel} ahead.`
        : `You picked ${selectedLabel} to win, but your scores put ${derivedLabel} ahead.`;

  return {
    body,
    derivedResult,
    heading: "YOUR SCORES DON'T MATCH YOUR CHOSEN WINNER",
    selectedResult: selected,
  };
};

export const firstTryConstraintForForm = (
  form: PredictionFormState,
): FirstTryConstraint => {
  const team1Tries = parseFormWholeNumber(form.team1.tries);
  const team2Tries = parseFormWholeNumber(form.team2.tries);

  if (team1Tries === null || team2Tries === null) {
    return {
      allowedAnswers: ['team1', 'team2', 'no-tries'],
      forcedAnswer: null,
      message: null,
    };
  }

  if (team1Tries === 0 && team2Tries === 0) {
    return {
      allowedAnswers: ['no-tries'],
      forcedAnswer: 'no-tries',
      message: 'Based on your predicted tries.',
    };
  }

  if (team1Tries > 0 && team2Tries === 0) {
    return {
      allowedAnswers: ['team1'],
      forcedAnswer: 'team1',
      message: 'Based on your predicted tries.',
    };
  }

  if (team2Tries > 0 && team1Tries === 0) {
    return {
      allowedAnswers: ['team2'],
      forcedAnswer: 'team2',
      message: 'Based on your predicted tries.',
    };
  }

  return {
    allowedAnswers: ['team1', 'team2'],
    forcedAnswer: null,
    message: null,
  };
};

export const enforceFirstTryConsistency = (
  form: PredictionFormState,
): { readonly didChange: boolean; readonly form: PredictionFormState } => {
  const constraint = firstTryConstraintForForm(form);
  const current = form.firstTry;
  const nextFirstTry =
    constraint.forcedAnswer ??
    (constraint.allowedAnswers.includes(current as FirstTryAnswer)
      ? current
      : '');

  return {
    didChange: nextFirstTry !== current,
    form:
      nextFirstTry === current
        ? form
        : {
            ...form,
            firstTry: nextFirstTry,
          },
  };
};

export const setTeamPredictionField = (
  form: PredictionFormState,
  side: TeamSide,
  field: keyof TeamPredictionForm,
  value: string,
): {
  readonly conversionsAdjusted: boolean;
  readonly form: PredictionFormState;
} => {
  const nextTeam = {
    ...form[side],
    [field]: value,
  };
  let conversionsAdjusted = false;

  if (field === 'tries') {
    const tries = parseFormWholeNumber(value);
    const conversions = parseFormWholeNumber(nextTeam.conversions);

    if (tries !== null && conversions !== null && conversions > tries) {
      nextTeam.conversions = clampWholeNumberToMaximum(
        nextTeam.conversions,
        tries,
      );
      conversionsAdjusted = true;
    }
  }

  if (field === 'conversions') {
    const tries = parseFormWholeNumber(nextTeam.tries);
    const conversions = parseFormWholeNumber(value);

    if (tries !== null && conversions !== null && conversions > tries) {
      nextTeam.conversions = clampWholeNumberToMaximum(value, tries);
      conversionsAdjusted = true;
    }
  }

  const withTeam = {
    ...form,
    [side]: nextTeam,
  };
  const withFirstTry = enforceFirstTryConsistency(withTeam).form;

  return {
    conversionsAdjusted,
    form: withFirstTry,
  };
};

export const normalizeInitialPredictionForm = (
  form: PredictionFormState,
  ruleset: RulesetSnapshot,
): PredictionFormState =>
  isBuiltInEnabled(ruleset, 'first-try')
    ? enforceFirstTryConsistency(form).form
    : form;

export const buildPredictionPayload = (
  form: PredictionFormState,
  ruleset: RulesetSnapshot,
  fixture: Pick<FixtureDocument, 'team1DisplayName' | 'team2DisplayName'>,
): FixturePrediction => {
  const teamPayload = (
    team: TeamPredictionForm,
    label: string,
  ): TeamPrediction => ({
    conversions: parseWholeNumber(team.conversions, `${label} conversions`),
    dropGoals: parseWholeNumber(team.dropGoals, `${label} drop goals`),
    penaltyKicks: parseWholeNumber(team.penaltyKicks, `${label} penalty kicks`),
    ...(isBuiltInEnabled(ruleset, 'red-cards')
      ? {
          redCards: parseWholeNumber(team.redCards, `${label} red cards`),
        }
      : {}),
    tries: parseWholeNumber(team.tries, `${label} tries`),
    ...(isBuiltInEnabled(ruleset, 'yellow-cards')
      ? {
          yellowCards: parseWholeNumber(
            team.yellowCards,
            `${label} yellow cards`,
          ),
        }
      : {}),
  });

  const customQuestions = activeCustomQuestions(ruleset);

  return {
    ...(isBuiltInEnabled(ruleset, 'match-result')
      ? {
          matchResult: form.matchResult as FixturePrediction['matchResult'],
        }
      : {}),
    ...(isBuiltInEnabled(ruleset, 'first-try')
      ? { firstTry: form.firstTry as FixturePrediction['firstTry'] }
      : {}),
    ...(isBuiltInEnabled(ruleset, 'highest-scoring-half')
      ? {
          highestScoringHalf:
            form.highestScoringHalf as FixturePrediction['highestScoringHalf'],
        }
      : {}),
    ...(isBuiltInEnabled(ruleset, 'half-time-leader')
      ? {
          halfTimeLeader:
            form.halfTimeLeader as FixturePrediction['halfTimeLeader'],
        }
      : {}),
    ...(customQuestions.length > 0
      ? {
          customAnswers: Object.fromEntries(
            customQuestions.map((question) => {
              const rawValue = form.customAnswers[question.id] ?? '';
              const value =
                question.type === 'custom-numeric'
                  ? parseCustomNumberAnswer(rawValue, question)
                  : rawValue;

              return [question.id, value];
            }),
          ),
        }
      : {}),
    team1: teamPayload(form.team1, teamDisplayName(fixture, 'team1')),
    team2: teamPayload(form.team2, teamDisplayName(fixture, 'team2')),
  };
};
