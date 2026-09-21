import { describe, expect, it } from 'vitest';

import {
  normalizePlayerDisplayName,
  sanitizeUpdateMyPlayerProfileInput,
  validatePlayerDisplayName,
} from '../../imports/shared/playerProfiles';

describe('player public identity validation', () => {
  it.each([
    ['Pierre', 'Pierre'],
    ['Pete', 'Pete'],
    ['John Smith', 'John Smith'],
    ['Big Dave', 'Big Dave'],
    ['Scrum Lord', 'Scrum Lord'],
    ['José', 'José'],
    ['Thabo Mokoena', 'Thabo Mokoena'],
  ])('accepts %s', (input, expected) => {
    expect(validatePlayerDisplayName(input)).toBe(expected);
  });

  it('trims and collapses accidental repeated whitespace', () => {
    expect(normalizePlayerDisplayName('  John   Smith  ')).toBe('John Smith');
    expect(validatePlayerDisplayName('  Scrum    Lord  ')).toBe('Scrum Lord');
  });

  it('accepts a 30-character display name', () => {
    expect(validatePlayerDisplayName('Thabo Mokoena Scrum Captain')).toBe(
      'Thabo Mokoena Scrum Captain',
    );
  });

  it('rejects names shorter than two visible characters', () => {
    expect(() => validatePlayerDisplayName('P')).toThrow(
      /at least 2 characters/i,
    );
    expect(() => validatePlayerDisplayName('   ')).toThrow(
      /at least 2 characters/i,
    );
  });

  it('rejects names longer than 30 visible characters', () => {
    expect(() =>
      validatePlayerDisplayName('Thabo Mokoena Scrum Captain XXX'),
    ).toThrow(/30 characters or fewer/i);
  });

  it('rejects control characters', () => {
    expect(() => validatePlayerDisplayName('Pierre\nRooster')).toThrow(
      /control characters/i,
    );
  });

  it.each(['Rugby Rooster', 'Admin', 'Administrator', 'System'])(
    'rejects reserved name %s',
    (displayName) => {
      expect(() => validatePlayerDisplayName(displayName)).toThrow(
        /different public player name/i,
      );
    },
  );

  it('rejects userId and extra field injection', () => {
    expect(() =>
      sanitizeUpdateMyPlayerProfileInput({
        displayName: 'Pierre',
        userId: 'other-user',
      }),
    ).toThrow(/unsupported fields: userId/i);
    expect(() =>
      sanitizeUpdateMyPlayerProfileInput({
        displayName: 'Pierre',
        email: 'private@example.test',
      }),
    ).toThrow(/unsupported fields: email/i);
  });

  it('returns only the normalized display name from update input', () => {
    expect(
      sanitizeUpdateMyPlayerProfileInput({
        displayName: '  José   Scrum  ',
      }),
    ).toEqual({
      displayName: 'José Scrum',
    });
  });
});
