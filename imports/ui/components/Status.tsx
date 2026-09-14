interface LoadingStateProps {
  readonly label?: string;
}

interface ErrorStateProps {
  readonly message: string;
  readonly title: string;
}

export const LoadingState = ({ label = 'Loading' }: LoadingStateProps) => (
  <main className="min-h-screen bg-rooster-paper px-4 py-10 text-rooster-ink">
    <div
      className="mx-auto flex min-h-80 w-full max-w-3xl items-center justify-center rounded-lg border border-rooster-line bg-white"
      role="status"
      aria-live="polite"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-rooster-line border-t-rooster-red" />
      <span className="ml-3 text-sm font-semibold text-rooster-muted">
        {label}
      </span>
    </div>
  </main>
);

export const ErrorState = ({ message, title }: ErrorStateProps) => (
  <main className="min-h-screen bg-rooster-paper px-4 py-10 text-rooster-ink">
    <section
      className="mx-auto w-full max-w-2xl rounded-lg border border-rooster-red/30 bg-white p-6"
      role="alert"
    >
      <p className="text-sm font-bold uppercase text-rooster-red">Error</p>
      <h1 className="mt-2 text-2xl font-black text-rooster-ink">{title}</h1>
      <p className="mt-3 text-base leading-7 text-rooster-muted">{message}</p>
    </section>
  </main>
);
