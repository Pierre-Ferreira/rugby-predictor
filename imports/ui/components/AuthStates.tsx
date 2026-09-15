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
  <section className="rounded-lg border border-rooster-line bg-white p-6 text-rooster-ink sm:p-8">
    <p className="text-sm font-black uppercase text-rooster-red">
      Sign in required
    </p>
    <h1 className="mt-3 text-3xl font-black">{title}</h1>
    <p className="mt-4 max-w-2xl text-base leading-7 text-rooster-muted">
      {message}
    </p>
    <AppLink
      className="focus-ring mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-rooster-red px-4 text-sm font-black text-white transition hover:bg-rooster-ink"
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
  <section className="rounded-lg border border-rooster-red/30 bg-white p-6 text-rooster-ink sm:p-8">
    <p className="text-sm font-black uppercase text-rooster-red">
      Access denied
    </p>
    <h1 className="mt-3 text-3xl font-black">{title}</h1>
    <p className="mt-4 max-w-2xl text-base leading-7 text-rooster-muted">
      {message}
    </p>
    {action}
  </section>
);
