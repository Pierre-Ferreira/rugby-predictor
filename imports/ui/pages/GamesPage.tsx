import { useEffect, useMemo, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';

import { Fixtures } from '/imports/api/fixtures/collection';
import {
  DEFAULT_PUBLIC_FIXTURE_LIMIT,
  FIXTURE_PUBLICATIONS,
  MAX_PUBLIC_FIXTURE_LIMIT,
  type FixtureDocument,
  type FixtureListMode,
} from '/imports/shared/fixtures';
import { AppLink } from '../components/AppLink';
import {
  fixtureDetailPath,
  fixtureStatusClassName,
  fixtureStatusLabel,
  kickoffLabel,
} from '../fixtures/fixtureUi';

const refreshIntervalMs = 30_000;

const useRefreshingNow = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, refreshIntervalMs);

    return () => window.clearInterval(interval);
  }, []);

  return now;
};

const modeLabel = (mode: FixtureListMode): string =>
  mode === 'upcoming' ? 'Upcoming fixtures' : 'Past scheduled fixtures';

const modeDescription = (mode: FixtureListMode): string =>
  mode === 'upcoming'
    ? 'Published fixtures ordered by kickoff time.'
    : 'Published fixtures whose scheduled kickoff has passed.';

export const GamesPage = () => {
  const [mode, setMode] = useState<FixtureListMode>('upcoming');
  const [visibleLimit, setVisibleLimit] = useState(
    DEFAULT_PUBLIC_FIXTURE_LIMIT,
  );
  const now = useRefreshingNow();
  const boundary = now.toISOString();
  const subscriptionLimit = Math.min(
    visibleLimit + 1,
    MAX_PUBLIC_FIXTURE_LIMIT,
  );

  const { fixtures, isConnected, isReady } = useTracker(() => {
    const handle = Meteor.subscribe(FIXTURE_PUBLICATIONS.publicList, {
      boundary,
      limit: subscriptionLimit,
      mode,
    });
    const selector =
      mode === 'upcoming'
        ? {
            scheduledKickoffAt: {
              $gte: new Date(boundary),
            },
            visibility: 'published' as const,
          }
        : {
            scheduledKickoffAt: {
              $lt: new Date(boundary),
            },
            visibility: 'published' as const,
          };

    return {
      fixtures: Fixtures.find(selector, {
        limit: subscriptionLimit,
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
  }, [boundary, mode, subscriptionLimit]);

  const visibleFixtures = useMemo(
    () => fixtures.slice(0, visibleLimit),
    [fixtures, visibleLimit],
  );
  const hasMore =
    fixtures.length > visibleLimit && visibleLimit < MAX_PUBLIC_FIXTURE_LIMIT;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <section className="border-b border-rooster-line pb-6">
        <p className="text-sm font-black uppercase text-rooster-red">Games</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black text-rooster-ink">
              {modeLabel(mode)}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-rooster-muted">
              {modeDescription(mode)}
            </p>
          </div>
          <div
            className="inline-flex w-full rounded-md border border-rooster-line bg-white p-1 sm:w-auto"
            role="group"
            aria-label="Fixture list view"
          >
            {(['upcoming', 'past'] as const).map((candidate) => (
              <button
                className={[
                  'focus-ring min-h-10 flex-1 rounded px-3 text-sm font-black transition sm:flex-none',
                  mode === candidate
                    ? 'bg-rooster-ink text-white'
                    : 'text-rooster-muted hover:bg-rooster-paper hover:text-rooster-ink',
                ].join(' ')}
                key={candidate}
                type="button"
                onClick={() => {
                  setMode(candidate);
                  setVisibleLimit(DEFAULT_PUBLIC_FIXTURE_LIMIT);
                }}
              >
                {candidate === 'upcoming' ? 'Upcoming' : 'Past'}
              </button>
            ))}
          </div>
        </div>
      </section>

      {!isConnected && !isReady ? (
        <section
          className="mt-6 rounded-md border border-rooster-red/30 bg-white p-6"
          role="status"
        >
          <h2 className="text-xl font-black text-rooster-ink">
            Fixture browsing is unavailable right now
          </h2>
          <p className="mt-2 text-sm leading-6 text-rooster-muted">
            Reconnect to Rugby Rooster to load the latest published fixtures.
          </p>
        </section>
      ) : !isReady ? (
        <section
          className="mt-6 rounded-md border border-rooster-line bg-white p-6"
          role="status"
        >
          <p className="text-sm font-bold text-rooster-muted">
            Loading fixtures
          </p>
        </section>
      ) : visibleFixtures.length === 0 ? (
        <section className="mt-6 rounded-md border border-dashed border-rooster-line bg-white p-6">
          <h2 className="text-xl font-black text-rooster-ink">
            No {mode === 'upcoming' ? 'upcoming' : 'past'} fixtures are
            available
          </h2>
          <p className="mt-2 text-sm leading-6 text-rooster-muted">
            Check back when a platform admin publishes fixtures.
          </p>
        </section>
      ) : (
        <section className="mt-6">
          <ul className="grid gap-4">
            {visibleFixtures.map((fixture) => (
              <FixtureListItem fixture={fixture} key={fixture._id} />
            ))}
          </ul>

          {hasMore ? (
            <button
              className="focus-ring mt-5 min-h-11 rounded-md border border-rooster-line bg-white px-4 text-sm font-black text-rooster-ink transition hover:bg-rooster-paper"
              type="button"
              onClick={() =>
                setVisibleLimit((current) =>
                  Math.min(
                    current + DEFAULT_PUBLIC_FIXTURE_LIMIT,
                    MAX_PUBLIC_FIXTURE_LIMIT,
                  ),
                )
              }
            >
              Load more fixtures
            </button>
          ) : null}
        </section>
      )}
    </main>
  );
};

const FixtureListItem = ({
  fixture,
}: {
  readonly fixture: FixtureDocument;
}) => (
  <li className="rounded-md border border-rooster-line bg-white p-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={[
              'inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase',
              fixtureStatusClassName(fixture),
            ].join(' ')}
          >
            {fixtureStatusLabel(fixture)}
          </span>
          <span className="text-xs font-bold uppercase text-rooster-muted">
            {fixture.competitionDisplayName}
          </span>
        </div>
        <h2 className="mt-3 text-2xl font-black text-rooster-ink">
          {fixture.team1DisplayName} vs {fixture.team2DisplayName}
        </h2>
        <p className="mt-2 text-sm font-bold text-rooster-muted">
          {kickoffLabel(fixture)}
        </p>
        {fixture.venueDisplayName ? (
          <p className="mt-1 text-sm text-rooster-muted">
            {fixture.venueDisplayName}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 sm:justify-end">
        <AppLink
          className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md bg-rooster-ink px-4 text-sm font-black text-white transition hover:bg-rooster-red"
          to={fixtureDetailPath(fixture._id)}
        >
          View fixture
        </AppLink>
        <button
          className="min-h-11 cursor-not-allowed rounded-md border border-rooster-line px-4 text-sm font-black text-rooster-muted opacity-70"
          type="button"
          disabled
        >
          Predictions are not open yet
        </button>
      </div>
    </div>
  </li>
);
