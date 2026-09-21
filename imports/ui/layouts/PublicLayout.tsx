import type { ReactNode } from 'react';
import { publicNavigationRoutes } from '/imports/shared/routes';
import { useAuthState } from '../auth/useAuthState';
import { SignOutButton } from '../auth/SignOutButton';
import { AppLink } from '../components/AppLink';

interface PublicLayoutProps {
  readonly children: ReactNode;
  readonly currentPath: string;
}

export const PublicLayout = ({ children, currentPath }: PublicLayoutProps) => {
  const auth = useAuthState();

  return (
    <div className="app-shell bg-rr-bg text-rr-text">
      <header className="app-shell-header border-b border-rr-border bg-rr-surface/95">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <AppLink
            className="focus-ring inline-flex min-h-11 items-center gap-3 rounded-md text-lg font-black"
            to="/"
          >
            <span
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-rr-brand text-base font-black text-white shadow-sm"
              aria-hidden="true"
            >
              <img
                alt=""
                className="h-full w-full object-cover"
                height="40"
                src="/icons/rr-icon-192.png"
                width="40"
              />
            </span>
            <span>Rugby Rooster</span>
          </AppLink>

          <nav aria-label="Primary navigation">
            <ul className="flex flex-wrap gap-2">
              {publicNavigationRoutes.map((route) => (
                <li key={route.id}>
                  <AppLink
                    className={[
                      'focus-ring inline-flex min-h-10 items-center rounded-md px-3 text-sm font-bold transition',
                      currentPath === route.path
                        ? 'bg-rr-brand text-white'
                        : 'text-rr-muted hover:bg-rr-brand/10 hover:text-rr-text',
                    ].join(' ')}
                    aria-current={
                      currentPath === route.path ? 'page' : undefined
                    }
                    to={route.path}
                  >
                    {route.label}
                  </AppLink>
                </li>
              ))}
              <li>
                <AppLink
                  className={[
                    'focus-ring inline-flex min-h-10 items-center rounded-md px-3 text-sm font-bold transition',
                    currentPath === '/account' || currentPath === '/sign-in'
                      ? 'bg-rr-brand text-white'
                      : 'text-rr-muted hover:bg-rr-brand/10 hover:text-rr-text',
                  ].join(' ')}
                  aria-current={
                    currentPath === '/account' || currentPath === '/sign-in'
                      ? 'page'
                      : undefined
                  }
                  to={auth.isAuthenticated ? '/account' : '/sign-in'}
                >
                  {auth.isAuthenticated ? 'Account' : 'Sign in'}
                </AppLink>
              </li>
              {auth.isAuthenticated ? (
                <li>
                  <SignOutButton className="focus-ring inline-flex min-h-10 items-center rounded-md px-3 text-sm font-bold text-rr-muted transition hover:bg-rr-brand/10 hover:text-rr-text" />
                </li>
              ) : null}
            </ul>
          </nav>
        </div>
      </header>

      {children}

      <footer className="app-shell-footer border-t border-rr-border bg-rr-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-rr-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Predict rugby. Keep your feathers. Mostly.</p>
          <AppLink
            className="focus-ring rounded-md font-bold text-rr-brand"
            to="/admin"
          >
            Admin
          </AppLink>
        </div>
      </footer>
    </div>
  );
};
