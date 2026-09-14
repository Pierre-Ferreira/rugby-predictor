import { AppLink } from '../components/AppLink';

export const HomePage = () => (
  <main>
    <section className="bg-rooster-grass text-white">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1fr)_18rem] md:items-center md:py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase text-rooster-sun">
            Standalone rugby prediction game
          </p>
          <h1 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">
            Rugby Rooster
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/90">
            Predict televised rugby fixtures, follow live score movement, and
            compare leaderboard results once matches are confirmed.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <AppLink
              className="focus-ring inline-flex min-h-12 items-center justify-center rounded-md bg-rooster-sun px-5 text-base font-black text-rooster-ink transition hover:bg-white"
              to="/games"
            >
              Browse games
            </AppLink>
            <AppLink
              className="focus-ring inline-flex min-h-12 items-center justify-center rounded-md border border-white/40 px-5 text-base font-black text-white transition hover:bg-white/10"
              to="/admin"
            >
              Admin placeholder
            </AppLink>
          </div>
        </div>

        <div className="rounded-lg border border-white/20 bg-white/10 p-5">
          <p className="text-sm font-black uppercase text-rooster-sun">
            CCPP-001
          </p>
          <p className="mt-3 text-2xl font-black">Foundation only</p>
          <p className="mt-3 text-sm leading-6 text-white/80">
            Accounts, fixtures, predictions, scoring, leaderboards, animation,
            and venue features are planned for later milestones.
          </p>
        </div>
      </div>
    </section>

    <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-10 sm:px-6 md:grid-cols-3">
      {[
        ['Games first', 'A public path is ready for upcoming televised fixtures.'],
        [
          'Rules later',
          'Prediction scoring and locking will be specified and tested separately.',
        ],
        [
          'Server owned',
          'Authoritative data access will live behind Meteor methods and publications.',
        ],
      ].map(([title, body]) => (
        <article
          className="rounded-lg border border-rooster-line bg-white p-5"
          key={title}
        >
          <h2 className="text-lg font-black text-rooster-ink">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-rooster-muted">{body}</p>
        </article>
      ))}
    </section>
  </main>
);
