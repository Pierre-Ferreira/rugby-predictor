import { AppLink } from '../components/AppLink';

export const NotFoundPage = () => (
  <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
    <section className="rounded-lg border border-rooster-line bg-white p-6 sm:p-8">
      <p className="text-sm font-black uppercase text-rooster-red">404</p>
      <h1 className="mt-3 text-3xl font-black text-rooster-ink">
        Page not found
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-rooster-muted">
        That route is not part of the Rugby Rooster foundation.
      </p>
      <AppLink
        className="focus-ring mt-6 inline-flex min-h-12 items-center rounded-md bg-rooster-ink px-5 text-base font-black text-white transition hover:bg-rooster-grass"
        to="/"
      >
        Return home
      </AppLink>
    </section>
  </main>
);
