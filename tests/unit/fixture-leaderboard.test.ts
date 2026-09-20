import { describe, expect, it } from 'vitest';

import {
  buildFixtureLeaderboard,
  type FixtureLeaderboardFixtureInput,
  type FixtureLeaderboardPlayerIdentity,
  type FixtureLeaderboardPredictionInput,
  type FixtureLeaderboardResultInput,
} from '../../imports/shared/fixtureLeaderboards';
import {
  defaultRuleset,
  type FixtureObservations,
  type FixturePrediction,
  type ObservedValue,
  type RulesetIdentity,
  type RulesetSnapshot,
} from '../../imports/shared/scoring';

const identity = (ruleset: RulesetSnapshot): RulesetIdentity => ({
  id: ruleset.id,
  schemaVersion: ruleset.schemaVersion,
  version: ruleset.version,
});

const observed = <T>(
  value: T,
  status: 'provisional' | 'confirmed' = 'confirmed',
): ObservedValue<T> => ({ status, value });

const pending = <T>(): ObservedValue<T> => ({ status: 'pending' });

const fixture = (
  overrides: Partial<FixtureLeaderboardFixtureInput> = {},
): FixtureLeaderboardFixtureInput => ({
  _id: 'fixture-011b',
  isCancelled: false,
  rulesetSnapshot: defaultRuleset,
  ...overrides,
});

const prediction = (yellowCards: number): FixturePrediction => ({
  firstTry: 'team1',
  halfTimeLeader: 'team1',
  highestScoringHalf: 'first',
  matchResult: 'team1',
  team1: {
    conversions: 2,
    dropGoals: 0,
    penaltyKicks: 1,
    redCards: 0,
    tries: 2,
    yellowCards,
  },
  team2: {
    conversions: 1,
    dropGoals: 0,
    penaltyKicks: 0,
    redCards: 0,
    tries: 1,
    yellowCards: 0,
  },
});

const predictionEntry = (
  userId: string,
  yellowCards: number,
  overrides: Partial<FixtureLeaderboardPredictionInput> = {},
): FixtureLeaderboardPredictionInput => ({
  fixtureId: 'fixture-011b',
  prediction: prediction(yellowCards),
  revision: 1,
  ruleset: identity(defaultRuleset),
  userId,
  ...overrides,
});

const observations = ({
  matchStatus = 'confirmed',
  redCardsPending = false,
  team1YellowCards = 0,
}: {
  readonly matchStatus?: 'provisional' | 'confirmed';
  readonly redCardsPending?: boolean;
  readonly team1YellowCards?: number;
} = {}): FixtureObservations => ({
  firstTry: observed('team1', matchStatus),
  halfTimeLeader: observed('team1', matchStatus),
  highestScoringHalf: observed('first', matchStatus),
  matchStatus,
  team1: {
    conversions: observed(2, matchStatus),
    dropGoals: observed(0, matchStatus),
    penaltyKicks: observed(1, matchStatus),
    redCards: redCardsPending ? pending() : observed(0, matchStatus),
    tries: observed(2, matchStatus),
    yellowCards: observed(team1YellowCards, matchStatus),
  },
  team2: {
    conversions: observed(1, matchStatus),
    dropGoals: observed(0, matchStatus),
    penaltyKicks: observed(0, matchStatus),
    redCards: redCardsPending ? pending() : observed(0, matchStatus),
    tries: observed(1, matchStatus),
    yellowCards: observed(0, matchStatus),
  },
});

const result = (
  source: FixtureObservations,
  overrides: Partial<FixtureLeaderboardResultInput> = {},
): FixtureLeaderboardResultInput => ({
  fixtureId: 'fixture-011b',
  observations: source,
  revision: 4,
  ruleset: identity(defaultRuleset),
  ...overrides,
});

const identitiesFor = (
  predictions: readonly FixtureLeaderboardPredictionInput[],
  currentUserId?: string,
): readonly FixtureLeaderboardPlayerIdentity[] =>
  predictions.map((entry) => ({
    displayLabel:
      entry.userId === currentUserId ? 'You' : `Player ${entry.userId}`,
    rowId: `row-${entry.userId}`,
    userId: entry.userId,
  }));

const leaderboard = ({
  currentUserId,
  fixtureInput = fixture(),
  limit = 50,
  offset = 0,
  predictions,
  resultInput = result(observations()),
}: {
  readonly currentUserId?: string;
  readonly fixtureInput?: FixtureLeaderboardFixtureInput;
  readonly limit?: number;
  readonly offset?: number;
  readonly predictions: readonly FixtureLeaderboardPredictionInput[];
  readonly resultInput?: FixtureLeaderboardResultInput | null;
}) =>
  buildFixtureLeaderboard({
    currentUserId,
    fixture: fixtureInput,
    page: {
      limit,
      offset,
    },
    playerIdentities: identitiesFor(predictions, currentUserId),
    predictions,
    result: resultInput,
  });

describe('fixture leaderboard projection', () => {
  it('sorts by score descending and assigns shared places as 1,2,2,4', () => {
    const projection = leaderboard({
      predictions: [
        predictionEntry('d', 2),
        predictionEntry('b', 1),
        predictionEntry('a', 0),
        predictionEntry('c', 1),
      ],
    });

    expect(projection.rows.map((row) => row.score)).toEqual([
      10_000, 9_800, 9_800, 9_600,
    ]);
    expect(projection.rows.map((row) => row.place)).toEqual([1, 2, 2, 4]);
    expect(projection.rows.map((row) => row.rowId)).toEqual([
      'row-a',
      'row-b',
      'row-c',
      'row-d',
    ]);
  });

  it('assigns shared first place as 1,1,3', () => {
    const projection = leaderboard({
      predictions: [
        predictionEntry('c', 1),
        predictionEntry('b', 0),
        predictionEntry('a', 0),
      ],
    });

    expect(projection.rows.map((row) => row.score)).toEqual([
      10_000, 10_000, 9_800,
    ]);
    expect(projection.rows.map((row) => row.place)).toEqual([1, 1, 3]);
  });

  it('keeps multiple zero-score entries and shares their place', () => {
    const projection = leaderboard({
      predictions: [
        predictionEntry('a', 0),
        predictionEntry('b', 60),
        predictionEntry('c', 70),
      ],
    });

    expect(projection.rows.map((row) => row.score)).toEqual([10_000, 0, 0]);
    expect(projection.rows.map((row) => row.place)).toEqual([1, 2, 2]);
  });

  it('paginates after global ranking and preserves total entry metadata', () => {
    const projection = leaderboard({
      limit: 2,
      offset: 1,
      predictions: [
        predictionEntry('d', 2),
        predictionEntry('b', 1),
        predictionEntry('a', 0),
        predictionEntry('c', 1),
      ],
    });

    expect(projection.totalEntries).toBe(4);
    expect(projection.page).toEqual({
      hasMore: true,
      limit: 2,
      offset: 1,
      returnedCount: 2,
    });
    expect(projection.rows.map((row) => row.place)).toEqual([2, 2]);
    expect(projection.rows.map((row) => row.rowId)).toEqual(['row-b', 'row-c']);
  });

  it('marks the current user when they are inside the loaded page', () => {
    const projection = leaderboard({
      currentUserId: 'b',
      predictions: [
        predictionEntry('a', 0),
        predictionEntry('b', 1),
        predictionEntry('c', 2),
      ],
    });
    const currentUserRow = projection.rows.find((row) => row.isCurrentUser);

    expect(currentUserRow).toMatchObject({
      displayLabel: 'You',
      place: 2,
      score: 9_800,
    });
    expect(projection.currentUserRow).toBeUndefined();
    expect(projection.currentUserParticipating).toBe(true);
  });

  it('returns the current user row separately when outside the page', () => {
    const projection = leaderboard({
      currentUserId: 'd',
      limit: 1,
      predictions: [
        predictionEntry('a', 0),
        predictionEntry('b', 1),
        predictionEntry('c', 1),
        predictionEntry('d', 2),
      ],
    });

    expect(projection.rows).toHaveLength(1);
    expect(projection.rows[0].isCurrentUser).toBe(false);
    expect(projection.currentUserRow).toMatchObject({
      displayLabel: 'You',
      place: 4,
      score: 9_600,
    });
  });

  it('returns awaiting-result metadata without fake scores or ranks', () => {
    const projection = leaderboard({
      currentUserId: 'a',
      predictions: [predictionEntry('a', 0), predictionEntry('b', 1)],
      resultInput: null,
    });

    expect(projection.status).toBe('awaiting_result');
    expect(projection.resultRevision).toBeNull();
    expect(projection.rows).toEqual([]);
    expect(projection.currentUserRow).toBeUndefined();
    expect(projection.currentUserParticipating).toBe(true);
    expect(projection.totalEntries).toBe(2);
  });

  it('returns cancelled metadata without score rows', () => {
    const projection = leaderboard({
      fixtureInput: fixture({ isCancelled: true }),
      predictions: [predictionEntry('a', 0), predictionEntry('b', 1)],
      resultInput: result(observations({ matchStatus: 'provisional' })),
    });

    expect(projection.status).toBe('cancelled');
    expect(projection.rows).toEqual([]);
    expect(projection.totalEntries).toBe(2);
  });

  it('uses provisional currentScore, pendingCount, and result revision', () => {
    const projection = leaderboard({
      predictions: [predictionEntry('a', 0), predictionEntry('b', 1)],
      resultInput: result(
        observations({
          matchStatus: 'provisional',
          redCardsPending: true,
        }),
        { revision: 9 },
      ),
    });

    expect(projection.status).toBe('provisional');
    expect(projection.generatedFromScoreStatus).toBe('provisional');
    expect(projection.resultRevision).toBe(9);
    expect(projection.rows.map((row) => row.pendingCount)).toEqual([1, 1]);
    expect(projection.rows.map((row) => row.score)).toEqual([10_000, 9_800]);
  });

  it('uses final scores and removes pending indicators for final results', () => {
    const projection = leaderboard({
      predictions: [
        predictionEntry('a', 0),
        predictionEntry('b', 0),
        predictionEntry('c', 1),
      ],
      resultInput: result(observations({ matchStatus: 'confirmed' })),
    });

    expect(projection.status).toBe('final');
    expect(projection.generatedFromScoreStatus).toBe('final');
    expect(projection.rows.map((row) => row.pendingCount)).toEqual([0, 0, 0]);
    expect(projection.rows.map((row) => row.place)).toEqual([1, 1, 3]);
  });

  it('recalculates places across result corrections without changing predictions', () => {
    const predictions = [predictionEntry('a', 0), predictionEntry('b', 1)];
    const before = leaderboard({
      predictions,
      resultInput: result(
        observations({
          matchStatus: 'provisional',
          team1YellowCards: 0,
        }),
        { revision: 4 },
      ),
    });
    const after = leaderboard({
      predictions,
      resultInput: result(
        observations({
          matchStatus: 'provisional',
          team1YellowCards: 1,
        }),
        { revision: 5 },
      ),
    });

    expect(before.resultRevision).toBe(4);
    expect(after.resultRevision).toBe(5);
    expect(before.rows.map((row) => row.rowId)).toEqual(['row-a', 'row-b']);
    expect(after.rows.map((row) => row.rowId)).toEqual(['row-b', 'row-a']);
    expect(
      predictions.map((entry) => entry.prediction.team1.yellowCards),
    ).toEqual([0, 1]);
  });

  it('ranks roughly 1,000 entries with bounded top page and deterministic output', () => {
    const predictions = Array.from({ length: 1_000 }, (_, index) =>
      predictionEntry(`user-${String(index).padStart(4, '0')}`, index % 5),
    );
    const input = {
      currentUserId: 'user-0999',
      limit: 50,
      predictions,
    };
    const first = leaderboard(input);
    const second = leaderboard(input);

    expect(first.totalEntries).toBe(1_000);
    expect(first.rows).toHaveLength(50);
    expect(first.rows.every((row) => row.place === 1)).toBe(true);
    expect(first.page.hasMore).toBe(true);
    expect(first.currentUserRow).toMatchObject({
      place: 801,
      score: 9_200,
    });
    expect(first).toEqual(second);
  });
});
