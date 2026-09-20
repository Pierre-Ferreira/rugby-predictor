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
import { AdminFixtureResultsPage } from './pages/AdminFixtureResultsPage';
import { AccountPage } from './pages/AccountPage';
import { AuthEmailLinkPage } from './pages/AuthEmailLinkPage';
import { FixtureLeaderboardPage } from './pages/FixtureLeaderboardPage';
import { GameDetailPage } from './pages/GameDetailPage';
import { GamesPage } from './pages/GamesPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PredictionEntryPage } from './pages/PredictionEntryPage';
import { SignInPage } from './pages/SignInPage';
import { ErrorState, LoadingState } from './components/Status';

const routePages: Record<RouteId, () => ReactNode> = {
  account: AccountPage,
  gameDetail: GameDetailPage,
  home: HomePage,
  games: GamesPage,
  admin: AdminPage,
  adminFixtureResults: AdminFixtureResultsPage,
  authEmailLink: AuthEmailLinkPage,
  fixtureLeaderboard: FixtureLeaderboardPage,
  notFound: NotFoundPage,
  predictionEntry: PredictionEntryPage,
  signIn: SignInPage,
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

const getBrowserLocation = (): string =>
  `${window.location.pathname}${window.location.search}${window.location.hash}`;

export const App = () => {
  const [browserLocation, setBrowserLocation] = useState(getBrowserLocation);
  const route = useMemo(
    () =>
      resolveRoute(
        new URL(browserLocation, 'https://rugby-rooster.local').pathname,
      ),
    [browserLocation],
  );

  useEffect(() => {
    const onLocationChange = () => {
      setBrowserLocation(getBrowserLocation());
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
    <PublicLayout
      currentPath={
        route.id === 'gameDetail' ||
        route.id === 'fixtureLeaderboard' ||
        route.id === 'predictionEntry'
          ? '/games'
          : route.path
      }
    >
      <Page />
    </PublicLayout>
  );
};
