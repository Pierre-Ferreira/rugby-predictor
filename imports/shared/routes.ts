export type RouteId =
  | 'account'
  | 'admin'
  | 'adminFixtureResults'
  | 'authEmailLink'
  | 'gameDetail'
  | 'predictionEntry'
  | 'games'
  | 'home'
  | 'notFound'
  | 'signIn';

export type RouteLayout = 'public' | 'admin';

export interface AppRoute {
  readonly id: RouteId;
  readonly label: string;
  readonly path: string;
  readonly layout: RouteLayout;
}

export const appRoutes = [
  {
    id: 'home',
    label: 'Rugby Rooster',
    path: '/',
    layout: 'public',
  },
  {
    id: 'games',
    label: 'Games',
    path: '/games',
    layout: 'public',
  },
  {
    id: 'signIn',
    label: 'Sign in',
    path: '/sign-in',
    layout: 'public',
  },
  {
    id: 'authEmailLink',
    label: 'Email Link',
    path: '/auth/email-link',
    layout: 'public',
  },
  {
    id: 'account',
    label: 'Account',
    path: '/account',
    layout: 'public',
  },
  {
    id: 'admin',
    label: 'Admin',
    path: '/admin',
    layout: 'admin',
  },
] as const satisfies readonly AppRoute[];

export const notFoundRoute: AppRoute = {
  id: 'notFound',
  label: 'Not Found',
  path: '*',
  layout: 'public',
};

const gameDetailPattern = /^\/games\/[a-zA-Z0-9_-]{1,128}$/;
const predictionEntryPattern = /^\/games\/[a-zA-Z0-9_-]{1,128}\/predict$/;
const adminFixtureResultsPattern =
  /^\/admin\/fixtures\/[a-zA-Z0-9_-]{1,128}\/results$/;

export const publicNavigationRoutes = appRoutes.filter(
  (route) => route.id === 'home' || route.id === 'games',
);

export const resolveRoute = (pathname: string): AppRoute => {
  const normalizedPath = normalizePath(pathname);

  if (adminFixtureResultsPattern.test(normalizedPath)) {
    return {
      id: 'adminFixtureResults',
      label: 'Fixture Results',
      layout: 'admin',
      path: normalizedPath,
    };
  }

  if (predictionEntryPattern.test(normalizedPath)) {
    return {
      id: 'predictionEntry',
      label: 'Prediction',
      layout: 'public',
      path: normalizedPath,
    };
  }

  if (gameDetailPattern.test(normalizedPath)) {
    return {
      id: 'gameDetail',
      label: 'Fixture',
      layout: 'public',
      path: normalizedPath,
    };
  }

  return (
    appRoutes.find((route) => route.path === normalizedPath) ?? notFoundRoute
  );
};

export const normalizePath = (pathname: string): string => {
  const pathWithoutTrailingSlash =
    pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  return pathWithoutTrailingSlash || '/';
};
