import type { ReactNode } from 'react';
import { publicNavigationRoutes } from '/imports/shared/routes';
import { AppLink } from '../components/AppLink';

interface PublicLayoutProps {
  readonly children: ReactNode;
  readonly currentPath: string;
}

export const PublicLayout = ({ children, currentPath }: PublicLayoutProps) => (
  <div className="min-h-screen bg-rooster-paper text-rooster-ink">
    <header className="border-b border-rooster-line bg-white/95">
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
                  aria-current={currentPath === route.path ? 'page' : undefined}
                  to={route.path}
                >
                  {route.label}
                </AppLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>

    {children}

    <footer className="border-t border-rooster-line bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-rooster-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Rugby Rooster foundation build.</p>
        <AppLink
          className="focus-ring rounded-md font-bold text-rooster-red"
          to="/admin"
        >
          Admin placeholder
        </AppLink>
      </div>
    </footer>
  </div>
);
