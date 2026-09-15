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
    <div className="app-shell bg-rooster-paper text-rooster-ink">
      <header className="app-shell-header border-b border-rooster-line bg-white/95">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <AppLink
            className="focus-ring inline-flex min-h-11 items-center gap-3 rounded-md text-lg font-black"
            to="/"
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full bg-rooster-red text-base font-black text-white"
              aria-hidden="true"
            >
              RR
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
                        ? 'bg-rooster-ink text-white'
                        : 'text-rooster-muted hover:bg-rooster-grass/10 hover:text-rooster-ink',
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
                      ? 'bg-rooster-ink text-white'
                      : 'text-rooster-muted hover:bg-rooster-grass/10 hover:text-rooster-ink',
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
                  <SignOutButton className="focus-ring inline-flex min-h-10 items-center rounded-md px-3 text-sm font-bold text-rooster-muted transition hover:bg-rooster-grass/10 hover:text-rooster-ink" />
                </li>
              ) : null}
            </ul>
          </nav>
        </div>
      </header>

      {children}

      <footer className="app-shell-footer border-t border-rooster-line bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-rooster-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Rugby Rooster account access build.</p>
          <AppLink
            className="focus-ring rounded-md font-bold text-rooster-red"
            to="/admin"
          >
            Admin
          </AppLink>
        </div>
      </footer>
    </div>
  );
};
