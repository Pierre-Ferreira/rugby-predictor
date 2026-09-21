import { PlayerProfileValidationError } from './errors';

export const MIN_PLAYER_DISPLAY_NAME_LENGTH = 2;
export const MAX_PLAYER_DISPLAY_NAME_LENGTH = 30;

const reservedDisplayNames = new Set([
  'admin',
  'administrator',
  'rugby rooster',
  'system',
]);

const profileError = (code: string, message: string): never => {
  throw new PlayerProfileValidationError(code, message);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assertAllowedKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): void => {
  const allowed = new Set(allowedKeys);
  const unknownKeys = Object.keys(value).filter((key) => !allowed.has(key));

  if (unknownKeys.length > 0) {
    profileError(
      'unknown-player-profile-field',
      `Player profile input contains unsupported fields: ${unknownKeys.join(
        ', ',
      )}.`,
    );
  }
};

const visibleLength = (value: string): number => Array.from(value).length;

export const normalizePlayerDisplayName = (value: string): string =>
  value.trim().replace(/\s+/gu, ' ');

export const validatePlayerDisplayName = (value: unknown): string => {
  if (typeof value !== 'string') {
    profileError(
      'invalid-player-display-name',
      'Public player name must be text.',
    );
  }

  const rawDisplayName = value as string;

  if (/\p{Cc}/u.test(rawDisplayName)) {
    profileError(
      'invalid-player-display-name',
      'Public player name cannot contain control characters.',
    );
  }

  const displayName = normalizePlayerDisplayName(rawDisplayName);
  const length = visibleLength(displayName);

  if (length < MIN_PLAYER_DISPLAY_NAME_LENGTH) {
    profileError(
      'invalid-player-display-name',
      `Public player name must be at least ${MIN_PLAYER_DISPLAY_NAME_LENGTH} characters.`,
    );
  }

  if (length > MAX_PLAYER_DISPLAY_NAME_LENGTH) {
    profileError(
      'invalid-player-display-name',
      `Public player name must be ${MAX_PLAYER_DISPLAY_NAME_LENGTH} characters or fewer.`,
    );
  }

  if (reservedDisplayNames.has(displayName.toLocaleLowerCase('en-US'))) {
    profileError(
      'reserved-player-display-name',
      'Choose a different public player name.',
    );
  }

  return displayName;
};

export const sanitizeUpdateMyPlayerProfileInput = (
  input: unknown,
): { readonly displayName: string } => {
  if (!isRecord(input)) {
    profileError(
      'invalid-player-profile-input',
      'Player profile input is required.',
    );
  }

  const record = input as Record<string, unknown>;

  assertAllowedKeys(record, ['displayName']);

  return {
    displayName: validatePlayerDisplayName(record.displayName),
  };
};
