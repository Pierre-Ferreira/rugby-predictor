import type { ReactNode } from 'react';

import {
  RugbyRoosterPersonality,
  type RugbyRoosterMood,
} from './RugbyRoosterPersonality';

export const PlayerPage = ({
  children,
  maxWidth = 'wide',
}: {
  readonly children: ReactNode;
  readonly maxWidth?: 'narrow' | 'standard' | 'wide';
}) => (
  <main className={`rr-player-page rr-player-page--${maxWidth}`}>
    {children}
  </main>
);

export const PlayerPageHeader = ({
  actions,
  eyebrow,
  meta,
  personality,
  subtitle,
  title,
}: {
  readonly actions?: ReactNode;
  readonly eyebrow?: ReactNode;
  readonly meta?: ReactNode;
  readonly personality?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly title: ReactNode;
}) => (
  <section className="rr-page-header">
    <div className="rr-page-header__content">
      {eyebrow ? (
        <div className="rr-page-header__eyebrow">{eyebrow}</div>
      ) : null}
      <h1 className="rr-page-title">{title}</h1>
      {subtitle ? (
        <div className="rr-page-header__subtitle">{subtitle}</div>
      ) : null}
      {meta ? <div className="rr-page-header__meta">{meta}</div> : null}
      {actions ? (
        <div className="rr-page-header__actions">{actions}</div>
      ) : null}
    </div>
    {personality ? (
      <div className="rr-page-header__personality">{personality}</div>
    ) : null}
  </section>
);

export const PlayerSurface = ({
  children,
  className,
  raised = false,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly raised?: boolean;
}) => (
  <section
    className={[
      'rr-surface',
      raised ? 'rr-surface--raised' : '',
      className ?? '',
    ].join(' ')}
  >
    {children}
  </section>
);

export const PlayerEmptyState = ({
  action,
  body,
  mood = 'thinking',
  title,
}: {
  readonly action?: ReactNode;
  readonly body: ReactNode;
  readonly mood?: RugbyRoosterMood;
  readonly title: ReactNode;
}) => (
  <section className="rr-empty-state">
    <RugbyRoosterPersonality mood={mood} size="sm" />
    <div className="rr-empty-state__content">
      <h2 className="rr-state-title">{title}</h2>
      <p className="rr-state-copy">{body}</p>
      {action ? <div className="rr-state-actions">{action}</div> : null}
    </div>
  </section>
);

export const PlayerLoadingState = ({ label }: { readonly label: string }) => (
  <section className="rr-loading-state" role="status" aria-live="polite">
    <span className="rr-spinner" aria-hidden="true" />
    <span>{label}</span>
  </section>
);

export const PlayerErrorState = ({
  action,
  body,
  title,
}: {
  readonly action?: ReactNode;
  readonly body: ReactNode;
  readonly title: ReactNode;
}) => (
  <section className="rr-error-state" role="alert">
    <RugbyRoosterPersonality
      message="Rooster's having a moment."
      mood="shocked"
      size="sm"
    />
    <div className="rr-error-state__content">
      <h2 className="rr-state-title">{title}</h2>
      <p className="rr-state-copy">{body}</p>
      {action ? <div className="rr-state-actions">{action}</div> : null}
    </div>
  </section>
);

export const classNames = (
  ...values: readonly (false | null | string | undefined)[]
): string => values.filter(Boolean).join(' ');
