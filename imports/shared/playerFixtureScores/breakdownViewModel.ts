import type { FixtureDocument } from '/imports/shared/fixtures';
import { activeCustomQuestions } from '/imports/shared/predictions/sequence';
import {
  questionById,
  type CategoricalBreakdownItem,
  type CustomCategoricalQuestion,
  type CustomNumericQuestion,
  type NumericBreakdownItem,
  type QuestionDefinition,
  type TeamSide,
} from '/imports/shared/scoring';
import type {
  PlayerFixtureScoreComponent,
  PlayerFixtureScoreProjection,
  PlayerFixtureScoreStatus,
} from './types';

export type PlayerScoreBreakdownViewStatus =
  'no_prediction' | PlayerFixtureScoreStatus;

export type PlayerScoreBreakdownItemStatus = 'pending' | 'resolved' | 'void';

export type PlayerScoreBreakdownTone =
  'deduction' | 'neutral' | 'pending' | 'void';

export interface PlayerScoreBreakdownSummaryRow {
  readonly label: string;
  readonly tone: PlayerScoreBreakdownTone;
  readonly value: string;
}

export interface PlayerScoreBreakdownRow {
  readonly actualHeading: string;
  readonly actualLabel: string;
  readonly deductionLabel: string;
  readonly deductionValue: number | null;
  readonly id: string;
  readonly itemLabel?: string;
  readonly predictionHeading: string;
  readonly predictionLabel: string;
  readonly status: PlayerScoreBreakdownItemStatus;
  readonly statusLabel: string;
  readonly tone: PlayerScoreBreakdownTone;
  readonly voidNote?: string;
}

export interface PlayerScoreBreakdownSection {
  readonly id: string;
  readonly prompt?: string;
  readonly rows: readonly PlayerScoreBreakdownRow[];
  readonly statusLabel?: string;
  readonly title: string;
}

export interface PlayerScoreBreakdownViewModel {
  readonly fixtureId: string;
  readonly floorApplied: boolean;
  readonly notice: string;
  readonly phaseLabel: string;
  readonly scoreLabel: string | null;
  readonly sections: readonly PlayerScoreBreakdownSection[];
  readonly status: PlayerScoreBreakdownViewStatus;
  readonly summaryRows: readonly PlayerScoreBreakdownSummaryRow[];
  readonly title: string;
}

export type PlayerScoreBreakdownFixtureInput = Pick<
  FixtureDocument,
  '_id' | 'rulesetSnapshot' | 'team1DisplayName' | 'team2DisplayName'
>;

export interface BuildPlayerScoreBreakdownViewModelInput {
  readonly fixture: PlayerScoreBreakdownFixtureInput;
  readonly scoreProjection: PlayerFixtureScoreProjection | null;
}

const builtInNumericOrder = [
  'tries',
  'conversions',
  'penalty-kicks',
  'drop-goals',
  'team-score',
] as const;

const teamNumericTitles: Record<(typeof builtInNumericOrder)[number], string> =
  {
    conversions: 'Conversions',
    'drop-goals': 'Drop Goals',
    'penalty-kicks': 'Penalty Kicks',
    'team-score': 'Predicted Score',
    tries: 'Tries',
  };

const customQuestionFallbackTitle = 'Custom Question';

const formatNumber = (value: number): string => value.toLocaleString('en-US');

const formatPoints = (value: number): string => `${formatNumber(value)} pts`;

const formatSignedDeduction = (value: number): string =>
  value === 0 ? '0' : `-${formatNumber(value)}`;

const formatSummaryDeduction = (value: number): string =>
  value === 0 ? '0' : `-${formatNumber(value)}`;

const teamName = (
  fixture: PlayerScoreBreakdownFixtureInput,
  side: TeamSide,
): string =>
  side === 'team1' ? fixture.team1DisplayName : fixture.team2DisplayName;

const isNumericItem = (
  item: PlayerFixtureScoreComponent['items'][number],
): item is NumericBreakdownItem => 'rate' in item;

const isCategoricalItem = (
  item: PlayerFixtureScoreComponent['items'][number],
): item is CategoricalBreakdownItem => 'incorrectDeduction' in item;

const itemStatus = (
  item: NumericBreakdownItem | CategoricalBreakdownItem,
): PlayerScoreBreakdownItemStatus => {
  if (item.status === 'pending') {
    return 'pending';
  }

  if (item.status === 'void') {
    return 'void';
  }

  return 'resolved';
};

const deductionLabel = (
  item: NumericBreakdownItem | CategoricalBreakdownItem,
): string => {
  if (item.status === 'pending' || item.deduction === null) {
    return 'Pending';
  }

  if (item.status === 'void') {
    return 'No deduction';
  }

  return item.deduction > 0
    ? formatSignedDeduction(item.deduction)
    : 'No deduction';
};

const rowTone = (
  item: NumericBreakdownItem | CategoricalBreakdownItem,
): PlayerScoreBreakdownTone => {
  if (item.status === 'pending' || item.deduction === null) {
    return 'pending';
  }

  if (item.status === 'void') {
    return 'void';
  }

  return item.deduction > 0 ? 'deduction' : 'neutral';
};

const statusLabel = (
  item: NumericBreakdownItem | CategoricalBreakdownItem,
): string => {
  if (item.status === 'pending' || item.deduction === null) {
    return 'Pending';
  }

  if (item.status === 'void') {
    return 'Void';
  }

  return item.deduction > 0 ? 'Deduction' : 'No deduction';
};

const numericRow = ({
  actualHeading = 'Actual',
  id,
  item,
  itemLabel,
  predictionHeading = 'Predicted',
}: {
  readonly actualHeading?: string;
  readonly id: string;
  readonly item: NumericBreakdownItem;
  readonly itemLabel?: string;
  readonly predictionHeading?: string;
}): PlayerScoreBreakdownRow => ({
  actualHeading,
  actualLabel:
    item.status === 'pending'
      ? 'Pending'
      : item.status === 'void'
        ? 'Void'
        : item.observed === null
          ? 'Unavailable'
          : formatNumber(item.observed),
  deductionLabel: deductionLabel(item),
  deductionValue: item.deduction,
  id,
  ...(itemLabel ? { itemLabel } : {}),
  predictionHeading,
  predictionLabel: formatNumber(item.prediction),
  status: itemStatus(item),
  statusLabel: statusLabel(item),
  tone: rowTone(item),
  ...(item.status === 'void'
    ? { voidNote: 'This question was excluded from scoring.' }
    : {}),
});

const customOptionLabel = (
  question: CustomCategoricalQuestion,
  optionId: string | null,
): string => {
  if (optionId === null) {
    return 'Pending';
  }

  return (
    question.options.find((option) => option.id === optionId)?.label ??
    'Unknown option'
  );
};

const builtInCategoricalLabel = ({
  fixture,
  questionId,
  value,
}: {
  readonly fixture: PlayerScoreBreakdownFixtureInput;
  readonly questionId: string;
  readonly value: string | null;
}): string => {
  if (value === null) {
    return 'Pending';
  }

  if (questionId === 'first-try' && value === 'no-tries') {
    return 'No Tries Today';
  }

  if (questionId === 'highest-scoring-half') {
    if (value === 'first') {
      return 'First Half';
    }

    if (value === 'second') {
      return 'Second Half';
    }

    if (value === 'equal') {
      return 'Equal Points';
    }
  }

  if (value === 'draw') {
    return 'Draw';
  }

  if (value === 'team1' || value === 'team2') {
    return teamName(fixture, value);
  }

  return 'Unknown result';
};

const categoricalRow = ({
  actualHeading,
  id,
  item,
  predictionHeading,
  valueLabel,
}: {
  readonly actualHeading: string;
  readonly id: string;
  readonly item: CategoricalBreakdownItem;
  readonly predictionHeading: string;
  readonly valueLabel: (value: string | null) => string;
}): PlayerScoreBreakdownRow => ({
  actualHeading,
  actualLabel:
    item.status === 'pending'
      ? 'Pending'
      : item.status === 'void'
        ? 'Void'
        : valueLabel(item.observed),
  deductionLabel: deductionLabel(item),
  deductionValue: item.deduction,
  id,
  predictionHeading,
  predictionLabel: valueLabel(item.prediction),
  status: itemStatus(item),
  statusLabel: statusLabel(item),
  tone: rowTone(item),
  ...(item.status === 'void'
    ? { voidNote: 'This question was excluded from scoring.' }
    : {}),
});

const sectionStatusLabel = (
  rows: readonly PlayerScoreBreakdownRow[],
): string | undefined => {
  const pendingCount = rows.filter((row) => row.status === 'pending').length;

  if (pendingCount > 0) {
    return `${formatNumber(pendingCount)} pending`;
  }

  if (rows.length > 0 && rows.every((row) => row.status === 'void')) {
    return 'Void';
  }

  return undefined;
};

const categoricalSection = ({
  actualHeading,
  component,
  fixture,
  predictionHeading,
  title,
}: {
  readonly actualHeading: string;
  readonly component: PlayerFixtureScoreComponent | undefined;
  readonly fixture: PlayerScoreBreakdownFixtureInput;
  readonly predictionHeading: string;
  readonly title: string;
}): PlayerScoreBreakdownSection | null => {
  const item = component?.items.find(isCategoricalItem);

  if (!component || !item) {
    return null;
  }

  const rows = [
    categoricalRow({
      actualHeading,
      id: `${component.questionId}:result`,
      item,
      predictionHeading,
      valueLabel: (value) =>
        builtInCategoricalLabel({
          fixture,
          questionId: component.questionId,
          value,
        }),
    }),
  ];

  return {
    id: component.questionId,
    rows,
    statusLabel: sectionStatusLabel(rows),
    title,
  };
};

const teamNumericSection = ({
  component,
  fixture,
  title,
}: {
  readonly component: PlayerFixtureScoreComponent | undefined;
  readonly fixture: PlayerScoreBreakdownFixtureInput;
  readonly title: string;
}): PlayerScoreBreakdownSection | null => {
  if (!component) {
    return null;
  }

  const rows = (['team1', 'team2'] as const)
    .map((side) => {
      const item = component.items.find(
        (candidate): candidate is NumericBreakdownItem =>
          isNumericItem(candidate) && candidate.team === side,
      );

      return item
        ? numericRow({
            id: `${component.questionId}:${side}`,
            item,
            itemLabel: teamName(fixture, side),
          })
        : null;
    })
    .filter((row): row is PlayerScoreBreakdownRow => row !== null);

  if (rows.length === 0) {
    return null;
  }

  return {
    id: component.questionId,
    rows,
    statusLabel: sectionStatusLabel(rows),
    title,
  };
};

const cardSection = ({
  componentsById,
  fixture,
}: {
  readonly componentsById: ReadonlyMap<string, PlayerFixtureScoreComponent>;
  readonly fixture: PlayerScoreBreakdownFixtureInput;
}): PlayerScoreBreakdownSection | null => {
  const cardComponents = [
    {
      component: componentsById.get('yellow-cards'),
      label: 'Yellow Cards',
      questionId: 'yellow-cards',
    },
    {
      component: componentsById.get('red-cards'),
      label: 'Red Cards',
      questionId: 'red-cards',
    },
  ];
  const rows = (['team1', 'team2'] as const).flatMap((side) =>
    cardComponents
      .map(({ component, label, questionId }) => {
        const item = component?.items.find(
          (candidate): candidate is NumericBreakdownItem =>
            isNumericItem(candidate) && candidate.team === side,
        );

        return item
          ? numericRow({
              id: `cards:${side}:${questionId}`,
              item,
              itemLabel: label,
              predictionHeading: `${teamName(fixture, side)} predicted`,
            })
          : null;
      })
      .filter((row): row is PlayerScoreBreakdownRow => row !== null),
  );

  if (rows.length === 0) {
    return null;
  }

  return {
    id: 'cards',
    rows,
    statusLabel: sectionStatusLabel(rows),
    title: 'Cards',
  };
};

const customSection = ({
  component,
  question,
}: {
  readonly component: PlayerFixtureScoreComponent | undefined;
  readonly question: CustomCategoricalQuestion | CustomNumericQuestion;
}): PlayerScoreBreakdownSection | null => {
  const item = component?.items[0];

  if (!component || !item) {
    return null;
  }

  const title = question.banter ?? customQuestionFallbackTitle;
  const prompt = question.prompt;
  const row =
    question.type === 'custom-numeric' && isNumericItem(item)
      ? numericRow({
          actualHeading: 'Actual',
          id: `${question.id}:custom-number`,
          item,
          predictionHeading: 'Your prediction',
        })
      : question.type === 'custom-categorical' && isCategoricalItem(item)
        ? categoricalRow({
            actualHeading: 'Actual',
            id: `${question.id}:custom-choice`,
            item,
            predictionHeading: 'You predicted',
            valueLabel: (value) => customOptionLabel(question, value),
          })
        : null;

  if (!row) {
    return null;
  }

  const rows = [row];

  return {
    id: question.id,
    prompt,
    rows,
    statusLabel: sectionStatusLabel(rows),
    title,
  };
};

const scoreForProjection = (
  projection: PlayerFixtureScoreProjection,
): number | null =>
  projection.status === 'final'
    ? (projection.finalScore ?? projection.currentScore)
    : projection.currentScore;

const buildSummaryRows = (
  projection: PlayerFixtureScoreProjection,
): readonly PlayerScoreBreakdownSummaryRow[] => {
  if (
    projection.status === 'awaiting_result' ||
    projection.status === 'cancelled'
  ) {
    return projection.status === 'awaiting_result'
      ? [
          {
            label: 'Starting points',
            tone: 'neutral',
            value: formatNumber(projection.startingPoints),
          },
        ]
      : [];
  }

  const rows: PlayerScoreBreakdownSummaryRow[] = [
    {
      label: 'Starting points',
      tone: 'neutral',
      value: formatNumber(projection.startingPoints),
    },
    {
      label:
        projection.status === 'final'
          ? 'Total deductions'
          : 'Resolved deductions',
      tone: projection.resolvedDeduction > 0 ? 'deduction' : 'neutral',
      value: formatSummaryDeduction(projection.resolvedDeduction),
    },
  ];

  if (projection.status === 'provisional') {
    rows.push({
      label: 'Pending predictions',
      tone: projection.pendingCount > 0 ? 'pending' : 'neutral',
      value: formatNumber(projection.pendingCount),
    });
  }

  if (
    projection.resolvedDeduction > projection.startingPoints &&
    scoreForProjection(projection) === 0
  ) {
    rows.push({
      label: 'Score floor applied',
      tone: 'neutral',
      value: '0',
    });
  }

  return rows;
};

const sectionsForProjection = ({
  fixture,
  projection,
}: {
  readonly fixture: PlayerScoreBreakdownFixtureInput;
  readonly projection: PlayerFixtureScoreProjection;
}): readonly PlayerScoreBreakdownSection[] => {
  const componentsById = new Map(
    projection.components.map((component) => [component.questionId, component]),
  );
  const sections: PlayerScoreBreakdownSection[] = [];
  const pushSection = (section: PlayerScoreBreakdownSection | null) => {
    if (section) {
      sections.push(section);
    }
  };

  pushSection(
    categoricalSection({
      actualHeading: 'Result',
      component: componentsById.get('match-result'),
      fixture,
      predictionHeading: 'You predicted',
      title: 'Match Result',
    }),
  );

  for (const questionId of builtInNumericOrder) {
    pushSection(
      teamNumericSection({
        component: componentsById.get(questionId),
        fixture,
        title: teamNumericTitles[questionId],
      }),
    );
  }

  pushSection(cardSection({ componentsById, fixture }));

  pushSection(
    categoricalSection({
      actualHeading: 'Actual',
      component: componentsById.get('first-try'),
      fixture,
      predictionHeading: 'You predicted',
      title: 'First Try',
    }),
  );
  pushSection(
    categoricalSection({
      actualHeading: 'Actual',
      component: componentsById.get('highest-scoring-half'),
      fixture,
      predictionHeading: 'You predicted',
      title: 'Highest-Scoring Half',
    }),
  );
  pushSection(
    categoricalSection({
      actualHeading: 'Actual',
      component: componentsById.get('half-time-leader'),
      fixture,
      predictionHeading: 'You predicted',
      title: 'Half-Time Leader',
    }),
  );

  if (fixture.rulesetSnapshot) {
    for (const question of activeCustomQuestions(fixture.rulesetSnapshot)) {
      pushSection(
        customSection({
          component: componentsById.get(question.id),
          question,
        }),
      );
    }
  } else {
    const builtInIds = new Set([
      'match-result',
      ...builtInNumericOrder,
      'yellow-cards',
      'red-cards',
      'first-try',
      'highest-scoring-half',
      'half-time-leader',
    ]);

    for (const component of projection.components) {
      if (builtInIds.has(component.questionId)) {
        continue;
      }

      const rows = component.items
        .map((item, index) =>
          isNumericItem(item)
            ? numericRow({
                id: `${component.questionId}:${index}`,
                item,
                predictionHeading: 'Your prediction',
              })
            : isCategoricalItem(item)
              ? categoricalRow({
                  actualHeading: 'Actual',
                  id: `${component.questionId}:${index}`,
                  item,
                  predictionHeading: 'You predicted',
                  valueLabel: () => 'Unknown option',
                })
              : null,
        )
        .filter((row): row is PlayerScoreBreakdownRow => row !== null);

      if (rows.length > 0) {
        sections.push({
          id: component.questionId,
          rows,
          statusLabel: sectionStatusLabel(rows),
          title: component.label,
        });
      }
    }
  }

  return sections;
};

const projectionNotice = (
  projection: PlayerFixtureScoreProjection,
  floorApplied: boolean,
): string => {
  if (projection.status === 'awaiting_result') {
    return "Scoring hasn't started yet. Your breakdown will appear once match results start coming in.";
  }

  if (projection.status === 'cancelled') {
    return 'This fixture was cancelled, so no score was awarded.';
  }

  if (floorApplied) {
    return "Fixture scores can't fall below zero.";
  }

  if (projection.status === 'provisional') {
    return 'Some predictions are still pending. Your score can still change.';
  }

  return 'Official fixture scoring is confirmed.';
};

export const buildPlayerScoreBreakdownViewModel = ({
  fixture,
  scoreProjection,
}: BuildPlayerScoreBreakdownViewModelInput): PlayerScoreBreakdownViewModel => {
  if (!scoreProjection) {
    return {
      fixtureId: fixture._id,
      floorApplied: false,
      notice: "You didn't submit a prediction for this fixture.",
      phaseLabel: 'Your score',
      scoreLabel: null,
      sections: [],
      status: 'no_prediction',
      summaryRows: [],
      title: 'No prediction found',
    };
  }

  const score = scoreForProjection(scoreProjection);
  const floorApplied =
    score === 0 &&
    scoreProjection.resolvedDeduction > scoreProjection.startingPoints;
  const phaseLabel =
    scoreProjection.status === 'provisional'
      ? 'If it ended now'
      : scoreProjection.status === 'final'
        ? 'Final Score'
        : 'Your score';
  const title =
    scoreProjection.status === 'cancelled'
      ? 'No score'
      : scoreProjection.status === 'awaiting_result'
        ? 'Scoring has not started'
        : phaseLabel;

  return {
    fixtureId: fixture._id,
    floorApplied,
    notice: projectionNotice(scoreProjection, floorApplied),
    phaseLabel,
    scoreLabel: score === null ? null : formatPoints(score),
    sections: sectionsForProjection({
      fixture,
      projection: scoreProjection,
    }),
    status: scoreProjection.status,
    summaryRows: buildSummaryRows(scoreProjection),
    title,
  };
};

export const scoreBreakdownQuestionDefinitions = (
  fixture: PlayerScoreBreakdownFixtureInput,
): ReadonlyMap<string, QuestionDefinition> =>
  fixture.rulesetSnapshot ? questionById(fixture.rulesetSnapshot) : new Map();
