import { describe, expect, it } from 'vitest';
import {
  normalizePath,
  publicNavigationRoutes,
  resolveRoute,
} from '../../imports/shared/routes';

describe('route resolution', () => {
  it('resolves the public homepage route', () => {
    expect(resolveRoute('/')).toMatchObject({
      id: 'home',
      label: 'Rugby Rooster',
      layout: 'public',
      path: '/',
    });
  });

  it('resolves direct games and admin routes', () => {
    expect(resolveRoute('/games')).toMatchObject({
      id: 'games',
      layout: 'public',
      path: '/games',
    });
    expect(resolveRoute('/admin')).toMatchObject({
      id: 'admin',
      layout: 'admin',
      path: '/admin',
    });
  });

  it('normalizes trailing slashes before matching', () => {
    expect(normalizePath('/games/')).toBe('/games');
    expect(resolveRoute('/games/')).toMatchObject({ id: 'games' });
  });

  it('uses the not-found route for unknown paths', () => {
    expect(resolveRoute('/fixtures')).toMatchObject({
      id: 'notFound',
      label: 'Not Found',
      layout: 'public',
      path: '*',
    });
  });

  it('keeps admin out of public navigation', () => {
    expect(publicNavigationRoutes.map((route) => route.path)).toEqual([
      '/',
      '/games',
    ]);
  });
});
