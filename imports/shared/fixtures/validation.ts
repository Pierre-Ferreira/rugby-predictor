import {
  fixtureListModes,
  type FixtureDetailsInput,
  type FixtureListMode,
  type FixtureListOptions,
  type SanitizedFixtureDetails,
} from './types';
import { isValidDate } from './timezone';

export const FIXTURE_TEXT_LIMITS = {
  competitionDisplayName: 120,
  teamDisplayName: 80,
  venueDisplayName: 160,
} as const;

export const DEFAULT_PUBLIC_FIXTURE_LIMIT = 10;
export const MAX_PUBLIC_FIXTURE_LIMIT = 50;
export const DEFAULT_ADMIN_FIXTURE_LIMIT = 50;
export const MAX_ADMIN_FIXTURE_LIMIT = 100;

const FIXTURE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
const MIN_KICKOFF_TIME = Date.UTC(2000, 0, 1);
const MAX_KICKOFF_TIME = Date.UTC(2100, 0, 1);

export class FixtureValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'FixtureValidationError';
    this.code = code;
  }
}

const fixtureError = (code: string, message: string): never => {
  throw new FixtureValidationError(code, message);
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
    fixtureError(
      'unknown-fixture-field',
      `${label} contains unsupported fields: ${unknownKeys.join(', ')}.`,
    );
  }
};

const cleanWhitespace = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');

export const normalizeFixtureDisplayName = (value: string): string =>
  cleanWhitespace(value).toLocaleLowerCase('en-ZA');

const sanitizeRequiredText = (
  value: unknown,
  label: string,
  maxLength: number,
): string => {
  if (typeof value !== 'string') {
    fixtureError('invalid-fixture-text', `${label} is required.`);
  }

  const cleaned = cleanWhitespace(value as string);

  if (!cleaned) {
    fixtureError('invalid-fixture-text', `${label} is required.`);
  }

  if (cleaned.length > maxLength) {
    fixtureError(
      'invalid-fixture-text',
      `${label} must be ${maxLength} characters or fewer.`,
    );
  }

  return cleaned;
};

const sanitizeOptionalText = (
  value: unknown,
  label: string,
  maxLength: number,
): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    fixtureError('invalid-fixture-text', `${label} must be text.`);
  }

  const cleaned = cleanWhitespace(value as string);

  if (!cleaned) {
    return undefined;
  }

  if (cleaned.length > maxLength) {
    fixtureError(
      'invalid-fixture-text',
      `${label} must be ${maxLength} characters or fewer.`,
    );
  }

  return cleaned;
};

export const sanitizeFixtureId = (value: unknown): string => {
  if (typeof value !== 'string' || !FIXTURE_ID_PATTERN.test(value)) {
    fixtureError('invalid-fixture-id', 'Fixture ID is invalid.');
  }

  return value as string;
};

export const sanitizeUtcInstant = (value: unknown, label: string): Date => {
  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : typeof value === 'string'
        ? new Date(value)
        : null;

  if (
    !date ||
    !isValidDate(date) ||
    date.getTime() < MIN_KICKOFF_TIME ||
    date.getTime() > MAX_KICKOFF_TIME
  ) {
    fixtureError('invalid-fixture-time', `${label} must be a valid time.`);
  }

  return date as Date;
};

export const sanitizeExpectedUpdatedAt = (value: unknown): Date =>
  sanitizeUtcInstant(value, 'Expected updated time');

export const sanitizeFixtureDetailsInput = (
  input: unknown,
): SanitizedFixtureDetails => {
  if (!isRecord(input)) {
    fixtureError('invalid-fixture-details', 'Fixture details are required.');
  }
  const record = input as Record<string, unknown>;

  assertAllowedKeys(
    record,
    [
      'competitionDisplayName',
      'scheduledKickoffAt',
      'team1DisplayName',
      'team2DisplayName',
      'venueDisplayName',
    ],
    'Fixture details',
  );

  const fixtureInput = record as unknown as FixtureDetailsInput;
  const team1DisplayName = sanitizeRequiredText(
    fixtureInput.team1DisplayName,
    'Team 1 display name',
    FIXTURE_TEXT_LIMITS.teamDisplayName,
  );
  const team2DisplayName = sanitizeRequiredText(
    fixtureInput.team2DisplayName,
    'Team 2 display name',
    FIXTURE_TEXT_LIMITS.teamDisplayName,
  );

  if (
    normalizeFixtureDisplayName(team1DisplayName) ===
    normalizeFixtureDisplayName(team2DisplayName)
  ) {
    fixtureError(
      'duplicate-fixture-teams',
      'Team 1 and Team 2 must be different teams.',
    );
  }

  const competitionDisplayName = sanitizeRequiredText(
    fixtureInput.competitionDisplayName,
    'Competition display name',
    FIXTURE_TEXT_LIMITS.competitionDisplayName,
  );
  const scheduledKickoffAt = sanitizeUtcInstant(
    fixtureInput.scheduledKickoffAt,
    'Scheduled kickoff',
  );
  const venueDisplayName = sanitizeOptionalText(
    fixtureInput.venueDisplayName,
    'Venue',
    FIXTURE_TEXT_LIMITS.venueDisplayName,
  );

  return {
    competitionDisplayName,
    scheduledKickoffAt,
    team1DisplayName,
    team2DisplayName,
    ...(venueDisplayName ? { venueDisplayName } : {}),
  };
};

export const sanitizeCreateDraftInput = (
  input: unknown,
): SanitizedFixtureDetails => {
  if (!isRecord(input)) {
    fixtureError('invalid-fixture-request', 'Fixture draft input is required.');
  }
  const record = input as Record<string, unknown>;

  assertAllowedKeys(record, ['details'], 'Fixture draft input');

  return sanitizeFixtureDetailsInput(record.details);
};

export const sanitizeEditDetailsInput = (input: unknown) => {
  if (!isRecord(input)) {
    fixtureError('invalid-fixture-request', 'Fixture edit input is required.');
  }
  const record = input as Record<string, unknown>;

  assertAllowedKeys(
    record,
    ['details', 'expectedUpdatedAt', 'fixtureId'],
    'Fixture edit input',
  );

  return {
    details: sanitizeFixtureDetailsInput(record.details),
    expectedUpdatedAt: sanitizeExpectedUpdatedAt(record.expectedUpdatedAt),
    fixtureId: sanitizeFixtureId(record.fixtureId),
  };
};

export const sanitizeStateMutationInput = (input: unknown) => {
  if (!isRecord(input)) {
    fixtureError(
      'invalid-fixture-request',
      'Fixture state-change input is required.',
    );
  }
  const record = input as Record<string, unknown>;

  assertAllowedKeys(
    record,
    ['expectedUpdatedAt', 'fixtureId'],
    'Fixture state-change input',
  );

  return {
    expectedUpdatedAt: sanitizeExpectedUpdatedAt(record.expectedUpdatedAt),
    fixtureId: sanitizeFixtureId(record.fixtureId),
  };
};

const sanitizeLimit = (
  value: unknown,
  defaultLimit: number,
  maxLimit: number,
): number => {
  if (value === undefined || value === null) {
    return defaultLimit;
  }

  const limit = value as number;

  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    fixtureError(
      'invalid-fixture-limit',
      `Fixture query limit must be from 1 to ${maxLimit}.`,
    );
  }

  return limit;
};

const sanitizeBoundary = (value: unknown): Date => {
  if (value === undefined || value === null) {
    return new Date();
  }

  return sanitizeUtcInstant(value, 'Fixture list boundary');
};

export const sanitizePublicFixtureListOptions = (
  input: unknown,
): {
  readonly boundary: Date;
  readonly limit: number;
  readonly mode: FixtureListMode;
} => {
  const record = isRecord(input) ? (input as FixtureListOptions) : {};

  if (isRecord(input)) {
    assertAllowedKeys(
      input,
      ['boundary', 'limit', 'mode'],
      'Fixture list input',
    );
  }

  const mode =
    typeof record.mode === 'string' &&
    (fixtureListModes as readonly string[]).includes(record.mode)
      ? record.mode
      : 'upcoming';

  if (
    record.mode !== undefined &&
    !(fixtureListModes as readonly string[]).includes(String(record.mode))
  ) {
    fixtureError(
      'invalid-fixture-list-mode',
      'Fixture list mode must be upcoming or past.',
    );
  }

  return {
    boundary: sanitizeBoundary(record.boundary),
    limit: sanitizeLimit(
      record.limit,
      DEFAULT_PUBLIC_FIXTURE_LIMIT,
      MAX_PUBLIC_FIXTURE_LIMIT,
    ),
    mode: mode as FixtureListMode,
  };
};

export const sanitizeAdminFixtureListOptions = (
  input: unknown,
): {
  readonly limit: number;
} => {
  const record = isRecord(input) ? input : {};

  if (isRecord(input)) {
    assertAllowedKeys(input, ['limit'], 'Admin fixture list input');
  }

  return {
    limit: sanitizeLimit(
      record.limit,
      DEFAULT_ADMIN_FIXTURE_LIMIT,
      MAX_ADMIN_FIXTURE_LIMIT,
    ),
  };
};
