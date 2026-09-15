import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';

import { Fixtures } from '/imports/api/fixtures/collection';
import { FIXTURE_PUBLICATIONS } from '/imports/shared/fixtures';
import { AppLink } from '../components/AppLink';
import {
  fixtureStatusClassName,
  fixtureStatusLabel,
  kickoffLabel,
  fixturePredictionPath,
} from '../fixtures/fixtureUi';

const fixtureIdFromLocation = (): string =>
  window.location.pathname.split('/').filter(Boolean)[1] ?? '';

export const GameDetailPage = () => {
  const fixtureId = fixtureIdFromLocation();
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

  if (!isConnected && !isReady) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <section
          className="rounded-md border border-rooster-red/30 bg-white p-6"
          role="status"
        >
          <h1 className="text-2xl font-black text-rooster-ink">
            Fixture is unavailable right now
          </h1>
          <p className="mt-2 text-sm leading-6 text-rooster-muted">
            Reconnect to Rugby Rooster to load this fixture.
          </p>
        </section>
      </main>
    );
  }

  if (!isReady) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <section
          className="rounded-md border border-rooster-line bg-white p-6"
          role="status"
        >
          <p className="text-sm font-bold text-rooster-muted">
            Loading fixture
          </p>
        </section>
      </main>
    );
  }

  if (!fixture) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <section className="rounded-md border border-dashed border-rooster-line bg-white p-6">
          <p className="text-sm font-black uppercase text-rooster-red">Games</p>
          <h1 className="mt-3 text-2xl font-black text-rooster-ink">
            Fixture not found
          </h1>
          <p className="mt-3 text-sm leading-6 text-rooster-muted">
            Draft fixtures and unknown fixture links are not publicly available.
          </p>
          <AppLink
            className="focus-ring mt-5 inline-flex min-h-11 items-center rounded-md bg-rooster-ink px-4 text-sm font-black text-white transition hover:bg-rooster-red"
            to="/games"
          >
            Back to games
          </AppLink>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <article className="rounded-md border border-rooster-line bg-white p-6 sm:p-8">
        <AppLink
          className="focus-ring inline-flex min-h-10 items-center rounded-md text-sm font-black text-rooster-red"
          to="/games"
        >
          Back to games
        </AppLink>

        <div className="mt-6 flex flex-wrap items-center gap-2">
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

        <h1 className="mt-4 text-3xl font-black text-rooster-ink sm:text-4xl">
          {fixture.team1DisplayName} vs {fixture.team2DisplayName}
        </h1>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-rooster-line p-4">
            <dt className="text-sm font-black text-rooster-muted">Kickoff</dt>
            <dd className="mt-2 text-lg font-black text-rooster-ink">
              {kickoffLabel(fixture)}
            </dd>
          </div>
          <div className="rounded-md border border-rooster-line p-4">
            <dt className="text-sm font-black text-rooster-muted">Venue</dt>
            <dd className="mt-2 text-lg font-black text-rooster-ink">
              {fixture.venueDisplayName ?? 'Venue to be confirmed'}
            </dd>
          </div>
        </dl>

        <div className="mt-6 rounded-md border border-rooster-line bg-rooster-paper p-4">
          <p className="text-sm font-black text-rooster-ink">
            Predictions are open until scheduled kickoff for signed-in players.
          </p>
          <AppLink
            className="focus-ring mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-rooster-red px-4 text-sm font-black text-white transition hover:bg-rooster-ink"
            to={fixturePredictionPath(fixture._id)}
          >
            Enter prediction
          </AppLink>
        </div>
      </article>
    </main>
  );
};
