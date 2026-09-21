import { useEffect, useMemo, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';

import { Fixtures } from '/imports/api/fixtures/collection';
import {
  DEFAULT_PUBLIC_FIXTURE_LIMIT,
  FIXTURE_PUBLICATIONS,
  type FixtureDocument,
  type FixtureListMode,
} from '/imports/shared/fixtures';
import { AppLink } from '../components/AppLink';
import {
  PlayerEmptyState,
  PlayerErrorState,
  PlayerLoadingState,
  PlayerPage,
  PlayerPageHeader,
  RugbyRoosterPersonality,
  StatusBadge,
} from '../components/player';
import {
  fixtureDetailPath,
  fixturePlayerStatusLabel,
  fixturePlayerStatusTone,
  fixturePredictionPath,
  kickoffLabel,
} from '../fixtures/fixtureUi';

const refreshIntervalMs = 30_000;

interface FixturePageCursor {
  readonly fixtureId: string;
  readonly scheduledKickoffAt: string;
}

interface FixturePaginationState {
  readonly cursor: FixturePageCursor | null;
  readonly previousCursors: readonly (FixturePageCursor | null)[];
}

const firstPageState = (): FixturePaginationState => ({
  cursor: null,
  previousCursors: [],
});

const cursorFromFixture = (fixture: FixtureDocument): FixturePageCursor => ({
  fixtureId: fixture._id,
  scheduledKickoffAt: fixture.scheduledKickoffAt.toISOString(),
});

const publicFixtureSelector = (
  mode: FixtureListMode,
  boundary: string,
  cursor: FixturePageCursor | null,
): Record<string, unknown> => {
  const boundaryDate = new Date(boundary);
  const baseSelector = {
    scheduledKickoffAt:
      mode === 'upcoming' ? { $gte: boundaryDate } : { $lt: boundaryDate },
    visibility: 'published' as const,
  };

  if (!cursor) {
    return baseSelector;
  }

  const cursorDate = new Date(cursor.scheduledKickoffAt);
  const cursorSelector =
    mode === 'upcoming'
      ? {
          $or: [
            {
              scheduledKickoffAt: {
                $gt: cursorDate,
              },
            },
            {
              _id: {
                $gt: cursor.fixtureId,
              },
              scheduledKickoffAt: cursorDate,
            },
          ],
        }
      : {
          $or: [
            {
              scheduledKickoffAt: {
                $lt: cursorDate,
              },
            },
            {
              _id: {
                $gt: cursor.fixtureId,
              },
              scheduledKickoffAt: cursorDate,
            },
          ],
        };

  return {
    $and: [baseSelector, cursorSelector],
  };
};

const modeLabel = (mode: FixtureListMode): string =>
  mode === 'upcoming' ? 'Upcoming fixtures' : 'Past scheduled fixtures';

const modeDescription = (mode: FixtureListMode): string =>
  mode === 'upcoming'
    ? 'Published fixtures ordered by kickoff time.'
    : 'Published fixtures whose scheduled kickoff has passed.';

export const GamesPage = () => {
  const [mode, setMode] = useState<FixtureListMode>('upcoming');
  const [boundary, setBoundary] = useState(() => new Date().toISOString());
  const [pagination, setPagination] = useState(firstPageState);
  const pageSize = DEFAULT_PUBLIC_FIXTURE_LIMIT;

  useEffect(() => {
    const interval = window.setInterval(() => {
      setBoundary(new Date().toISOString());
      setPagination(firstPageState());
    }, refreshIntervalMs);

    return () => window.clearInterval(interval);
  }, []);

  const { fixtures, isConnected, isReady } = useTracker(() => {
    const handle = Meteor.subscribe(FIXTURE_PUBLICATIONS.publicList, {
      boundary,
      ...(pagination.cursor ? { cursor: pagination.cursor } : {}),
      limit: pageSize,
      mode,
    });
    const selector = publicFixtureSelector(mode, boundary, pagination.cursor);

    return {
      fixtures: Fixtures.find(selector, {
        limit: pageSize + 1,
        sort:
          mode === 'upcoming'
            ? {
                scheduledKickoffAt: 1,
                _id: 1,
              }
            : {
                scheduledKickoffAt: -1,
                _id: 1,
              },
      }).fetch(),
      isConnected: Meteor.status().connected,
      isReady: handle.ready(),
    };
  }, [boundary, mode, pageSize, pagination.cursor]);

  const visibleFixtures = useMemo(
    () => fixtures.slice(0, pageSize),
    [fixtures, pageSize],
  );
  const hasNextPage = fixtures.length > pageSize;
  const hasPreviousPage = pagination.previousCursors.length > 0;
  const lastVisibleFixture = visibleFixtures[visibleFixtures.length - 1];

  const resetToFirstPage = () => {
    setBoundary(new Date().toISOString());
    setPagination(firstPageState());
  };

  const goToNextPage = () => {
    if (!lastVisibleFixture) {
      return;
    }

    setPagination((current) => ({
      cursor: cursorFromFixture(lastVisibleFixture),
      previousCursors: [...current.previousCursors, current.cursor],
    }));
  };

  const goToPreviousPage = () => {
    setPagination((current) => {
      const previousCursors = current.previousCursors.slice(0, -1);
      const cursor =
        current.previousCursors[current.previousCursors.length - 1] ?? null;

      return {
        cursor,
        previousCursors,
      };
    });
  };

  const nowMs = new Date(boundary).getTime();

  return (
    <PlayerPage>
      <PlayerPageHeader
        actions={
          <div
            className="inline-flex w-full rounded-md border border-rr-border bg-rr-surface p-1 sm:w-auto"
            role="group"
            aria-label="Fixture list view"
          >
            {(['upcoming', 'past'] as const).map((candidate) => (
              <button
                className={[
                  'focus-ring min-h-10 flex-1 rounded px-3 text-sm font-black transition sm:flex-none',
                  mode === candidate
                    ? 'bg-rr-brand text-white'
                    : 'text-rr-muted hover:bg-rr-brand/10 hover:text-rr-text',
                ].join(' ')}
                key={candidate}
                type="button"
                onClick={() => {
                  setMode(candidate);
                  resetToFirstPage();
                }}
              >
                {candidate === 'upcoming' ? 'Upcoming' : 'Past'}
              </button>
            ))}
          </div>
        }
        eyebrow="Games"
        personality={
          <RugbyRoosterPersonality
            message={
              mode === 'upcoming'
                ? 'Match day radar on.'
                : 'Old calls, new bragging rights.'
            }
            mood={mode === 'upcoming' ? 'running' : 'thinking'}
            size="standard"
          />
        }
        subtitle={modeDescription(mode)}
        title={modeLabel(mode)}
      />

      {!isConnected && !isReady ? (
        <PlayerErrorState
          body="Reconnect to Rugby Rooster to load the latest published fixtures."
          title="Fixture browsing is unavailable right now"
        />
      ) : !isReady ? (
        <PlayerLoadingState label="Loading fixtures" />
      ) : visibleFixtures.length === 0 ? (
        <PlayerEmptyState
          body="Check back when a platform admin publishes fixtures."
          mood="thinking"
          title={`No ${mode === 'upcoming' ? 'upcoming' : 'past'} fixtures are available`}
        />
      ) : (
        <section>
          <ul className="grid gap-4">
            {visibleFixtures.map((fixture) => (
              <FixtureListItem
                fixture={fixture}
                key={fixture._id}
                nowMs={nowMs}
              />
            ))}
          </ul>

          {hasPreviousPage || hasNextPage ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {hasPreviousPage ? (
                <button
                  className="focus-ring rr-button rr-button-secondary"
                  type="button"
                  onClick={goToPreviousPage}
                >
                  Previous fixtures
                </button>
              ) : null}
              {hasNextPage ? (
                <button
                  className="focus-ring rr-button rr-button-secondary"
                  type="button"
                  onClick={goToNextPage}
                >
                  Next fixtures
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      )}
    </PlayerPage>
  );
};

const FixtureListItem = ({
  fixture,
  nowMs,
}: {
  readonly fixture: FixtureDocument;
  readonly nowMs: number;
}) => (
  <li className="rr-match-card">
    <div className="rr-match-card__inner">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            label={fixturePlayerStatusLabel(fixture, nowMs)}
            tone={fixturePlayerStatusTone(fixture, nowMs)}
          />
          <span className="rr-meta-copy">{fixture.competitionDisplayName}</span>
        </div>
        <h2 className="rr-fixture-title mt-3">
          {fixture.team1DisplayName} <span className="rr-versus">vs</span>{' '}
          {fixture.team2DisplayName}
        </h2>
        <p className="mt-3 text-sm font-bold text-rr-muted">
          {kickoffLabel(fixture)}
        </p>
        {fixture.venueDisplayName ? (
          <p className="mt-1 text-sm font-semibold text-rr-muted">
            {fixture.venueDisplayName}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 sm:justify-end">
        <AppLink
          className="focus-ring rr-button rr-button-primary"
          to={fixtureDetailPath(fixture._id)}
        >
          View fixture
        </AppLink>
        <AppLink
          className="focus-ring rr-button rr-button-secondary"
          to={fixturePredictionPath(fixture._id)}
        >
          Predict
        </AppLink>
      </div>
    </div>
  </li>
);
