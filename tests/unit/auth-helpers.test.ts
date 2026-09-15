import { describe, expect, it } from 'vitest';

import {
  normalizeEmailIdentity,
  validateEmailIdentity,
} from '../../imports/shared/auth/email';
import { resolveSafeReturnPath } from '../../imports/shared/auth/redirects';

describe('auth helpers', () => {
  it('normalizes email identity without provider-specific rewrites', () => {
    expect(normalizeEmailIdentity(' Player+Round.1@Example.TEST ')).toBe(
      'player+round.1@example.test',
    );
  });

  it('validates basic email identity input', () => {
    expect(validateEmailIdentity('player@example.test')).toMatchObject({
      email: 'player@example.test',
      isValid: true,
    });
    expect(validateEmailIdentity('not-an-email')).toMatchObject({
      isValid: false,
    });
  });

  it('keeps only approved local return destinations', () => {
    expect(resolveSafeReturnPath('/account')).toBe('/account');
    expect(resolveSafeReturnPath('/admin')).toBe('/admin');
    expect(resolveSafeReturnPath('/fixtures/fixture_1?tab=predictions')).toBe(
      '/fixtures/fixture_1?tab=predictions',
    );
    expect(resolveSafeReturnPath('/fixtures/fixture_1?tab=bad')).toBe(
      '/fixtures/fixture_1',
    );
  });

  it('rejects unsafe return destinations', () => {
    expect(resolveSafeReturnPath('https://evil.example/admin')).toBe('/games');
    expect(resolveSafeReturnPath('//evil.example/admin')).toBe('/games');
    expect(resolveSafeReturnPath('javascript:alert(1)')).toBe('/games');
    expect(resolveSafeReturnPath('/unknown')).toBe('/games');
    expect(resolveSafeReturnPath('/admin?next=https://evil.example')).toBe(
      '/admin',
    );
  });
});
