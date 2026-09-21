import { sanitizeFixtureId } from '/imports/shared/fixtures';
import {
  assertValid,
  enabledQuestions,
  isBuiltInEnabled,
  teamSides,
  validateObservations,
  validationResult,
  type CustomAnswerValue,
  type CustomObservedValue,
  type FixtureObservations,
  type ObservedValue,
  type QuestionDefinition,
  type RulesetSnapshot,
  type ValidationIssue,
} from '/imports/shared/scoring';
import {
  INITIAL_MATCH_RESULT_REVISION,
  MAX_MATCH_RESULT_SUMMARY_FIXTURES,
  NO_MATCH_RESULT_REVISION,
  type MatchResultAdminState,
  type MatchResultDocument,
} from './types';
import { enabledLiveBuiltInCounterFields } from './liveCounters';

type NormalizationMode = 'provisional' | 'final';

const topLevelObservationKeys = new Set([
  'customAnswers',
  'firstTry',
  'halfTimeLeader',
  'highestScoringHalf',
  'matchStatus',
  'team1',
  'team2',
]);

const customQuestionTypes = new Set(['custom-numeric', 'custom-categorical']);
const rawMatchStatuses = new Set(['provisional', 'confirmed']);
const rawObservationStatuses = new Set(['pending', 'provisional', 'confirmed']);
const rawCustomObservationStatuses = new Set([
  'pending',
  'provisional',
  'confirmed',
  'void',
]);
const rawObservationValueKeys = new Set(['status', 'value']);

export class MatchResultValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'MatchResultValidationError';
    this.code = code;
  }
}

const resultError = (code: string, message: string): never => {
  throw new MatchResultValidationError(code, message);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const assertAllowedKeys = (
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  label: string,
): void => {
  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));

  if (unknownKeys.length > 0) {
    resultError(
      'unknown-result-field',
      `${label} contains unsupported fields: ${unknownKeys.join(', ')}.`,
    );
  }
};

const validateRawMatchStatus = (value: unknown): void => {
  if (value === undefined) {
    return;
  }

  if (typeof value !== 'string' || !rawMatchStatuses.has(value)) {
    resultError(
      'invalid-result-observations',
      'Raw match status must be provisional or confirmed.',
    );
  }
};

const validateRawObservedValue = (
  value: unknown,
  allowedStatuses: ReadonlySet<string>,
  label: string,
): void => {
  if (!isRecord(value)) {
    resultError(
      'invalid-result-observations',
      `${label} must be an observation object.`,
    );
  }
  const record = value as Record<string, unknown>;

  assertAllowedKeys(record, rawObservationValueKeys, label);

  if (
    typeof record.status !== 'string' ||
    !allowedStatuses.has(record.status)
  ) {
    resultError(
      'invalid-result-observations',
      `${label} contains an unsupported observation status.`,
    );
  }

  if (record.status === 'void' && hasOwn(record, 'value')) {
    resultError(
      'invalid-result-observations',
      'Void custom observations must not include a value.',
    );
  }
};

export const sanitizeMatchResultRevision = (value: unknown): number => {
  if (typeof value !== 'number') {
    resultError(
      'invalid-result-revision',
      'Expected result revision is invalid.',
    );
  }

  const revision = value as number;

  if (!Number.isSafeInteger(revision) || revision < NO_MATCH_RESULT_REVISION) {
    resultError(
      'invalid-result-revision',
      'Expected result revision is invalid.',
    );
  }

  return revision;
};

export const sanitizeResultSummaryFixtureIds = (
  value: unknown,
): readonly string[] => {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    resultError(
      'invalid-result-summary-request',
      'Result summary fixture ids must be an array.',
    );
  }

  const fixtureIds = value as readonly unknown[];

  if (fixtureIds.length > MAX_MATCH_RESULT_SUMMARY_FIXTURES) {
    resultError(
      'invalid-result-summary-request',
      'Result summary request contains too many fixtures.',
    );
  }

  return fixtureIds.map((fixtureId) => sanitizeFixtureId(fixtureId));
};

export const sanitizeResultMutationInput = (input: unknown) => {
  if (!isRecord(input)) {
    resultError('invalid-result-request', 'Result mutation input is required.');
  }
  const record = input as Record<string, unknown>;

  assertAllowedKeys(
    record,
    new Set(['expectedRevision', 'fixtureId', 'observations']),
    'Result mutation input',
  );

  return {
    expectedRevision: sanitizeMatchResultRevision(record.expectedRevision),
    fixtureId: sanitizeFixtureId(record.fixtureId),
    observations: record.observations,
  };
};

export const sanitizeStartResultTrackingInput = (input: unknown) => {
  if (!isRecord(input)) {
    resultError('invalid-result-request', 'Result tracking input is required.');
  }
  const record = input as Record<string, unknown>;

  assertAllowedKeys(record, new Set(['fixtureId']), 'Result tracking input');

  return {
    fixtureId: sanitizeFixtureId(record.fixtureId),
  };
};

export const matchResultAdminState = (
  result: MatchResultDocument | null | undefined,
): MatchResultAdminState => {
  if (!result) {
    return 'none';
  }

  return result.observations.matchStatus === 'confirmed'
    ? 'final'
    : 'provisional';
};

export const matchResultAdminStateLabel = (
  state: MatchResultAdminState,
): string => {
  if (state === 'final') {
    return 'Final';
  }

  if (state === 'provisional') {
    return 'Provisional';
  }

  return 'No result';
};

export const rulesetIdentity = (ruleset: RulesetSnapshot) => ({
  id: ruleset.id,
  schemaVersion: ruleset.schemaVersion,
  version: ruleset.version,
});

const enabledBuiltInCategoricalFields = (
  ruleset: RulesetSnapshot,
): ReadonlySet<string> => {
  const fields = new Set<string>();

  if (isBuiltInEnabled(ruleset, 'first-try')) {
    fields.add('firstTry');
  }

  if (isBuiltInEnabled(ruleset, 'highest-scoring-half')) {
    fields.add('highestScoringHalf');
  }

  if (isBuiltInEnabled(ruleset, 'half-time-leader')) {
    fields.add('halfTimeLeader');
  }

  return fields;
};

const enabledCustomQuestions = (
  ruleset: RulesetSnapshot,
): readonly Extract<
  QuestionDefinition,
  { readonly type: 'custom-numeric' | 'custom-categorical' }
>[] =>
  enabledQuestions(ruleset).filter(
    (
      question,
    ): question is Extract<
      QuestionDefinition,
      { readonly type: 'custom-numeric' | 'custom-categorical' }
    > => customQuestionTypes.has(question.type),
  );

const validateRawObservationKeys = (
  source: unknown,
  ruleset: RulesetSnapshot,
): Record<string, unknown> => {
  if (!isRecord(source)) {
    resultError('invalid-result-observations', 'Observations are required.');
  }
  const record = source as Record<string, unknown>;

  const categoricalFields = enabledBuiltInCategoricalFields(ruleset);
  const allowedTopKeys = new Set([
    'customAnswers',
    'matchStatus',
    'team1',
    'team2',
    ...categoricalFields,
  ]);

  for (const key of Object.keys(record)) {
    if (!topLevelObservationKeys.has(key) || !allowedTopKeys.has(key)) {
      resultError(
        'unknown-result-observation',
        `Observation '${key}' is not enabled by this ruleset.`,
      );
    }
  }

  validateRawMatchStatus(record.matchStatus);

  const enabledTeamFields = enabledLiveBuiltInCounterFields(ruleset);

  for (const side of teamSides) {
    const team = record[side];

    if (team === undefined) {
      continue;
    }

    if (!isRecord(team)) {
      resultError(
        'invalid-result-observations',
        `${side} observations must be an object.`,
      );
    }

    assertAllowedKeys(
      team as Record<string, unknown>,
      new Set(enabledTeamFields),
      `${side} observations`,
    );

    for (const field of enabledTeamFields) {
      if (hasOwn(team as Record<string, unknown>, field)) {
        validateRawObservedValue(
          (team as Record<string, unknown>)[field],
          rawObservationStatuses,
          `${side} ${field} observation`,
        );
      }
    }
  }

  for (const field of categoricalFields) {
    if (hasOwn(record, field)) {
      validateRawObservedValue(
        record[field],
        rawObservationStatuses,
        `${field} observation`,
      );
    }
  }

  const customAnswers = record.customAnswers;

  if (customAnswers === undefined) {
    return record;
  }

  if (!isRecord(customAnswers)) {
    resultError(
      'invalid-result-observations',
      'Custom observations must be an object keyed by question id.',
    );
  }

  const customQuestionIds = new Set(
    enabledCustomQuestions(ruleset).map((question) => question.id),
  );

  assertAllowedKeys(
    customAnswers as Record<string, unknown>,
    customQuestionIds,
    'Custom observations',
  );

  for (const questionId of customQuestionIds) {
    if (hasOwn(customAnswers as Record<string, unknown>, questionId)) {
      validateRawObservedValue(
        (customAnswers as Record<string, unknown>)[questionId],
        rawCustomObservationStatuses,
        `Custom observation '${questionId}'`,
      );
    }
  }

  return record;
};

const normalizeObservedValue = <T>(
  rawValue: unknown,
  mode: NormalizationMode,
): ObservedValue<T> => {
  if (rawValue === undefined) {
    return { status: 'pending' };
  }

  if (!isRecord(rawValue)) {
    return rawValue as ObservedValue<T>;
  }

  const status = rawValue.status;
  const hasValue = hasOwn(rawValue, 'value');

  if (status === 'pending') {
    return (
      hasValue ? { status, value: rawValue.value } : { status }
    ) as ObservedValue<T>;
  }

  const normalizedStatus = mode === 'final' ? 'confirmed' : 'provisional';

  return (
    hasValue
      ? { status: normalizedStatus, value: rawValue.value }
      : { status: normalizedStatus }
  ) as ObservedValue<T>;
};

const normalizeCustomObservedValue = <T extends CustomAnswerValue>(
  rawValue: unknown,
  mode: NormalizationMode,
): CustomObservedValue<T> => {
  if (rawValue === undefined) {
    return { status: 'pending' };
  }

  if (!isRecord(rawValue)) {
    return rawValue as CustomObservedValue<T>;
  }

  const status = rawValue.status;
  const hasValue = hasOwn(rawValue, 'value');

  if (status === 'pending' || status === 'void') {
    return (
      hasValue ? { status, value: rawValue.value } : { status }
    ) as CustomObservedValue<T>;
  }

  const normalizedStatus = mode === 'final' ? 'confirmed' : 'provisional';

  return (
    hasValue
      ? { status: normalizedStatus, value: rawValue.value }
      : { status: normalizedStatus }
  ) as CustomObservedValue<T>;
};

const finalObservationIssue = (
  code: string,
  path: readonly (string | number)[],
  message: string,
): ValidationIssue => ({
  code,
  message,
  path,
});

export const validateFinalObservations = (
  observations: FixtureObservations,
  ruleset: RulesetSnapshot,
) => {
  const issues: ValidationIssue[] = [];
  const teamFields = enabledLiveBuiltInCounterFields(ruleset);
  const categoricalFields = enabledBuiltInCategoricalFields(ruleset);

  if (observations.matchStatus !== 'confirmed') {
    issues.push(
      finalObservationIssue(
        'final_match_status_not_confirmed',
        ['observations', 'matchStatus'],
        'Final confirmation requires confirmed match status.',
      ),
    );
  }

  for (const side of teamSides) {
    const team = observations[side];

    for (const field of teamFields) {
      if (team[field as keyof typeof team]?.status !== 'confirmed') {
        issues.push(
          finalObservationIssue(
            'final_observation_not_confirmed',
            ['observations', side, field],
            `Final confirmation requires confirmed ${side} ${field}.`,
          ),
        );
      }
    }
  }

  for (const field of categoricalFields) {
    const observed = observations[field as keyof FixtureObservations] as
      ObservedValue<unknown> | undefined;

    if (observed?.status !== 'confirmed') {
      issues.push(
        finalObservationIssue(
          'final_observation_not_confirmed',
          ['observations', field],
          `Final confirmation requires confirmed ${field}.`,
        ),
      );
    }
  }

  const customAnswers = observations.customAnswers ?? {};

  for (const question of enabledCustomQuestions(ruleset)) {
    const observed = customAnswers[question.id];

    if (observed?.status !== 'confirmed' && observed?.status !== 'void') {
      issues.push(
        finalObservationIssue(
          'final_custom_observation_unresolved',
          ['observations', 'customAnswers', question.id],
          `Final confirmation requires custom observation '${question.id}' to be settled or void.`,
        ),
      );
    }
  }

  return validationResult(issues);
};

export const normalizeResultObservations = (
  source: unknown,
  ruleset: RulesetSnapshot,
  mode: NormalizationMode,
): FixtureObservations => {
  const raw = validateRawObservationKeys(source, ruleset);
  const teamFields = enabledLiveBuiltInCounterFields(ruleset);
  const categoricalFields = enabledBuiltInCategoricalFields(ruleset);
  const normalized: {
    customAnswers?: FixtureObservations['customAnswers'];
    firstTry?: FixtureObservations['firstTry'];
    halfTimeLeader?: FixtureObservations['halfTimeLeader'];
    highestScoringHalf?: FixtureObservations['highestScoringHalf'];
    matchStatus: FixtureObservations['matchStatus'];
    team1: FixtureObservations['team1'];
    team2: FixtureObservations['team2'];
  } = {
    matchStatus: mode === 'final' ? 'confirmed' : 'provisional',
    team1: {},
    team2: {},
  };

  for (const side of teamSides) {
    const rawTeam = isRecord(raw[side])
      ? (raw[side] as Record<string, unknown>)
      : {};
    const normalizedTeam: Record<string, ObservedValue<number>> = {};

    for (const field of teamFields) {
      normalizedTeam[field] = normalizeObservedValue<number>(
        rawTeam[field],
        mode,
      );
    }

    normalized[side] = normalizedTeam;
  }

  for (const field of categoricalFields) {
    (normalized as unknown as Record<string, ObservedValue<unknown>>)[field] =
      normalizeObservedValue(raw[field], mode);
  }

  const customQuestions = enabledCustomQuestions(ruleset);

  if (customQuestions.length > 0) {
    const rawCustomAnswers = isRecord(raw.customAnswers)
      ? raw.customAnswers
      : {};

    normalized.customAnswers = Object.fromEntries(
      customQuestions.map((question) => [
        question.id,
        normalizeCustomObservedValue(rawCustomAnswers[question.id], mode),
      ]),
    );
  }

  assertValid(validateObservations(normalized, ruleset));

  if (mode === 'final') {
    assertValid(validateFinalObservations(normalized, ruleset));
  }

  return normalized;
};

export const assertExpectedFirstResultRevision = (
  expectedRevision: number,
): void => {
  if (expectedRevision !== NO_MATCH_RESULT_REVISION) {
    resultError(
      'result-conflict',
      'No saved result exists at the expected revision.',
    );
  }
};

export const assertExistingResultRevision = (
  expectedRevision: number,
): void => {
  if (expectedRevision < INITIAL_MATCH_RESULT_REVISION) {
    resultError('result-not-found', 'Save a provisional result first.');
  }
};
