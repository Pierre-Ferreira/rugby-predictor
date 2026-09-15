import type { ReactNode } from 'react';
import { SignOutButton } from '../auth/SignOutButton';
import { useAuthState } from '../auth/useAuthState';
import { AppLink } from '../components/AppLink';

interface AdminLayoutProps {
  readonly children: ReactNode;
  readonly currentPath: string;
}

export const AdminLayout = ({ children, currentPath }: AdminLayoutProps) => {
  const auth = useAuthState();

  return (
    <div className="app-shell bg-rooster-ink text-white">
      <header className="app-shell-header border-b border-white/10 bg-rooster-ink">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <AppLink
              className="focus-ring inline-flex min-h-10 items-center rounded-md text-lg font-black"
              to="/admin"
              aria-current={currentPath === '/admin' ? 'page' : undefined}
            >
              Rugby Rooster Admin
            </AppLink>
            <p className="mt-1 text-sm text-white/70">Platform access</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <AppLink
              className="focus-ring inline-flex min-h-10 items-center rounded-md bg-white px-3 text-sm font-bold text-rooster-ink transition hover:bg-rooster-sun"
              to="/"
            >
              Public site
            </AppLink>
            <AppLink
              className="focus-ring inline-flex min-h-10 items-center rounded-md border border-white/30 px-3 text-sm font-bold text-white transition hover:bg-white/10"
              to="/account"
            >
              Account
            </AppLink>
            {auth.isAuthenticated ? (
              <SignOutButton className="focus-ring inline-flex min-h-10 items-center rounded-md border border-white/30 px-3 text-sm font-bold text-white transition hover:bg-white/10" />
            ) : null}
          </div>
        </div>
      </header>

      {children}
    </div>
  );
};
