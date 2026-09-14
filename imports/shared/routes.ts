export type RouteId = 'home' | 'games' | 'admin' | 'notFound';

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

export const publicNavigationRoutes = appRoutes.filter(
  (route) => route.layout === 'public',
);

export const resolveRoute = (pathname: string): AppRoute => {
  const normalizedPath = normalizePath(pathname);

  return (
    appRoutes.find((route) => route.path === normalizedPath) ?? notFoundRoute
  );
};

export const normalizePath = (pathname: string): string => {
  const pathWithoutTrailingSlash =
    pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  return pathWithoutTrailingSlash || '/';
};
