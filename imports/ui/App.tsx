import type { ReactNode } from 'react';
import { Component, Suspense, useEffect, useMemo, useState } from 'react';
import {
  type AppRoute,
  type RouteId,
  notFoundRoute,
  resolveRoute,
} from '/imports/shared/routes';
import { AdminLayout } from './layouts/AdminLayout';
import { PublicLayout } from './layouts/PublicLayout';
import { AdminPage } from './pages/AdminPage';
import { GamesPage } from './pages/GamesPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ErrorState, LoadingState } from './components/Status';

const routePages: Record<RouteId, () => ReactNode> = {
  home: HomePage,
  games: GamesPage,
  admin: AdminPage,
  notFound: NotFoundPage,
};

interface ErrorBoundaryState {
  readonly error: Error | null;
}

class AppErrorBoundary extends Component<
  { readonly children: ReactNode },
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    console.error('Rugby Rooster render error', error);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <ErrorState
          title="Rugby Rooster hit a snag"
          message="Refresh the page and try again. If the problem continues, this foundation needs a follow-up issue."
        />
      );
    }

    return this.props.children;
  }
}

const getBrowserPath = (): string => window.location.pathname;

export const App = () => {
  const [pathname, setPathname] = useState(getBrowserPath);
  const route = useMemo(() => resolveRoute(pathname), [pathname]);

  useEffect(() => {
    const onLocationChange = () => {
      setPathname(getBrowserPath());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('popstate', onLocationChange);
    window.addEventListener('rugby-rooster:navigate', onLocationChange);

    return () => {
      window.removeEventListener('popstate', onLocationChange);
      window.removeEventListener('rugby-rooster:navigate', onLocationChange);
    };
  }, []);

  return (
    <AppErrorBoundary>
      <Suspense fallback={<LoadingState label="Loading Rugby Rooster" />}>
        <RoutedPage route={route} />
      </Suspense>
    </AppErrorBoundary>
  );
};

const RoutedPage = ({ route }: { readonly route: AppRoute }) => {
  const Page = routePages[route.id] ?? routePages[notFoundRoute.id];

  if (route.layout === 'admin') {
    return (
      <AdminLayout currentPath={route.path}>
        <Page />
      </AdminLayout>
    );
  }

  return (
    <PublicLayout currentPath={route.path}>
      <Page />
    </PublicLayout>
  );
};
