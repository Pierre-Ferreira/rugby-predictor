import { sanitizeFixtureId } from '/imports/shared/fixtures';
import {
  DEFAULT_FIXTURE_LEADERBOARD_LIMIT,
  MAX_FIXTURE_LEADERBOARD_LIMIT,
  MAX_FIXTURE_LEADERBOARD_OFFSET,
} from './methods';
import type { GetFixtureLeaderboardInput } from './types';
import { FixtureLeaderboardError } from './errors';

const leaderboardError = (code: string, message: string): never => {
  throw new FixtureLeaderboardError(code, message);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assertAllowedKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string,
): void => {
  const allowed = new Set(allowedKeys);
  const unknownKeys = Object.keys(value).filter((key) => !allowed.has(key));

  if (unknownKeys.length > 0) {
    leaderboardError(
      'unknown-leaderboard-field',
      `${label} contains unsupported fields: ${unknownKeys.join(', ')}.`,
    );
  }
};

const sanitizeOffset = (value: unknown): number => {
  if (value === undefined || value === null) {
    return 0;
  }

  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > MAX_FIXTURE_LEADERBOARD_OFFSET
  ) {
    leaderboardError(
      'invalid-leaderboard-offset',
      `Leaderboard offset must be an integer from 0 to ${MAX_FIXTURE_LEADERBOARD_OFFSET}.`,
    );
  }

  return value as number;
};

const sanitizeLimit = (value: unknown): number => {
  if (value === undefined || value === null) {
    return DEFAULT_FIXTURE_LEADERBOARD_LIMIT;
  }

  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_FIXTURE_LEADERBOARD_LIMIT
  ) {
    leaderboardError(
      'invalid-leaderboard-limit',
      `Leaderboard limit must be from 1 to ${MAX_FIXTURE_LEADERBOARD_LIMIT}.`,
    );
  }

  return value as number;
};

export const sanitizeFixtureLeaderboardInput = (input: unknown) => {
  if (!isRecord(input)) {
    leaderboardError(
      'invalid-leaderboard-request',
      'Leaderboard input is required.',
    );
  }

  const record = input as unknown as GetFixtureLeaderboardInput &
    Record<string, unknown>;

  assertAllowedKeys(
    record,
    ['fixtureId', 'offset', 'limit'],
    'Leaderboard input',
  );

  return {
    fixtureId: sanitizeFixtureId(record.fixtureId),
    limit: sanitizeLimit(record.limit),
    offset: sanitizeOffset(record.offset),
  };
};
