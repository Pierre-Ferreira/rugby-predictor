interface LoadingStateProps {
  readonly label?: string;
}

interface ErrorStateProps {
  readonly message: string;
  readonly title: string;
}

export const LoadingState = ({ label = 'Loading' }: LoadingStateProps) => (
  <main className="min-h-screen bg-rr-bg px-4 py-10 text-rr-text">
    <div
      className="rr-loading-state mx-auto min-h-80 w-full max-w-3xl"
      role="status"
      aria-live="polite"
    >
      <span className="rr-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  </main>
);

export const ErrorState = ({ message, title }: ErrorStateProps) => (
  <main className="min-h-screen bg-rr-bg px-4 py-10 text-rr-text">
    <section className="rr-error-state mx-auto w-full max-w-2xl" role="alert">
      <div>
        <p className="rr-section-eyebrow">Error</p>
        <h1 className="rr-section-title mt-2">{title}</h1>
        <p className="mt-3 text-base leading-7 text-rooster-muted">{message}</p>
      </div>
    </section>
  </main>
);
