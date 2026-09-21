import { describe, expect, it } from 'vitest';

import {
  buildPlayerScoreBreakdownViewModel,
  type PlayerFixtureScoreComponent,
  type PlayerFixtureScoreProjection,
  type PlayerScoreBreakdownFixtureInput,
} from '../../imports/shared/playerFixtureScores';
import {
  buildConfiguredRulesetSnapshot,
  defaultFixturePredictionQuestionConfig,
} from '../../imports/shared/predictionQuestions';
import {
  defaultRuleset,
  type CategoricalBreakdownItem,
  type NumericBreakdownItem,
  type QuestionDefinition,
  type RulesetSnapshot,
  type TeamSide,
} from '../../imports/shared/scoring';

const fixture = (
  ruleset: RulesetSnapshot = defaultRuleset,
  overrides: Partial<PlayerScoreBreakdownFixtureInput> = {},
): PlayerScoreBreakdownFixtureInput => ({
  _id: 'fixture-011c',
  rulesetSnapshot: ruleset,
  team1DisplayName: 'Springboks',
  team2DisplayName: 'All Blacks',
  ...overrides,
});

const projection = (
  overrides: Partial<PlayerFixtureScoreProjection> = {},
  ruleset: RulesetSnapshot = defaultRuleset,
): PlayerFixtureScoreProjection => ({
  components: [],
  currentScore: 9_000,
  finalScore: null,
  fixtureId: 'fixture-011c',
  pendingCount: 0,
  predictionRevision: 2,
  resolvedDeduction: 1_000,
  resultRevision: 5,
  ruleset: {
    id: ruleset.id,
    questionCount: ruleset.questions.length,
    schemaVersion: ruleset.schemaVersion,
    version: ruleset.version,
  },
  startingPoints: 10_000,
  status: 'provisional',
  ...overrides,
});

const numericItem = ({
  deduction,
  observed,
  prediction,
  status = 'confirmed',
  team,
}: {
  readonly deduction: number | null;
  readonly observed: number | null;
  readonly prediction: number;
  readonly status?: NumericBreakdownItem['status'];
  readonly team?: TeamSide;
}): NumericBreakdownItem => ({
  deduction,
  difference: observed === null ? null : 1,
  observed,
  prediction,
  rate: 50,
  status,
  ...(team ? { team } : {}),
});

const categoricalItem = ({
  deduction,
  observed,
  prediction,
  status = 'confirmed',
}: {
  readonly deduction: number | null;
  readonly observed: string | null;
  readonly prediction: string;
  readonly status?: CategoricalBreakdownItem['status'];
}): CategoricalBreakdownItem => ({
  deduction,
  incorrectDeduction: 250,
  observed,
  prediction,
  status,
});

const component = ({
  deduction = 0,
  items,
  label,
  questionId,
  status = 'resolved',
  type,
}: {
  readonly deduction?: number | null;
  readonly items: PlayerFixtureScoreComponent['items'];
  readonly label: string;
  readonly questionId: string;
  readonly status?: PlayerFixtureScoreComponent['status'];
  readonly type: PlayerFixtureScoreComponent['type'];
}): PlayerFixtureScoreComponent => ({
  deduction,
  items,
  key: questionId,
  label,
  questionId,
  status,
  type,
});

const teamNumericComponent = (
  questionId: string,
  label: string,
  team1: NumericBreakdownItem,
  team2: NumericBreakdownItem,
  status: PlayerFixtureScoreComponent['status'] = 'resolved',
): PlayerFixtureScoreComponent =>
  component({
    deduction: null,
    items: [team1, team2],
    label,
    questionId,
    status,
    type: 'built-in-team-numeric',
  });

const customRuleset = (): RulesetSnapshot =>
  buildConfiguredRulesetSnapshot({
    ...defaultFixturePredictionQuestionConfig(),
    customQuestions: [
      {
        answerType: 'choice',
        banter: 'Maul Watch',
        countingDefinition: 'First maul score source settled by officials.',
        id: 'maul-first',
        incorrectDeduction: 200,
        options: [
          { id: 'maul-boks', label: 'Springboks' },
          { id: 'maul-blacks', label: 'All Blacks' },
        ],
        order: 1,
        prompt: 'Which team scores from a maul first?',
      },
      {
        answerType: 'number',
        countingDefinition:
          'Scrum penalties awarded against the All Blacks in regulation time.',
        deductionPerUnit: 150,
        id: 'scrum-pressure',
        max: 12,
        min: 0,
        order: 2,
        prompt: 'How many scrum penalties will the All Blacks concede?',
      },
    ],
  });

const withoutQuestions = (
  ruleset: RulesetSnapshot,
  disabledIds: readonly string[],
): RulesetSnapshot => {
  const disabled = new Set(disabledIds);

  return {
    ...ruleset,
    questions: ruleset.questions.map((question): QuestionDefinition =>
      disabled.has(question.id) ? { ...question, enabled: false } : question,
    ),
  };
};

const section = (
  model: ReturnType<typeof buildPlayerScoreBreakdownViewModel>,
  id: string,
) => {
  const match = model.sections.find((candidate) => candidate.id === id);

  if (!match) {
    throw new Error(`Missing section ${id}`);
  }

  return match;
};

describe('player score breakdown view model', () => {
  it('shows awaiting-result copy without treating starting points as a current score', () => {
    const model = buildPlayerScoreBreakdownViewModel({
      fixture: fixture(),
      scoreProjection: projection({
        components: [],
        currentScore: null,
        finalScore: null,
        pendingCount: 0,
        resolvedDeduction: 0,
        resultRevision: null,
        status: 'awaiting_result',
      }),
    });

    expect(model.status).toBe('awaiting_result');
    expect(model.phaseLabel).toBe('Your score');
    expect(model.scoreLabel).toBeNull();
    expect(model.notice).toContain("Scoring hasn't started yet");
    expect(model.summaryRows).toEqual([
      {
        label: 'Starting points',
        tone: 'neutral',
        value: '10,000',
      },
    ]);
    expect(model.sections).toEqual([]);
  });

  it('builds provisional and final summaries from authoritative projection totals', () => {
    const provisional = buildPlayerScoreBreakdownViewModel({
      fixture: fixture(),
      scoreProjection: projection({
        currentScore: 4_321,
        pendingCount: 3,
        resolvedDeduction: 5_678,
        status: 'provisional',
      }),
    });

    expect(provisional.phaseLabel).toBe('If it ended now');
    expect(provisional.scoreLabel).toBe('4,321 pts');
    expect(provisional.summaryRows).toEqual([
      { label: 'Starting points', tone: 'neutral', value: '10,000' },
      { label: 'Resolved deductions', tone: 'deduction', value: '-5,678' },
      { label: 'Pending predictions', tone: 'pending', value: '3' },
    ]);
    expect(provisional.notice).toBe(
      'Some predictions are still pending. Your score can still change.',
    );

    const final = buildPlayerScoreBreakdownViewModel({
      fixture: fixture(),
      scoreProjection: projection({
        currentScore: 7_850,
        finalScore: 7_850,
        pendingCount: 0,
        resolvedDeduction: 2_150,
        status: 'final',
      }),
    });

    expect(final.phaseLabel).toBe('Final Score');
    expect(final.scoreLabel).toBe('7,850 pts');
    expect(final.summaryRows).toEqual([
      { label: 'Starting points', tone: 'neutral', value: '10,000' },
      { label: 'Total deductions', tone: 'deduction', value: '-2,150' },
    ]);
  });

  it('shows cancelled and no-prediction states without score arithmetic', () => {
    const cancelled = buildPlayerScoreBreakdownViewModel({
      fixture: fixture(),
      scoreProjection: projection({
        components: [],
        currentScore: null,
        finalScore: null,
        pendingCount: 0,
        resolvedDeduction: 0,
        status: 'cancelled',
      }),
    });

    expect(cancelled.title).toBe('No score');
    expect(cancelled.scoreLabel).toBeNull();
    expect(cancelled.summaryRows).toEqual([]);
    expect(cancelled.notice).toBe(
      'This fixture was cancelled, so no score was awarded.',
    );

    const noPrediction = buildPlayerScoreBreakdownViewModel({
      fixture: fixture(),
      scoreProjection: null,
    });

    expect(noPrediction.status).toBe('no_prediction');
    expect(noPrediction.title).toBe('No prediction found');
    expect(noPrediction.notice).toBe(
      "You didn't submit a prediction for this fixture.",
    );
    expect(noPrediction.scoreLabel).toBeNull();
  });

  it('keeps zero-floor display tied to projection totals instead of recalculating score', () => {
    const model = buildPlayerScoreBreakdownViewModel({
      fixture: fixture(),
      scoreProjection: projection({
        currentScore: 0,
        finalScore: 0,
        pendingCount: 0,
        resolvedDeduction: 12_400,
        status: 'final',
      }),
    });

    expect(model.floorApplied).toBe(true);
    expect(model.scoreLabel).toBe('0 pts');
    expect(model.summaryRows).toContainEqual({
      label: 'Total deductions',
      tone: 'deduction',
      value: '-12,400',
    });
    expect(model.summaryRows).toContainEqual({
      label: 'Score floor applied',
      tone: 'neutral',
      value: '0',
    });
    expect(model.notice).toBe("Fixture scores can't fall below zero.");
  });

  it('resolves Match Result labels, Draw labels, and deduction presentation', () => {
    const wrongResult = buildPlayerScoreBreakdownViewModel({
      fixture: fixture(),
      scoreProjection: projection({
        components: [
          component({
            deduction: 5_000,
            items: [
              categoricalItem({
                deduction: 5_000,
                observed: 'team2',
                prediction: 'team1',
              }),
            ],
            label: 'Match result',
            questionId: 'match-result',
            type: 'built-in-categorical',
          }),
        ],
      }),
    });
    const matchRow = section(wrongResult, 'match-result').rows[0];

    expect(matchRow.predictionHeading).toBe('You predicted');
    expect(matchRow.predictionLabel).toBe('Springboks');
    expect(matchRow.actualHeading).toBe('Result');
    expect(matchRow.actualLabel).toBe('All Blacks');
    expect(matchRow.deductionLabel).toBe('-5,000');

    const draw = buildPlayerScoreBreakdownViewModel({
      fixture: fixture(),
      scoreProjection: projection({
        components: [
          component({
            items: [
              categoricalItem({
                deduction: 0,
                observed: 'draw',
                prediction: 'draw',
              }),
            ],
            label: 'Match result',
            questionId: 'match-result',
            type: 'built-in-categorical',
          }),
        ],
      }),
    });

    expect(section(draw, 'match-result').rows[0]).toMatchObject({
      actualLabel: 'Draw',
      deductionLabel: 'No deduction',
      predictionLabel: 'Draw',
      statusLabel: 'No deduction',
    });
  });

  it('keeps item-level detail for team numeric rows when the component is partially pending', () => {
    const model = buildPlayerScoreBreakdownViewModel({
      fixture: fixture(),
      scoreProjection: projection({
        components: [
          teamNumericComponent(
            'tries',
            'Tries',
            numericItem({
              deduction: 50,
              observed: 5,
              prediction: 4,
              team: 'team1',
            }),
            numericItem({
              deduction: null,
              observed: null,
              prediction: 3,
              status: 'pending',
              team: 'team2',
            }),
            'pending',
          ),
          teamNumericComponent(
            'conversions',
            'Conversions',
            numericItem({
              deduction: 0,
              observed: 3,
              prediction: 3,
              team: 'team1',
            }),
            numericItem({
              deduction: 50,
              observed: 2,
              prediction: 3,
              team: 'team2',
            }),
          ),
        ],
        pendingCount: 1,
      }),
    });
    const tries = section(model, 'tries');

    expect(tries.statusLabel).toBe('1 pending');
    expect(tries.rows[0]).toMatchObject({
      actualLabel: '5',
      deductionLabel: '-50',
      itemLabel: 'Springboks',
      predictionLabel: '4',
      status: 'resolved',
    });
    expect(tries.rows[1]).toMatchObject({
      actualLabel: 'Pending',
      deductionLabel: 'Pending',
      itemLabel: 'All Blacks',
      predictionLabel: '3',
      status: 'pending',
    });
    expect(section(model, 'conversions').rows[0]).toMatchObject({
      deductionLabel: 'No deduction',
      statusLabel: 'No deduction',
    });
  });

  it('shows initialized live-counter zero actuals while unresolved questions remain pending', () => {
    const ruleset = customRuleset();
    const model = buildPlayerScoreBreakdownViewModel({
      fixture: fixture(ruleset),
      scoreProjection: projection(
        {
          components: [
            teamNumericComponent(
              'tries',
              'Tries',
              numericItem({
                deduction: 200,
                observed: 0,
                prediction: 4,
                team: 'team1',
              }),
              numericItem({
                deduction: 150,
                observed: 0,
                prediction: 3,
                team: 'team2',
              }),
            ),
            teamNumericComponent(
              'conversions',
              'Conversions',
              numericItem({
                deduction: 150,
                observed: 0,
                prediction: 3,
                team: 'team1',
              }),
              numericItem({
                deduction: 150,
                observed: 0,
                prediction: 3,
                team: 'team2',
              }),
            ),
            teamNumericComponent(
              'penalty-kicks',
              'Penalty kicks',
              numericItem({
                deduction: 100,
                observed: 0,
                prediction: 1,
                team: 'team1',
              }),
              numericItem({
                deduction: 0,
                observed: 0,
                prediction: 0,
                team: 'team2',
              }),
            ),
            teamNumericComponent(
              'drop-goals',
              'Drop goals',
              numericItem({
                deduction: 0,
                observed: 0,
                prediction: 0,
                team: 'team1',
              }),
              numericItem({
                deduction: 0,
                observed: 0,
                prediction: 0,
                team: 'team2',
              }),
            ),
            teamNumericComponent(
              'yellow-cards',
              'Yellow cards',
              numericItem({
                deduction: 0,
                observed: 0,
                prediction: 0,
                team: 'team1',
              }),
              numericItem({
                deduction: 0,
                observed: 0,
                prediction: 0,
                team: 'team2',
              }),
            ),
            teamNumericComponent(
              'red-cards',
              'Red cards',
              numericItem({
                deduction: 0,
                observed: 0,
                prediction: 0,
                team: 'team1',
              }),
              numericItem({
                deduction: 0,
                observed: 0,
                prediction: 0,
                team: 'team2',
              }),
            ),
            component({
              deduction: null,
              items: [
                categoricalItem({
                  deduction: null,
                  observed: null,
                  prediction: 'team1',
                  status: 'pending',
                }),
              ],
              label: 'First try',
              questionId: 'first-try',
              status: 'pending',
              type: 'built-in-categorical',
            }),
            component({
              deduction: null,
              items: [
                numericItem({
                  deduction: null,
                  observed: null,
                  prediction: 4,
                  status: 'pending',
                }),
              ],
              label: 'How many scrum penalties will the All Blacks concede?',
              questionId: 'scrum-pressure',
              status: 'pending',
              type: 'custom-numeric',
            }),
          ],
          pendingCount: 2,
        },
        ruleset,
      ),
    });

    expect(section(model, 'tries').rows).toEqual([
      expect.objectContaining({
        actualLabel: '0',
        itemLabel: 'Springboks',
        predictionLabel: '4',
        status: 'resolved',
      }),
      expect.objectContaining({
        actualLabel: '0',
        itemLabel: 'All Blacks',
        predictionLabel: '3',
        status: 'resolved',
      }),
    ]);
    expect(section(model, 'conversions').rows[0].actualLabel).toBe('0');
    expect(section(model, 'penalty-kicks').rows[0].actualLabel).toBe('0');
    expect(section(model, 'drop-goals').rows[1].actualLabel).toBe('0');
    expect(section(model, 'cards').rows.map((row) => row.actualLabel)).toEqual([
      '0',
      '0',
      '0',
      '0',
    ]);
    expect(section(model, 'first-try').rows[0]).toMatchObject({
      actualLabel: 'Pending',
      deductionLabel: 'Pending',
      status: 'pending',
    });
    expect(section(model, 'scrum-pressure').rows[0]).toMatchObject({
      actualLabel: 'Pending',
      deductionLabel: 'Pending',
      status: 'pending',
    });
  });

  it('groups cards by team while keeping yellow and red rows separate', () => {
    const model = buildPlayerScoreBreakdownViewModel({
      fixture: fixture(),
      scoreProjection: projection({
        components: [
          teamNumericComponent(
            'yellow-cards',
            'Yellow cards',
            numericItem({
              deduction: 200,
              observed: 1,
              prediction: 2,
              team: 'team1',
            }),
            numericItem({
              deduction: 0,
              observed: 0,
              prediction: 0,
              team: 'team2',
            }),
          ),
          teamNumericComponent(
            'red-cards',
            'Red cards',
            numericItem({
              deduction: 0,
              observed: 0,
              prediction: 0,
              team: 'team1',
            }),
            numericItem({
              deduction: null,
              observed: null,
              prediction: 0,
              status: 'pending',
              team: 'team2',
            }),
            'pending',
          ),
        ],
      }),
    });
    const cards = section(model, 'cards');

    expect(cards.rows.map((row) => row.itemLabel)).toEqual([
      'Yellow Cards',
      'Red Cards',
      'Yellow Cards',
      'Red Cards',
    ]);
    expect(cards.rows.map((row) => row.predictionHeading)).toEqual([
      'Springboks predicted',
      'Springboks predicted',
      'All Blacks predicted',
      'All Blacks predicted',
    ]);
    expect(cards.rows[3]).toMatchObject({
      actualLabel: 'Pending',
      deductionLabel: 'Pending',
    });
  });

  it('resolves First Try, Highest-Scoring Half, and Half-Time Leader built-in labels', () => {
    const model = buildPlayerScoreBreakdownViewModel({
      fixture: fixture(),
      scoreProjection: projection({
        components: [
          component({
            deduction: 250,
            items: [
              categoricalItem({
                deduction: 250,
                observed: 'no-tries',
                prediction: 'team1',
              }),
            ],
            label: 'First try',
            questionId: 'first-try',
            type: 'built-in-categorical',
          }),
          component({
            deduction: 250,
            items: [
              categoricalItem({
                deduction: 250,
                observed: 'equal',
                prediction: 'second',
              }),
            ],
            label: 'Highest-scoring half',
            questionId: 'highest-scoring-half',
            type: 'built-in-categorical',
          }),
          component({
            items: [
              categoricalItem({
                deduction: 0,
                observed: 'draw',
                prediction: 'draw',
              }),
            ],
            label: 'Half-time leader',
            questionId: 'half-time-leader',
            type: 'built-in-categorical',
          }),
        ],
      }),
    });

    expect(section(model, 'first-try').rows[0]).toMatchObject({
      actualLabel: 'No Tries Today',
      predictionLabel: 'Springboks',
    });
    expect(section(model, 'highest-scoring-half').rows[0]).toMatchObject({
      actualLabel: 'Equal Points',
      predictionLabel: 'Second Half',
    });
    expect(section(model, 'half-time-leader').rows[0]).toMatchObject({
      actualLabel: 'Draw',
      predictionLabel: 'Draw',
    });
  });

  it('resolves custom Number and custom Choice labels from the fixture ruleset', () => {
    const ruleset = customRuleset();
    const model = buildPlayerScoreBreakdownViewModel({
      fixture: fixture(ruleset),
      scoreProjection: projection(
        {
          components: [
            component({
              deduction: 300,
              items: [
                numericItem({
                  deduction: 300,
                  observed: 6,
                  prediction: 4,
                }),
              ],
              label: 'How many scrum penalties will the All Blacks concede?',
              questionId: 'scrum-pressure',
              type: 'custom-numeric',
            }),
            component({
              deduction: 200,
              items: [
                categoricalItem({
                  deduction: 200,
                  observed: 'maul-blacks',
                  prediction: 'maul-boks',
                }),
              ],
              label: 'Which team scores from a maul first?',
              questionId: 'maul-first',
              type: 'custom-categorical',
            }),
          ],
        },
        ruleset,
      ),
    });

    expect(model.sections.map((candidate) => candidate.id).slice(-2)).toEqual([
      'maul-first',
      'scrum-pressure',
    ]);
    expect(section(model, 'scrum-pressure')).toMatchObject({
      prompt: 'How many scrum penalties will the All Blacks concede?',
      title: 'Custom Question',
    });
    expect(section(model, 'scrum-pressure').rows[0]).toMatchObject({
      actualLabel: '6',
      deductionLabel: '-300',
      predictionLabel: '4',
    });
    expect(section(model, 'maul-first')).toMatchObject({
      prompt: 'Which team scores from a maul first?',
      title: 'Maul Watch',
    });
    expect(section(model, 'maul-first').rows[0]).toMatchObject({
      actualLabel: 'All Blacks',
      deductionLabel: '-200',
      predictionLabel: 'Springboks',
    });
  });

  it('renders custom Void as excluded with no pending count or correctness claim', () => {
    const ruleset = customRuleset();
    const model = buildPlayerScoreBreakdownViewModel({
      fixture: fixture(ruleset),
      scoreProjection: projection(
        {
          components: [
            component({
              deduction: 0,
              items: [
                categoricalItem({
                  deduction: 0,
                  observed: null,
                  prediction: 'maul-boks',
                  status: 'void',
                }),
              ],
              label: 'Which team scores from a maul first?',
              questionId: 'maul-first',
              status: 'void',
              type: 'custom-categorical',
            }),
          ],
          pendingCount: 0,
        },
        ruleset,
      ),
    });
    const customVoid = section(model, 'maul-first');

    expect(customVoid.statusLabel).toBe('Void');
    expect(customVoid.rows[0]).toMatchObject({
      actualLabel: 'Void',
      deductionLabel: 'No deduction',
      status: 'void',
      statusLabel: 'Void',
      voidNote: 'This question was excluded from scoring.',
    });
    expect(model.summaryRows).toContainEqual({
      label: 'Pending predictions',
      tone: 'neutral',
      value: '0',
    });
  });

  it('omits disabled questions and keeps the prediction-journey sequence order', () => {
    const ruleset = withoutQuestions(customRuleset(), ['first-try']);
    const model = buildPlayerScoreBreakdownViewModel({
      fixture: fixture(ruleset),
      scoreProjection: projection(
        {
          components: [
            component({
              items: [
                categoricalItem({
                  deduction: 0,
                  observed: 'team1',
                  prediction: 'team1',
                }),
              ],
              label: 'Match result',
              questionId: 'match-result',
              type: 'built-in-categorical',
            }),
            teamNumericComponent(
              'drop-goals',
              'Drop goals',
              numericItem({
                deduction: 0,
                observed: 0,
                prediction: 0,
                team: 'team1',
              }),
              numericItem({
                deduction: 0,
                observed: 0,
                prediction: 0,
                team: 'team2',
              }),
            ),
            teamNumericComponent(
              'tries',
              'Tries',
              numericItem({
                deduction: 0,
                observed: 4,
                prediction: 4,
                team: 'team1',
              }),
              numericItem({
                deduction: 0,
                observed: 3,
                prediction: 3,
                team: 'team2',
              }),
            ),
            teamNumericComponent(
              'team-score',
              'Team score',
              numericItem({
                deduction: 0,
                observed: 26,
                prediction: 26,
                team: 'team1',
              }),
              numericItem({
                deduction: 0,
                observed: 21,
                prediction: 21,
                team: 'team2',
              }),
            ),
            teamNumericComponent(
              'conversions',
              'Conversions',
              numericItem({
                deduction: 0,
                observed: 3,
                prediction: 3,
                team: 'team1',
              }),
              numericItem({
                deduction: 0,
                observed: 3,
                prediction: 3,
                team: 'team2',
              }),
            ),
            teamNumericComponent(
              'penalty-kicks',
              'Penalty kicks',
              numericItem({
                deduction: 0,
                observed: 0,
                prediction: 0,
                team: 'team1',
              }),
              numericItem({
                deduction: 0,
                observed: 0,
                prediction: 0,
                team: 'team2',
              }),
            ),
            teamNumericComponent(
              'yellow-cards',
              'Yellow cards',
              numericItem({
                deduction: 0,
                observed: 0,
                prediction: 0,
                team: 'team1',
              }),
              numericItem({
                deduction: 0,
                observed: 0,
                prediction: 0,
                team: 'team2',
              }),
            ),
            component({
              items: [
                categoricalItem({
                  deduction: 0,
                  observed: 'equal',
                  prediction: 'equal',
                }),
              ],
              label: 'Highest-scoring half',
              questionId: 'highest-scoring-half',
              type: 'built-in-categorical',
            }),
            component({
              items: [
                categoricalItem({
                  deduction: 0,
                  observed: 'draw',
                  prediction: 'draw',
                }),
              ],
              label: 'Half-time leader',
              questionId: 'half-time-leader',
              type: 'built-in-categorical',
            }),
            component({
              items: [
                numericItem({
                  deduction: 0,
                  observed: 4,
                  prediction: 4,
                }),
              ],
              label: 'How many scrum penalties will the All Blacks concede?',
              questionId: 'scrum-pressure',
              type: 'custom-numeric',
            }),
            component({
              items: [
                categoricalItem({
                  deduction: 0,
                  observed: 'maul-boks',
                  prediction: 'maul-boks',
                }),
              ],
              label: 'Which team scores from a maul first?',
              questionId: 'maul-first',
              type: 'custom-categorical',
            }),
          ],
        },
        ruleset,
      ),
    });

    expect(model.sections.map((candidate) => candidate.id)).toEqual([
      'match-result',
      'tries',
      'conversions',
      'penalty-kicks',
      'drop-goals',
      'team-score',
      'cards',
      'highest-scoring-half',
      'half-time-leader',
      'maul-first',
      'scrum-pressure',
    ]);
    expect(
      model.sections.some((candidate) => candidate.id === 'first-try'),
    ).toBe(false);
  });
});
