import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';

import { Fixtures } from '/imports/api/fixtures/collection';
import { signInPathForReturnTo } from '/imports/shared/auth/redirects';
import {
  DEFAULT_FIXTURE_LEADERBOARD_LIMIT,
  FIXTURE_LEADERBOARD_METHODS,
  MAX_FIXTURE_LEADERBOARD_LIMIT,
} from '/imports/shared/fixtureLeaderboards/methods';
import type {
  FixtureLeaderboardProjection,
  FixtureLeaderboardRow,
} from '/imports/shared/fixtureLeaderboards/types';
import {
  FIXTURE_PUBLICATIONS,
  type FixtureDocument,
} from '/imports/shared/fixtures';
import { callMeteorMethod } from '../auth/methodCall';
import { useAuthState } from '../auth/useAuthState';
import { SignInRequiredState } from '../components/AuthStates';
import { AppLink } from '../components/AppLink';
import {
  PlayerEmptyState,
  PlayerErrorState,
  PlayerLoadingState,
  PlayerPage,
  PlayerPageHeader,
  RugbyRoosterPersonality,
  StatusBadge,
  type RugbyRoosterMood,
} from '../components/player';
import {
  fixtureDetailPath,
  fixturePredictionPath,
  fixtureScoreBreakdownPath,
  fixturePlayerStatusLabel,
  fixturePlayerStatusTone,
  kickoffLabel,
} from '../fixtures/fixtureUi';

const refreshIntervalMs = 15_000;
const pageSize = DEFAULT_FIXTURE_LEADERBOARD_LIMIT;
const refreshLimitCap = MAX_FIXTURE_LEADERBOARD_LIMIT;

const fixtureIdFromLocation = (): string =>
  window.location.pathname.split('/').filter(Boolean)[1] ?? '';

const formatScore = (score: number): string => score.toLocaleString('en-US');

const predictionCountLabel = (count: number): string =>
  `${count.toLocaleString('en-US')} ${
    count === 1 ? 'prediction' : 'predictions'
  } submitted`;

const pendingLabel = (count: number): string =>
  `${count.toLocaleString('en-US')} ${count === 1 ? 'pending' : 'pending'}`;

const errorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const message = (error as { readonly message?: unknown }).message;

    if (typeof message === 'string') {
      return message;
    }
  }

  return 'The leaderboard could not be loaded.';
};

const mergeLeaderboardPage = (
  previous: FixtureLeaderboardProjection,
  next: FixtureLeaderboardProjection,
): FixtureLeaderboardProjection => {
  if (
    previous.fixtureId !== next.fixtureId ||
    previous.status !== next.status ||
    previous.resultRevision !== next.resultRevision ||
    next.page.offset !== previous.rows.length
  ) {
    return next;
  }

  const seenRowIds = new Set(previous.rows.map((row) => row.rowId));
  const rows = [
    ...previous.rows,
    ...next.rows.filter((row) => !seenRowIds.has(row.rowId)),
  ];
  const currentUserVisible = rows.some((row) => row.isCurrentUser);
  const currentUserRow = next.currentUserRow ?? previous.currentUserRow;
  const { currentUserRow: _nextCurrentUserRow, ...nextWithoutCurrentUserRow } =
    next;
  const merged = {
    ...nextWithoutCurrentUserRow,
    page: {
      ...next.page,
      offset: 0,
      returnedCount: rows.length,
    },
    rows,
  };

  return currentUserVisible || !currentUserRow
    ? merged
    : {
        ...merged,
        currentUserRow,
      };
};

const LeaderboardShell = ({ children }: { readonly children: ReactNode }) => (
  <PlayerPage>{children}</PlayerPage>
);

type ScopedLeaderboardError = {
  readonly fixtureId: string;
  readonly message: string;
};

export const FixtureLeaderboardPage = () => {
  const fixtureId = fixtureIdFromLocation();
  const auth = useAuthState();
  const requestId = useRef(0);
  const leaderboardRef = useRef<FixtureLeaderboardProjection | null>(null);
  const [leaderboard, setLeaderboard] =
    useState<FixtureLeaderboardProjection | null>(null);
  const [initialError, setInitialError] =
    useState<ScopedLeaderboardError | null>(null);
  const [refreshError, setRefreshError] =
    useState<ScopedLeaderboardError | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { fixture, isConnected, isReady } = useTracker(() => {
    const handle = Meteor.subscribe(
      FIXTURE_PUBLICATIONS.publicDetail,
      fixtureId,
    );

    return {
      fixture: Fixtures.findOne({
        _id: fixtureId,
        visibility: 'published',
      }),
      isConnected: Meteor.status().connected,
      isReady: handle.ready(),
    };
  }, [fixtureId]);
  const hasFixture = Boolean(fixture);
  const activeLeaderboard =
    leaderboard?.fixtureId === fixtureId ? leaderboard : null;
  const activeInitialError =
    initialError?.fixtureId === fixtureId ? initialError.message : null;
  const activeRefreshError =
    refreshError?.fixtureId === fixtureId ? refreshError.message : null;
  const canRequestLeaderboard =
    auth.isAuthenticated && auth.isVerified && isReady && hasFixture;

  useEffect(() => {
    leaderboardRef.current = activeLeaderboard;
  }, [activeLeaderboard]);

  const loadLeaderboard = useCallback(
    async ({
      append = false,
      limit,
      offset,
      quiet = false,
    }: {
      readonly append?: boolean;
      readonly limit: number;
      readonly offset: number;
      readonly quiet?: boolean;
    }) => {
      const currentRequestId = requestId.current + 1;

      requestId.current = currentRequestId;

      if (append) {
        setIsLoadingMore(true);
      } else if (leaderboardRef.current || quiet) {
        setIsRefreshing(true);
      } else {
        setIsInitialLoading(true);
      }

      try {
        const next = await callMeteorMethod<FixtureLeaderboardProjection>(
          FIXTURE_LEADERBOARD_METHODS.getFixtureLeaderboard,
          {
            fixtureId,
            limit,
            offset,
          },
        );

        if (requestId.current !== currentRequestId) {
          return;
        }

        setLeaderboard((previous) =>
          append && previous?.fixtureId === next.fixtureId
            ? mergeLeaderboardPage(previous, next)
            : next,
        );
        setInitialError((previous) =>
          previous?.fixtureId === fixtureId ? null : previous,
        );
        setRefreshError((previous) =>
          previous?.fixtureId === fixtureId ? null : previous,
        );
      } catch (error) {
        if (requestId.current !== currentRequestId) {
          return;
        }

        const message = errorMessage(error);

        if (leaderboardRef.current) {
          setRefreshError({ fixtureId, message });
        } else {
          setInitialError({ fixtureId, message });
        }
      } finally {
        if (requestId.current === currentRequestId) {
          setIsInitialLoading(false);
          setIsRefreshing(false);
          setIsLoadingMore(false);
        }
      }
    },
    [fixtureId],
  );

  useEffect(() => {
    if (!canRequestLeaderboard) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadLeaderboard({
        limit: pageSize,
        offset: 0,
      });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [canRequestLeaderboard, fixtureId, loadLeaderboard]);

  useEffect(() => {
    if (
      !activeLeaderboard ||
      activeLeaderboard.status === 'final' ||
      activeLeaderboard.status === 'cancelled'
    ) {
      return;
    }

    const refreshLoadedWindow = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      void loadLeaderboard({
        limit: Math.min(
          Math.max(activeLeaderboard.rows.length, pageSize),
          refreshLimitCap,
        ),
        offset: 0,
        quiet: true,
      });
    };
    const interval = window.setInterval(refreshLoadedWindow, refreshIntervalMs);

    return () => window.clearInterval(interval);
  }, [activeLeaderboard, loadLeaderboard]);

  const fixtureTitle = fixture
    ? `${fixture.team1DisplayName} vs ${fixture.team2DisplayName}`
    : 'Fixture leaderboard';
  const loadedRows = activeLeaderboard?.rows.length ?? 0;
  const canLoadMore = Boolean(activeLeaderboard?.page.hasMore);
  const refreshLimit = Math.min(
    Math.max(loadedRows, pageSize),
    refreshLimitCap,
  );

  if (!isConnected && !isReady) {
    return (
      <LeaderboardShell>
        <PlayerErrorState
          body="Reconnect to Rugby Rooster to load this fixture leaderboard."
          title="Leaderboard is unavailable right now"
        />
      </LeaderboardShell>
    );
  }

  if (!isReady || auth.isLoading) {
    return (
      <LeaderboardShell>
        <PlayerLoadingState label="Loading leaderboard" />
      </LeaderboardShell>
    );
  }

  if (!fixture) {
    return (
      <LeaderboardShell>
        <PlayerEmptyState
          action={
            <AppLink
              className="focus-ring rr-button rr-button-primary"
              to="/games"
            >
              Back to games
            </AppLink>
          }
          body="Draft fixtures and unknown fixture links are not publicly available."
          mood="thinking"
          title="Fixture not found"
        />
      </LeaderboardShell>
    );
  }

  if (!auth.isAuthenticated || !auth.isVerified) {
    return (
      <LeaderboardShell>
        <LeaderboardFixtureHeader fixture={fixture} />
        <SignInRequiredState
          currentPath={window.location.pathname}
          message="Sign in with the existing email-link flow to view this fixture leaderboard."
          signInPath={signInPathForReturnTo(window.location.pathname)}
          title={`Leaderboard for ${fixtureTitle}`}
        />
      </LeaderboardShell>
    );
  }

  return (
    <LeaderboardShell>
      <LeaderboardFixtureHeader fixture={fixture} />

      {(isInitialLoading || (canRequestLeaderboard && !activeInitialError)) &&
      !activeLeaderboard ? (
        <PlayerLoadingState label="Loading leaderboard" />
      ) : null}

      {activeInitialError && !activeLeaderboard ? (
        <PlayerErrorState
          action={
            <button
              className="focus-ring rr-button rr-button-danger"
              type="button"
              onClick={() =>
                void loadLeaderboard({
                  limit: pageSize,
                  offset: 0,
                })
              }
            >
              Retry
            </button>
          }
          body={activeInitialError}
          title="Leaderboard unavailable"
        />
      ) : null}

      {activeLeaderboard ? (
        <>
          <LeaderboardStatusPanel
            isRefreshing={isRefreshing}
            leaderboard={activeLeaderboard}
            refreshError={activeRefreshError}
            onRefresh={() =>
              void loadLeaderboard({
                limit: refreshLimit,
                offset: 0,
              })
            }
          />

          <LeaderboardRows leaderboard={activeLeaderboard} />

          {activeLeaderboard.currentUserRow ? (
            <section className="rr-surface rr-surface--raised">
              <h2 className="rr-section-eyebrow">Your position</h2>
              <div className="mt-4">
                <MobileLeaderboardRow
                  rowIndex={0}
                  row={activeLeaderboard.currentUserRow}
                  showPending={activeLeaderboard.status === 'provisional'}
                  status={activeLeaderboard.status}
                />
              </div>
            </section>
          ) : null}

          {canLoadMore ? (
            <div className="flex justify-center">
              <button
                className="focus-ring rr-button rr-button-secondary w-full sm:w-auto"
                disabled={isLoadingMore}
                type="button"
                onClick={() =>
                  void loadLeaderboard({
                    append: true,
                    limit: pageSize,
                    offset: activeLeaderboard.rows.length,
                  })
                }
              >
                {isLoadingMore ? 'Loading more' : 'Load more'}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </LeaderboardShell>
  );
};

const LeaderboardFixtureHeader = ({
  fixture,
}: {
  readonly fixture: FixtureDocument;
}) => (
  <PlayerPageHeader
    actions={
      <>
        <AppLink
          className="focus-ring rr-button rr-button-secondary"
          to={fixtureDetailPath(fixture._id)}
        >
          Back to fixture
        </AppLink>
        <AppLink
          className="focus-ring rr-button rr-button-secondary"
          to={fixturePredictionPath(fixture._id)}
        >
          Prediction
        </AppLink>
      </>
    }
    eyebrow={
      <>
        <StatusBadge
          label={fixturePlayerStatusLabel(fixture)}
          tone={fixturePlayerStatusTone(fixture)}
        />
        <span>{fixture.competitionDisplayName}</span>
      </>
    }
    meta={<span>Kickoff: {kickoffLabel(fixture)}</span>}
    subtitle="Fixture standings rank saved predictions only. Ties share the same place."
    title={
      <>
        {fixture.team1DisplayName} <span className="rr-versus">vs</span>{' '}
        {fixture.team2DisplayName}
      </>
    }
  />
);

const LeaderboardStatusPanel = ({
  isRefreshing,
  leaderboard,
  onRefresh,
  refreshError,
}: {
  readonly isRefreshing: boolean;
  readonly leaderboard: FixtureLeaderboardProjection;
  readonly onRefresh: () => void;
  readonly refreshError: string | null;
}) => {
  const isAwaiting = leaderboard.status === 'awaiting_result';
  const isProvisional = leaderboard.status === 'provisional';
  const isFinal = leaderboard.status === 'final';
  const isCancelled = leaderboard.status === 'cancelled';
  const title = isProvisional
    ? 'If it ended now'
    : isFinal
      ? 'Final leaderboard'
      : 'Leaderboard';
  const body = isAwaiting
    ? "Scoring hasn't started yet. The leaderboard will appear once match results start coming in."
    : isProvisional
      ? 'Scores and positions can still change.'
      : isFinal
        ? 'Official fixture scores are confirmed.'
        : 'This fixture was cancelled, so no leaderboard score or rank is assigned.';
  const currentUserFinalRow =
    isFinal && leaderboard.currentUserRow
      ? leaderboard.currentUserRow
      : isFinal
        ? leaderboard.rows.find((row) => row.isCurrentUser)
        : null;
  const currentUserWon = currentUserFinalRow?.place === 1;
  const currentUserHadRoughFinal = Boolean(
    currentUserFinalRow && currentUserFinalRow.score <= 8000,
  );
  const currentUserHadZeroFinal = Boolean(
    currentUserFinalRow && currentUserFinalRow.score === 0,
  );
  const mood: RugbyRoosterMood = isAwaiting
    ? 'thinking'
    : isProvisional
      ? 'nervous'
      : isFinal
        ? currentUserWon
          ? 'celebrating'
          : currentUserHadZeroFinal
            ? 'superCooked'
            : currentUserHadRoughFinal
              ? 'disappointed'
              : 'confident'
        : 'disappointed';
  const personalityMessage = isAwaiting
    ? 'Hmm...'
    : isProvisional
      ? 'This could move.'
      : isFinal
        ? currentUserWon
          ? 'You knew your rugby.'
          : currentUserHadZeroFinal
            ? "We don't talk about this one."
            : currentUserHadRoughFinal
              ? 'That one hurt.'
              : 'Final whistle.'
        : 'Match called off.';

  return (
    <section className="rr-surface rr-surface--raised">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="rr-section-eyebrow">{title}</p>
          <h2 className="rr-section-title mt-2">
            {predictionCountLabel(leaderboard.totalEntries)}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-rooster-muted">
            {body}
          </p>
          {leaderboard.currentUserParticipating ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-sm font-black text-rooster-ink">
                {"You're in."}
              </p>
              <AppLink
                className="focus-ring rr-button rr-button-secondary"
                to={fixtureScoreBreakdownPath(leaderboard.fixtureId)}
              >
                View my score
              </AppLink>
            </div>
          ) : null}
        </div>
        <RugbyRoosterPersonality
          message={personalityMessage}
          mood={mood}
          size="compact"
        />
        {!isFinal && !isCancelled ? (
          <button
            className="focus-ring rr-button rr-button-secondary"
            disabled={isRefreshing}
            type="button"
            onClick={onRefresh}
          >
            {isRefreshing ? 'Refreshing' : 'Refresh'}
          </button>
        ) : null}
      </div>
      {refreshError ? (
        <p
          className="mt-4 rounded-md border border-rooster-red/30 bg-rooster-red/10 p-3 text-sm font-bold text-rooster-ink"
          role="status"
        >
          Refresh failed. {refreshError}
        </p>
      ) : null}
    </section>
  );
};

const LeaderboardRows = ({
  leaderboard,
}: {
  readonly leaderboard: FixtureLeaderboardProjection;
}) => {
  const showPending = leaderboard.status === 'provisional';

  if (
    leaderboard.status === 'awaiting_result' ||
    leaderboard.status === 'cancelled'
  ) {
    return null;
  }

  if (leaderboard.rows.length === 0) {
    return (
      <PlayerEmptyState
        body="No saved predictions are on this fixture leaderboard yet."
        mood="thinking"
        title="No leaderboard rows yet"
      />
    );
  }

  return (
    <section className="rr-surface rr-surface--raised p-0 sm:p-5">
      <div className="hidden sm:block">
        <table className="w-full table-fixed border-collapse text-left">
          <thead>
            <tr className="border-b border-rooster-line text-xs font-black uppercase text-rooster-muted">
              <th className="w-20 px-3 py-3">Place</th>
              <th className="px-3 py-3">Player</th>
              <th className="w-32 px-3 py-3 text-right">
                {leaderboard.status === 'final' ? 'Final score' : 'Score'}
              </th>
              {showPending ? (
                <th className="w-32 px-3 py-3 text-right">Pending</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {leaderboard.rows.map((row, index) => (
              <DesktopLeaderboardRow
                key={row.rowId}
                rowIndex={index}
                row={row}
                showPending={showPending}
                status={leaderboard.status}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 p-3 sm:hidden">
        {leaderboard.rows.map((row, index) => (
          <MobileLeaderboardRow
            key={row.rowId}
            rowIndex={index}
            row={row}
            showPending={showPending}
            status={leaderboard.status}
          />
        ))}
      </div>
    </section>
  );
};

const rowClassName = ({
  isCurrentUser,
  isWinner,
  rowIndex,
}: {
  readonly isCurrentUser: boolean;
  readonly isWinner: boolean;
  readonly rowIndex: number;
}): string =>
  [
    'rr-leaderboard-row',
    rowIndex % 2 === 0
      ? 'rr-leaderboard-row--green'
      : 'rr-leaderboard-row--gold',
    isCurrentUser ? 'rr-leaderboard-row--current-user' : '',
    isWinner ? 'rr-leaderboard-row--winner' : '',
  ].join(' ');

const CurrentUserBadge = () => (
  <span className="inline-flex rounded-full border border-rooster-red/30 bg-white px-2 py-0.5 text-[0.7rem] font-black uppercase text-rooster-red">
    YOU
  </span>
);

const DesktopLeaderboardRow = ({
  rowIndex,
  row,
  showPending,
  status,
}: {
  readonly rowIndex: number;
  readonly row: FixtureLeaderboardRow;
  readonly showPending: boolean;
  readonly status: FixtureLeaderboardProjection['status'];
}) => {
  const isWinner = status === 'final' && row.place === 1;

  return (
    <tr
      className={[
        'border-b text-sm last:border-b-0',
        rowClassName({
          isCurrentUser: row.isCurrentUser,
          isWinner,
          rowIndex,
        }),
      ].join(' ')}
    >
      <td className="px-3 py-3 text-lg font-black text-rooster-ink">
        {row.place}
      </td>
      <td className="px-3 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="break-words font-black text-rooster-ink">
            {row.displayLabel}
          </span>
          {row.isCurrentUser ? <CurrentUserBadge /> : null}
          {isWinner ? (
            <span className="inline-flex rounded-full border border-rooster-sun/70 bg-white px-2 py-0.5 text-[0.7rem] font-black uppercase text-rooster-ink">
              Winner
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-3 text-right text-base font-black text-rooster-ink">
        {formatScore(row.score)}
      </td>
      {showPending ? (
        <td className="px-3 py-3 text-right text-sm font-bold text-rooster-muted">
          {pendingLabel(row.pendingCount)}
        </td>
      ) : null}
    </tr>
  );
};

const MobileLeaderboardRow = ({
  rowIndex,
  row,
  showPending,
  status = 'provisional',
}: {
  readonly rowIndex: number;
  readonly row: FixtureLeaderboardRow;
  readonly showPending: boolean;
  readonly status?: FixtureLeaderboardProjection['status'];
}) => {
  const isWinner = status === 'final' && row.place === 1;

  return (
    <article
      className={[
        'rounded-md border p-3',
        rowClassName({
          isCurrentUser: row.isCurrentUser,
          isWinner,
          rowIndex,
        }),
      ].join(' ')}
    >
      <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3">
        <p className="text-xl font-black text-rooster-ink">#{row.place}</p>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-words text-sm font-black text-rooster-ink">
              {row.displayLabel}
            </p>
            {row.isCurrentUser ? <CurrentUserBadge /> : null}
            {isWinner ? (
              <span className="inline-flex rounded-full border border-rooster-sun/70 bg-white px-2 py-0.5 text-[0.7rem] font-black uppercase text-rooster-ink">
                Winner
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-lg font-black text-rooster-ink">
            {formatScore(row.score)} pts
          </p>
          {showPending ? (
            <p className="mt-1 text-xs font-bold uppercase text-rooster-muted">
              {pendingLabel(row.pendingCount)}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
};
