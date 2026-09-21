import type { ReactNode } from 'react';

import { signInPathForReturnTo } from '/imports/shared/auth/redirects';
import { AppLink } from './AppLink';

interface AuthMessageProps {
  readonly action?: ReactNode;
  readonly currentPath: string;
  readonly message: string;
  readonly signInPath?: string;
  readonly title: string;
}

export const SignInRequiredState = ({
  action,
  currentPath,
  message,
  signInPath,
  title,
}: AuthMessageProps) => (
  <section className="rr-surface rr-surface--raised text-rooster-ink">
    <p className="rr-section-eyebrow">Sign in required</p>
    <h1 className="rr-section-title mt-3">{title}</h1>
    <p className="mt-4 max-w-2xl text-base leading-7 text-rooster-muted">
      {message}
    </p>
    <AppLink
      className="focus-ring rr-button rr-button-primary mt-6"
      to={signInPath ?? signInPathForReturnTo(currentPath)}
    >
      Email me a sign-in link
    </AppLink>
    {action}
  </section>
);

export const AccessDeniedState = ({
  action,
  message,
  title,
}: Omit<AuthMessageProps, 'currentPath' | 'signInPath'>) => (
  <section className="rr-surface rr-surface--raised border-rooster-red/30 text-rooster-ink">
    <p className="rr-section-eyebrow">Access denied</p>
    <h1 className="rr-section-title mt-3">{title}</h1>
    <p className="mt-4 max-w-2xl text-base leading-7 text-rooster-muted">
      {message}
    </p>
    {action}
  </section>
);
