import { calculatePlayerFixtureScoreProjection } from '/imports/shared/playerFixtureScores';
import type { PlayerFixtureScoreStatus } from '/imports/shared/playerFixtureScores';
import type {
  BuildFixtureLeaderboardInput,
  FixtureLeaderboardProjection,
  FixtureLeaderboardRow,
  FixtureLeaderboardStatus,
} from './types';
import { FixtureLeaderboardError } from './errors';

const leaderboardError = (code: string, message: string): never => {
  throw new FixtureLeaderboardError(code, message);
};

const statusForFixtureAndResult = (
  input: Pick<BuildFixtureLeaderboardInput, 'fixture' | 'result'>,
): FixtureLeaderboardStatus => {
  if (input.fixture.isCancelled) {
    return 'cancelled';
  }

  if (!input.result) {
    return 'awaiting_result';
  }

  return input.result.observations.matchStatus === 'confirmed'
    ? 'final'
    : 'provisional';
};

const baseProjection = ({
  input,
  rows,
  status,
}: {
  readonly input: BuildFixtureLeaderboardInput;
  readonly rows: readonly FixtureLeaderboardRow[];
  readonly status: FixtureLeaderboardStatus;
}): FixtureLeaderboardProjection => {
  const pagedRows = rows.slice(
    input.page.offset,
    input.page.offset + input.page.limit,
  );
  const currentUserParticipating = input.predictions.some(
    (prediction) => prediction.userId === input.currentUserId,
  );
  const currentUserSortedRow =
    currentUserParticipating && input.currentUserId
      ? rows.find((row) => row.isCurrentUser)
      : undefined;
  const currentUserVisible = currentUserSortedRow
    ? pagedRows.some((row) => row.rowId === currentUserSortedRow.rowId)
    : false;

  return {
    ...(currentUserSortedRow && !currentUserVisible
      ? { currentUserRow: currentUserSortedRow }
      : {}),
    currentUserParticipating,
    fixtureId: input.fixture._id,
    generatedFromScoreStatus: status,
    page: {
      hasMore: input.page.offset + pagedRows.length < rows.length,
      limit: input.page.limit,
      offset: input.page.offset,
      returnedCount: pagedRows.length,
    },
    resultRevision: input.result?.revision ?? null,
    rows: pagedRows,
    status,
    totalEntries: input.predictions.length,
  };
};

const assertScoreStatus = (
  actual: PlayerFixtureScoreStatus,
  expected: FixtureLeaderboardStatus,
): void => {
  if (actual !== expected) {
    leaderboardError(
      'leaderboard-score-status-mismatch',
      'Fixture leaderboard score status is inconsistent.',
    );
  }
};

const requireLeaderboardScore = (score: number | null): number => {
  if (score === null) {
    leaderboardError(
      'leaderboard-score-unavailable',
      'Fixture leaderboard score is unavailable.',
    );
  }

  return score as number;
};

const assignStandardCompetitionPlaces = (
  sortedRows: readonly Omit<FixtureLeaderboardRow, 'place'>[],
): readonly FixtureLeaderboardRow[] => {
  let previousScore: number | null = null;
  let currentPlace = 0;

  return sortedRows.map((row, index) => {
    if (previousScore === null || row.score !== previousScore) {
      currentPlace = index + 1;
      previousScore = row.score;
    }

    return {
      ...row,
      place: currentPlace,
    };
  });
};

export const buildFixtureLeaderboard = (
  input: BuildFixtureLeaderboardInput,
): FixtureLeaderboardProjection => {
  const status = statusForFixtureAndResult(input);
  const identityByUserId = new Map(
    input.playerIdentities.map((identity) => [identity.userId, identity]),
  );

  if (status === 'awaiting_result' || status === 'cancelled') {
    for (const prediction of input.predictions) {
      calculatePlayerFixtureScoreProjection({
        fixture: input.fixture,
        prediction,
        result: input.result,
      });
    }

    return baseProjection({
      input,
      rows: [],
      status,
    });
  }

  const unplacedRows = input.predictions.map((prediction) => {
    const identity = identityByUserId.get(prediction.userId);

    const rowIdentity =
      identity ??
      leaderboardError(
        'leaderboard-player-label-missing',
        'Fixture leaderboard player label data is incomplete.',
      );

    const scoreProjection = calculatePlayerFixtureScoreProjection({
      fixture: input.fixture,
      prediction,
      result: input.result,
    });

    assertScoreStatus(scoreProjection.status, status);
    const score = requireLeaderboardScore(scoreProjection.currentScore);

    return {
      displayLabel: rowIdentity.displayLabel,
      isCurrentUser: prediction.userId === input.currentUserId,
      pendingCount: status === 'final' ? 0 : scoreProjection.pendingCount,
      rowId: rowIdentity.rowId,
      score,
    };
  });

  const sortedRows = [...unplacedRows].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.rowId.localeCompare(right.rowId);
  });

  return baseProjection({
    input,
    rows: assignStandardCompetitionPlaces(sortedRows),
    status,
  });
};
