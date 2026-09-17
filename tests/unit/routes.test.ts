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

  it('resolves public game detail routes under games', () => {
    expect(resolveRoute('/games/abc_123')).toMatchObject({
      id: 'gameDetail',
      layout: 'public',
      path: '/games/abc_123',
    });
  });

  it('resolves public prediction entry routes under games', () => {
    expect(resolveRoute('/games/abc_123/predict')).toMatchObject({
      id: 'predictionEntry',
      layout: 'public',
      path: '/games/abc_123/predict',
    });
  });

  it('resolves admin fixture result routes', () => {
    expect(resolveRoute('/admin/fixtures/abc_123/results')).toMatchObject({
      id: 'adminFixtureResults',
      layout: 'admin',
      path: '/admin/fixtures/abc_123/results',
    });
  });

  it('resolves account and passwordless sign-in routes', () => {
    expect(resolveRoute('/sign-in')).toMatchObject({
      id: 'signIn',
      layout: 'public',
      path: '/sign-in',
    });
    expect(resolveRoute('/auth/email-link')).toMatchObject({
      id: 'authEmailLink',
      layout: 'public',
      path: '/auth/email-link',
    });
    expect(resolveRoute('/account')).toMatchObject({
      id: 'account',
      layout: 'public',
      path: '/account',
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
